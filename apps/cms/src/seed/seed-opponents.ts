// One-off (but safely re-runnable) script — the ONLY time this needs to run
// is once, to bootstrap the Opponents collection from the legacy
// scripts/opponent-logos/opponents.json lookup table and its ~460 PNGs.
// After this runs once, every future opponent is added entirely through
// Payload admin (create an Opponent, upload its logo, list any aliases) —
// Games.ts's beforeChange hook (see hooks/matchOpponent.ts) attaches the
// right logo automatically from then on. Run with:
// npm run seed:opponents --workspace=apps/cms
//
// Idempotent: matches existing Opponents by name and updates them (merging
// in any new aliases) rather than creating duplicates, and reuses an
// already-uploaded logo file rather than re-uploading it.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPayload } from 'payload'
import config from '../payload.config.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const LOGOS_DIR = path.resolve(__dirname, '../../../../scripts/opponent-logos')
const OPPONENTS_JSON_PATH = path.join(LOGOS_DIR, 'opponents.json')

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
  let noLogoFile = 0

  for (const { name, mascot, logo, aliases } of aliasesByOpponent.values()) {
    const filename = `${logo}.png`
    const filePath = path.join(LOGOS_DIR, filename)

    let mediaId: number | undefined
    if (fs.existsSync(filePath)) {
      const existingMedia = await payload.find({
        collection: 'media',
        where: { filename: { equals: filename } },
        limit: 1,
        depth: 0,
      })
      mediaId = existingMedia.docs[0]?.id
      if (!mediaId) {
        const uploaded = await payload.create({
          collection: 'media',
          data: { alt: `${name} ${mascot} logo` },
          filePath,
        })
        mediaId = uploaded.id
      }
    } else {
      noLogoFile++
      console.warn(`  [warn] "${filename}" not found on disk — creating "${name}" without a logo`)
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

  console.log(
    `\nDone. ${created} opponent(s) created, ${updated} updated, ${noLogoFile} had no matching logo file on disk.`,
  )
  console.log('Each Opponent\'s afterChange hook has now backfilled opponentLogo onto every matching existing game.')
  process.exit(0)
}

await main().catch((err) => {
  console.error(err)
  process.exit(1)
})
