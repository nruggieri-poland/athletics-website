// One-off (but safely re-runnable) script — reads a Sport,Levels,Gender,Video ID
// CSV and sets each Sports doc's heroVideoId. The CSV has one row per
// team/level, but the video ID is always the same across every level within
// a sport, so this collapses to one update per sport (heroVideoId lives on
// Sports, not Teams). Run with: npm run import:hero-videos -- <path-to-csv>

import fs from 'node:fs'
import { getPayload } from 'payload'
import config from '../payload.config.ts'

function parseCsv(text: string): string[][] {
  return text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split(',').map((cell) => cell.trim()))
}

async function main() {
  const csvPath = process.argv[2]
  if (!csvPath) {
    throw new Error('Usage: npm run import:hero-videos -- <path-to-csv>')
  }

  const rows = parseCsv(fs.readFileSync(csvPath, 'utf-8'))
  const [header, ...dataRows] = rows
  const sportIdx = header.indexOf('Sport')
  const videoIdx = header.indexOf('Video ID')
  if (sportIdx === -1 || videoIdx === -1) {
    throw new Error(`CSV must have "Sport" and "Video ID" columns. Found: ${header.join(', ')}`)
  }

  // Collapse to one video ID per sport, warning if a sport's rows disagree
  // (the CSV is expected to repeat the same ID across every level).
  const videoIdBySport = new Map<string, string>()
  const conflicts: string[] = []
  for (const row of dataRows) {
    const sport = row[sportIdx]?.trim()
    const videoId = row[videoIdx]?.trim()
    if (!sport || !videoId) continue
    const existing = videoIdBySport.get(sport)
    if (existing && existing !== videoId) {
      conflicts.push(`"${sport}" has conflicting IDs: "${existing}" vs "${videoId}"`)
      continue
    }
    videoIdBySport.set(sport, videoId)
  }

  if (conflicts.length) {
    console.warn(`Conflicting video IDs within a sport (kept the first seen):\n  ${conflicts.join('\n  ')}`)
  }

  const payload = await getPayload({ config })

  let updated = 0
  let notFound = 0
  for (const [sportName, videoId] of videoIdBySport) {
    const existing = await payload.find({
      collection: 'sports',
      where: { name: { equals: sportName } },
      limit: 1,
      depth: 0,
    })
    const sport = existing.docs[0]
    if (!sport) {
      notFound++
      console.warn(`  [skip] no Sport found named "${sportName}"`)
      continue
    }
    await payload.update({
      collection: 'sports',
      id: sport.id,
      data: { heroVideoId: videoId },
    })
    updated++
    console.log(`  [ok] ${sportName} -> ${videoId}`)
  }

  console.log(`\nDone. ${updated} sport(s) updated, ${notFound} sport(s) not found.`)
  process.exit(0)
}

await main().catch((err) => {
  console.error(err)
  process.exit(1)
})
