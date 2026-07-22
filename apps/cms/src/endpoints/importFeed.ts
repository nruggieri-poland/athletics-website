import type { PayloadHandler } from 'payload'
import { timingSafeEqual } from 'node:crypto'

// Receives pre-parsed schedule events — pulled from nruggieri-poland/schedules'
// published per-team JSON by scripts/schedule-sync/pull-and-sync.js — and
// upserts them into the Games collection, keyed on externalEventId. Never
// writes homeScore, awayScore, result, or notes — those are editor-owned,
// mirroring the invariant the legacy WordPress plugin enforced in
// class-pshs-db.php.

interface RawEvent {
  eventId: string
  eventDate: string
  season: string
  seasonType: 'Fall' | 'Winter' | 'Spring'
  teamSlug: string | null
  eventTime?: string
  _time24?: string | null
  isTimeTBD: boolean
  homeOrAway: 'Home' | 'Away'
  opponent?: string
  opponentMascot?: string | null
  location?: string | null
  eventType: 'Game' | 'Practice' | 'Scrimmage'
  isCancelled: boolean
  isPostponed: boolean
  conferenceGame: boolean
}

interface ImportFeedBody {
  events: RawEvent[]
  teamSlugs: string[]
}

function isAuthorized(req: Parameters<PayloadHandler>[0]): boolean {
  const expected = process.env.PAYLOAD_SYNC_API_KEY
  if (!expected) return false

  const header = req.headers.get('authorization') ?? ''
  const match = /^sync-key (.+)$/.exec(header)
  if (!match) return false

  const provided = match[1]
  const expectedBuf = Buffer.from(expected)
  const providedBuf = Buffer.from(provided)
  if (expectedBuf.length !== providedBuf.length) return false
  return timingSafeEqual(expectedBuf, providedBuf)
}

export const importFeedHandler: PayloadHandler = async (req) => {
  if (!isAuthorized(req)) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json!()) as ImportFeedBody
  const { events, teamSlugs } = body

  if (!Array.isArray(events) || !Array.isArray(teamSlugs)) {
    return Response.json({ message: 'Expected { events: [], teamSlugs: [] }' }, { status: 400 })
  }

  const payload = req.payload
  const warnings: string[] = []

  // ── Resolve teams ────────────────────────────────────────────────────────
  const teamsResult = teamSlugs.length
    ? await payload.find({
        collection: 'teams',
        where: { slug: { in: teamSlugs } },
        limit: teamSlugs.length,
        depth: 0,
      })
    : { docs: [] }

  const teamIdBySlug = new Map<string, number>()
  for (const team of teamsResult.docs) {
    teamIdBySlug.set(team.slug, team.id as number)
  }
  for (const slug of teamSlugs) {
    if (!teamIdBySlug.has(slug)) {
      warnings.push(`No team found for slug "${slug}" — its events were skipped.`)
    }
  }

  // ── Resolve (or create) seasons ──────────────────────────────────────────
  const seasonKey = (year: string, seasonType: string) => `${year}|${seasonType}`
  const seasonIdByKey = new Map<string, number>()
  const uniqueSeasons = new Map<string, { year: string; seasonType: RawEvent['seasonType'] }>()
  for (const e of events) {
    if (!e.season || !e.seasonType) continue
    uniqueSeasons.set(seasonKey(e.season, e.seasonType), { year: e.season, seasonType: e.seasonType })
  }

  for (const { year, seasonType } of uniqueSeasons.values()) {
    const key = seasonKey(year, seasonType)
    const existing = await payload.find({
      collection: 'seasons',
      where: { and: [{ year: { equals: year } }, { seasonType: { equals: seasonType } }] },
      limit: 1,
      depth: 0,
    })
    if (existing.docs.length > 0) {
      seasonIdByKey.set(key, existing.docs[0].id as number)
    } else {
      const created = await payload.create({
        collection: 'seasons',
        data: { year, seasonType, isCurrent: false },
      })
      seasonIdByKey.set(key, created.id as number)
    }
  }

  // ── Upsert games ──────────────────────────────────────────────────────────
  let created = 0
  let updated = 0
  let skipped = 0

  // Seeded from every team in this sync run (teamSlugs), not just teams that
  // ended up with events — a team whose entire schedule vanished from the
  // feed still needs its previously-active games retired below.
  const seenExternalIdsByTeam = new Map<number, Set<string>>()
  for (const slug of teamSlugs) {
    const teamId = teamIdBySlug.get(slug)
    if (teamId) seenExternalIdsByTeam.set(teamId, new Set())
  }

  for (const e of events) {
    if (!e.teamSlug) {
      skipped++
      continue
    }
    const teamId = teamIdBySlug.get(e.teamSlug)
    if (!teamId) {
      skipped++
      continue
    }
    const seasonId = seasonIdByKey.get(seasonKey(e.season, e.seasonType))
    if (!seasonId) {
      skipped++
      continue
    }
    if (!e.eventId) {
      skipped++
      continue
    }

    if (!seenExternalIdsByTeam.has(teamId)) seenExternalIdsByTeam.set(teamId, new Set())
    seenExternalIdsByTeam.get(teamId)!.add(e.eventId)

    // Sync-owned fields only — never homeScore/awayScore/result/notes.
    const data = {
      team: teamId,
      season: seasonId,
      externalEventId: e.eventId,
      eventType: e.eventType,
      date: e.eventDate,
      time: e.eventTime,
      time24: e._time24 ?? undefined,
      isTimeTBD: e.isTimeTBD,
      homeOrAway: e.homeOrAway,
      opponentName: e.opponent,
      opponentMascot: e.opponentMascot ?? undefined,
      location: e.location ?? undefined,
      isConferenceGame: e.conferenceGame,
      isCancelled: e.isCancelled,
      isPostponed: e.isPostponed,
      status: 'active' as const,
    }

    const existing = await payload.find({
      collection: 'games',
      where: { externalEventId: { equals: e.eventId } },
      limit: 1,
      depth: 0,
    })

    if (existing.docs.length > 0) {
      await payload.update({ collection: 'games', id: existing.docs[0].id, data })
      updated++
    } else {
      await payload.create({ collection: 'games', data })
      created++
    }
  }

  // ── Retire games that vanished from the feed, per team ───────────────────
  // Mirrors class-pshs-db.php's sync_team(): mark active games not present
  // in this run's incoming set as removed, scoped to teams actually synced.
  let retired = 0
  for (const [teamId, incomingIds] of seenExternalIdsByTeam.entries()) {
    const staleGames = await payload.find({
      collection: 'games',
      where: {
        and: [
          { team: { equals: teamId } },
          { status: { equals: 'active' } },
          { externalEventId: { not_in: [...incomingIds] } },
        ],
      },
      limit: 500,
      depth: 0,
    })
    for (const stale of staleGames.docs) {
      await payload.update({ collection: 'games', id: stale.id, data: { status: 'removed' } })
      retired++
    }
  }

  // Recorded regardless of whether anything actually changed this run — an
  // all-zero, no-warnings result is still proof the sync executed, which is
  // the whole point (see SyncStatus.ts): answering "did it run, and when"
  // without reverse-engineering it from Games' updatedAt timestamps.
  await payload.updateGlobal({
    slug: 'sync-status',
    data: {
      lastSyncAt: new Date().toISOString(),
      created,
      updated,
      retired,
      skipped,
      warnings: warnings.join('\n'),
    },
  })

  return Response.json({ created, updated, retired, skipped, warnings })
}
