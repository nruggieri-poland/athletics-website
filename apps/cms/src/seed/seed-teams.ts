// One-off seed script — imports the authoritative team list into Sports/Teams.
// Run with: npm run seed:teams --workspace=apps/cms (see package.json script).
// Idempotent: re-running finds existing Sports/Teams by their unique keys
// (name / slug) and updates them instead of creating duplicates.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPayload } from 'payload'
import config from '../payload.config.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CSV_PATH = path.resolve(__dirname, '../../../../scripts/schedule-sync/pshs-athletics-teams.csv')

type SeasonType = 'Fall' | 'Winter' | 'Spring'

interface TeamRow {
  sport: string
  level: string
  gender: string
  season: SeasonType
  schoolLevel: string
  slug: string
}

// Gender typo ("GIrls") in the source CSV — normalize on the way in rather
// than hand-editing the authoritative file.
const GENDER_ALIASES: Record<string, string> = {
  GIrls: 'Girls',
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function parseCsv(text: string): TeamRow[] {
  // eslint-disable-next-line no-irregular-whitespace -- stripping a real UTF-8 BOM, not a typo
  const lines = text.replace(/^﻿/, '').trim().split(/\r?\n/)
  const header = lines[0].split(',').map((h) => h.trim())
  return lines.slice(1).map((line) => {
    const cols = line.split(',').map((c) => c.trim())
    const row = Object.fromEntries(header.map((h, i) => [h, cols[i] ?? '']))
    return {
      sport: row['Sport'],
      level: row['Levels'],
      gender: GENDER_ALIASES[row['Gender']] ?? row['Gender'],
      season: row['Season'] as SeasonType,
      schoolLevel: row['School Level'],
      slug: row['Slug'],
    }
  })
}

async function upsertSport(
  payload: Awaited<ReturnType<typeof getPayload>>,
  name: string,
  seasonType: SeasonType,
  sortOrder: number,
) {
  const slug = slugify(name)
  const existing = await payload.find({
    collection: 'sports',
    where: { slug: { equals: slug } },
    limit: 1,
  })
  if (existing.docs.length > 0) {
    return payload.update({
      collection: 'sports',
      id: existing.docs[0].id,
      data: { name, seasonType, sortOrder },
    })
  }
  return payload.create({
    collection: 'sports',
    data: { name, slug, seasonType, sortOrder },
  })
}

async function upsertTeam(
  payload: Awaited<ReturnType<typeof getPayload>>,
  row: TeamRow,
  sportId: string | number,
) {
  const existing = await payload.find({
    collection: 'teams',
    where: { slug: { equals: row.slug } },
    limit: 1,
  })

  const displayName = row.level === 'Varsity' ? `Varsity ${row.sport}` : `${row.sport} (${row.level})`

  const data = {
    sport: sportId,
    level: row.level,
    gender: row.gender,
    schoolLevel: row.schoolLevel,
    slug: row.slug,
    displayName,
    isActive: true,
  }

  if (existing.docs.length > 0) {
    return payload.update({ collection: 'teams', id: existing.docs[0].id, data })
  }
  return payload.create({ collection: 'teams', data })
}

async function main() {
  const rows = parseCsv(fs.readFileSync(CSV_PATH, 'utf-8'))
  if (rows.length === 0) throw new Error(`No rows parsed from ${CSV_PATH}`)

  const payload = await getPayload({ config })

  const sportNames = [...new Set(rows.map((r) => r.sport))]
  const sportIdByName = new Map<string, string | number>()

  let sortOrder = 0
  for (const name of sportNames) {
    const seasonType = rows.find((r) => r.sport === name)!.season
    const sport = await upsertSport(payload, name, seasonType, sortOrder++)
    sportIdByName.set(name, sport.id)
    console.log(`  sport: ${name} (${seasonType})`)
  }

  let created = 0
  for (const row of rows) {
    const sportId = sportIdByName.get(row.sport)
    if (!sportId) {
      console.warn(`  [skip] no sport id resolved for "${row.sport}"`)
      continue
    }
    await upsertTeam(payload, row, sportId)
    created++
  }

  console.log(`\nDone. ${sportNames.length} sports, ${created} teams upserted.`)
  process.exit(0)
}

// Top-level await so `payload run`'s dynamic import() doesn't resolve (and
// the CLI exit the process) before this async work actually finishes.
await main().catch((err) => {
  console.error(err)
  process.exit(1)
})
