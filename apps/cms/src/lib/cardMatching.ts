import type { PayloadRequest } from 'payload'
import { planCardMatches, type CardFile, type PhotoCandidate } from './awards.ts'
import { slugify } from './slugify.ts'

// Attaches NE8 award card images from the Media library by filename —
//
//   2026-fall-angelo-rinaldi.png             one award
//   2026-fall-salvi-carramusa-football.png   an athlete with two awards
//                                            (the sport, or the award, says which)
//
// — used both when an award season is saved (AwardSeasons.ts, filling in
// cards that have no image yet) and by its "Refresh mapping" button
// (endpoints/matchCards.ts, re-matching every card so corrected re-uploads
// replace older versions).
//
// With a season's card images folder chosen, only files in that folder are
// considered. Without one, every Media file whose name contains one of the
// athletes' last names is. See planCardMatches for season tags and ties.

type Relation = { id?: number | string } | number | string | null | undefined

export interface MatchableAward {
  athleteName?: string | null
  honor?: string | null
  sport?: Relation
  photo?: Relation
  [key: string]: unknown
}

export interface MatchReport {
  matched: { name: string; sport: string; file: string }[]
  missing: string[]
  unclear: string[]
}

export const idOf = (value: Relation) =>
  value && typeof value === 'object' ? value.id : (value ?? undefined)

async function filesInFolder(req: PayloadRequest, folderId: number | string): Promise<CardFile[]> {
  const result = await req.payload.find({
    collection: 'media',
    where: { folder: { equals: folderId } },
    limit: 2000,
    depth: 0,
    req,
  })
  return result.docs
    .filter((doc) => doc.filename)
    .map((doc) => ({ id: doc.id, filename: String(doc.filename), createdAt: doc.createdAt }))
}

async function filesByLastName(
  req: PayloadRequest,
  candidates: PhotoCandidate[],
): Promise<CardFile[]> {
  const lastNames = [
    ...new Set(
      candidates
        .map((candidate) => slugify(candidate.athleteName).split('-').pop())
        .filter((name): name is string => Boolean(name)),
    ),
  ]
  const found = new Map<string, CardFile>()
  for (const lastName of lastNames) {
    const result = await req.payload.find({
      collection: 'media',
      where: { filename: { like: lastName } },
      limit: 100,
      depth: 0,
      req,
    })
    for (const doc of result.docs) {
      if (doc.filename) {
        found.set(String(doc.id), {
          id: doc.id,
          filename: String(doc.filename),
          createdAt: doc.createdAt,
        })
      }
    }
  }
  return [...found.values()]
}

// Returns a copy of `awards` with images attached, and what happened.
// `onlyMissing` leaves cards that already have an image alone (on save, so a
// hand-picked image is never replaced); otherwise every card is re-matched.
export async function matchCardImages(
  req: PayloadRequest,
  options: {
    schoolYear: string
    season: string
    awards: MatchableAward[]
    folderId?: number | string
    onlyMissing?: boolean
  },
): Promise<{ awards: MatchableAward[]; report: MatchReport }> {
  const awards = options.awards.map((award) => ({ ...award }))
  const sports = await req.payload.find({ collection: 'sports', limit: 100, depth: 0, req })
  const sportNames = new Map(sports.docs.map((sport) => [String(sport.id), String(sport.name)]))
  const candidates: PhotoCandidate[] = awards.map((award) => ({
    athleteName: award.athleteName ?? '',
    sportName: sportNames.get(String(idOf(award.sport))) ?? '',
    honor: award.honor ?? undefined,
  }))

  const files =
    options.folderId !== undefined
      ? await filesInFolder(req, options.folderId)
      : await filesByLastName(req, candidates)
  const plan = planCardMatches(
    { schoolYear: options.schoolYear, season: options.season },
    candidates,
    files,
  )

  const matched: MatchReport['matched'] = []
  for (const [index, file] of plan.assign) {
    if (options.onlyMissing && idOf(awards[index].photo)) continue
    if (String(idOf(awards[index].photo)) === String(file.id)) continue
    awards[index].photo = file.id
    matched.push({
      name: candidates[index].athleteName,
      sport: candidates[index].sportName,
      file: file.filename,
    })
  }
  const missing = awards
    .map((award, index) => ({ award, index }))
    .filter(({ award }) => !idOf(award.photo))
    .map(({ index }) => `${candidates[index].athleteName} (${candidates[index].sportName})`)

  return {
    awards,
    report: { matched, missing, unclear: plan.unclear.map((file) => file.filename) },
  }
}
