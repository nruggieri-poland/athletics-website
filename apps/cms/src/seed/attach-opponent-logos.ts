// One-off (but safely re-runnable) script — matches each Game's
// opponentName/opponentMascot against scripts/opponent-logos/opponents.json,
// uploads each unique logo to Media exactly once, and bulk-assigns it to
// every Game that opponent appears in. Run with: npm run attach:logos
// (see apps/cms/package.json).

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

function opponentKey(name: string, mascot: string): string {
  return `${name.trim().toLowerCase()}|${mascot.trim().toLowerCase()}`
}

async function main() {
  const raw = JSON.parse(fs.readFileSync(OPPONENTS_JSON_PATH, 'utf-8')) as Record<string, OpponentEntry>

  // opponents.json is keyed by every alias a school might appear under in
  // the feed (e.g. both "Struthers" and "Struthers High School"), but each
  // alias's *value* already has the short name/mascot our Games store —
  // index by that short (name, mascot) pair so lookups match our data.
  const logoByOpponent = new Map<string, string>()
  for (const entry of Object.values(raw)) {
    if (entry.name && entry.mascot && entry.logo) {
      logoByOpponent.set(opponentKey(entry.name, entry.mascot), entry.logo)
    }
  }

  const payload = await getPayload({ config })

  const games = await payload.find({
    collection: 'games',
    where: {
      and: [{ opponentName: { exists: true } }, { opponentLogo: { exists: false } }],
    },
    limit: 5000,
    depth: 0,
  })

  console.log(`${games.totalDocs} games without a logo yet.`)

  // Group by opponent so we upload each logo file exactly once, then bulk
  // -update every game for that opponent in a single query.
  const gamesByOpponent = new Map<string, { name: string; mascot: string }>()
  for (const game of games.docs) {
    if (!game.opponentName || !game.opponentMascot) continue
    gamesByOpponent.set(opponentKey(game.opponentName, game.opponentMascot), {
      name: game.opponentName,
      mascot: game.opponentMascot,
    })
  }

  let uploaded = 0
  let updated = 0
  let noLogoFile = 0

  for (const [key, { name, mascot }] of gamesByOpponent) {
    const logoSlug = logoByOpponent.get(key)
    if (!logoSlug) {
      noLogoFile++
      console.warn(`  [skip] no opponents.json entry for "${name}" / "${mascot}"`)
      continue
    }

    const filePath = path.join(LOGOS_DIR, `${logoSlug}.png`)
    if (!fs.existsSync(filePath)) {
      noLogoFile++
      console.warn(`  [skip] "${logoSlug}.png" not found on disk`)
      continue
    }

    // Reuse an already-uploaded logo (matched by its source filename) rather
    // than re-uploading the same PNG for every opponent that shares it.
    const existingMedia = await payload.find({
      collection: 'media',
      where: { filename: { equals: `${logoSlug}.png` } },
      limit: 1,
      depth: 0,
    })

    let mediaId = existingMedia.docs[0]?.id
    if (!mediaId) {
      const created = await payload.create({
        collection: 'media',
        data: { alt: `${name} ${mascot} logo` },
        filePath,
      })
      mediaId = created.id
      uploaded++
    }

    const result = await payload.update({
      collection: 'games',
      where: {
        and: [{ opponentName: { equals: name } }, { opponentMascot: { equals: mascot } }],
      },
      data: { opponentLogo: mediaId },
    })
    updated += result.docs.length
  }

  console.log(
    `\nDone. ${uploaded} logo(s) uploaded, ${updated} game(s) updated, ${noLogoFile} opponent(s) had no matching file.`,
  )
  process.exit(0)
}

await main().catch((err) => {
  console.error(err)
  process.exit(1)
})
