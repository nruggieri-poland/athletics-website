// One-off (but safely re-runnable) script — the ONLY time this needs to run
// is once, to bootstrap the Opponents collection from the legacy
// scripts/opponent-logos/opponents.json lookup table. Run with:
// npm run seed:opponents --workspace=apps/cms
//
// IMPORTANT — the actual logo images are NOT read from disk. They're too
// large to keep in git (scripts/opponent-logos/*.png is gitignored), so
// they must already be bulk-uploaded into Payload's Media library through
// the admin UI (drag-and-drop, filenames unchanged) BEFORE this runs. This
// script only creates the Opponent records and links each one to the
// already-uploaded Media doc that matches its logo filename — any opponent
// whose file hasn't been uploaded yet is created without a logo and can be
// linked later, either by re-running this script or by picking the file
// manually in that Opponent's admin record.
//
// After this runs once, every future opponent is added entirely through
// Payload admin (create an Opponent, upload its logo, list any aliases) —
// Games.ts's beforeChange hook (see hooks/matchOpponent.ts) attaches the
// right logo automatically from then on.
//
// Idempotent: matches existing Opponents by name and updates them (merging
// in any new aliases) rather than creating duplicates.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPayload } from 'payload'
import config from '../payload.config.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OPPONENTS_JSON_PATH = path.resolve(__dirname, '../../../../scripts/opponent-logos/opponents.json')

interface OpponentEntry {
  name: string
  mascot: string
  logo: string
}

async function main() {
  const raw = JSON.parse(fs.readFileSync(OPPONENTS_JSON_PATH, 'utf-8')) as Record<string, OpponentEntry>

  // opponents.json is keyed by every alias a school might appear under in
  // the feed (e.g. both "Struthers" and "Struthers High School") — group
  // those keys by the (name, mascot) pair they resolve to, so each distinct
  // school becomes exactly one Opponent record with the rest as aliases.
  const aliasesByOpponent = new Map<string, { name: string; mascot: string; logo: string; aliases: Set<string> }>()
  for (const [alias, entry] of Object.entries(raw)) {
    if (!entry.name || !entry.mascot || !entry.logo) continue
    const key = `${entry.name.trim().toLowerCase()}|${entry.mascot.trim().toLowerCase()}`
    const existing = aliasesByOpponent.get(key)
    if (existing) {
      existing.aliases.add(alias)
    } else {
      aliasesByOpponent.set(key, { name: entry.name, mascot: entry.mascot, logo: entry.logo, aliases: new Set([alias]) })
    }
  }

  const payload = await getPayload({ config })

  let created = 0
  let updated = 0
  let noMediaYet = 0

  for (const { name, mascot, logo, aliases } of aliasesByOpponent.values()) {
    const filename = `${logo}.png`

    const existingMedia = await payload.find({
      collection: 'media',
      where: { filename: { equals: filename } },
      limit: 1,
      depth: 0,
    })
    const mediaId = existingMedia.docs[0]?.id
    if (!mediaId) {
      noMediaYet++
      console.warn(`  [warn] "${filename}" not uploaded to Media yet — creating "${name}" without a logo`)
    }

    // aliases includes the school's own name as one of its JSON keys in most
    // cases — drop it so it isn't listed as an "alias" of itself.
    const aliasList = [...aliases].filter((alias) => alias.trim().toLowerCase() !== name.trim().toLowerCase())

    const existingOpponent = await payload.find({
      collection: 'opponents',
      where: { name: { equals: name } },
      limit: 1,
      depth: 0,
    })

    if (existingOpponent.docs[0]) {
      const priorAliases = new Set(
        (existingOpponent.docs[0].aliases ?? []).map((entry: { alias: string }) => entry.alias),
      )
      for (const alias of aliasList) priorAliases.add(alias)

      await payload.update({
        collection: 'opponents',
        id: existingOpponent.docs[0].id,
        data: {
          mascot,
          ...(mediaId ? { logo: mediaId } : {}),
          aliases: [...priorAliases].map((alias) => ({ alias })),
        },
      })
      updated++
    } else {
      await payload.create({
        collection: 'opponents',
        data: {
          name,
          mascot,
          ...(mediaId ? { logo: mediaId } : {}),
          aliases: aliasList.map((alias) => ({ alias })),
        },
      })
      created++
    }
  }

  console.log(`\nDone. ${created} opponent(s) created, ${updated} updated, ${noMediaYet} had no matching upload yet.`)
  if (noMediaYet > 0) {
    console.log(
      `Upload the missing files into Media (same filenames) and re-run this script to link them — it only ever creates/updates, never duplicates.`,
    )
  }
  console.log("Each Opponent's afterChange hook has now backfilled opponentLogo onto every matching existing game.")
  process.exit(0)
}

await main().catch((err) => {
  console.error(err)
  process.exit(1)
})
