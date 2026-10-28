import { slugify } from './slugify.ts'

// Shared vocabulary for NE8 All-Conference awards (AwardSeasons.ts) and the
// parsing behind its "Quick fill" fields — pasting rows straight out of the
// awards spreadsheet, and matching a batch of dropped-in photos to athletes
// by filename. The frontend (apps/web/src/lib/awards.ts) mirrors the honor
// values/order below; keep the two in step.

export const HONORS = [
  { label: 'Player of the Year', value: 'player-of-the-year' },
  { label: 'Coach of the Year', value: 'coach-of-the-year' },
  { label: 'First Team', value: 'first-team' },
  { label: 'Second Team', value: 'second-team' },
  { label: 'Honorable Mention', value: 'honorable-mention' },
] as const

export const GRADES = [
  { label: 'Freshman', value: 'Freshman' },
  { label: 'Sophomore', value: 'Sophomore' },
  { label: 'Junior', value: 'Junior' },
  { label: 'Senior', value: 'Senior' },
] as const

export type HonorValue = (typeof HONORS)[number]['value']
export type GradeValue = (typeof GRADES)[number]['value']
export type Division = 'Boys' | 'Girls'

export function parseHonor(raw: string): HonorValue | null {
  const value = raw.toLowerCase().replace(/[^a-z0-9 ]/g, ' ')
  if (/\bcoach\b/.test(value)) return 'coach-of-the-year'
  if (/player of the year|\bpoy\b|of the year/.test(value)) return 'player-of-the-year'
  if (/\b(first|1st)\b/.test(value)) return 'first-team'
  if (/\b(second|2nd)\b/.test(value)) return 'second-team'
  if (/honorable|\bhm\b/.test(value)) return 'honorable-mention'
  return null
}

export function parseGrade(raw: string): GradeValue | null {
  const value = raw.toLowerCase().trim()
  if (/^(fr|fresh|freshman|9|9th)\b/.test(value)) return 'Freshman'
  if (/^(so|soph|sophomore|10|10th)\b/.test(value)) return 'Sophomore'
  if (/^(jr|junior|11|11th)\b/.test(value)) return 'Junior'
  if (/^(sr|senior|12|12th)\b/.test(value)) return 'Senior'
  return null
}

export interface SportOption {
  id: number | string
  name: string
  seasonType?: string
}

// Words that show up in the spreadsheet's sport column but not in the
// Sports collection's names (or the other way around) — "Swim and Dive" vs
// "Swimming & Diving", "XC" vs "Cross Country".
const SPORT_SYNONYMS: [RegExp, string][] = [
  [/\bswim(ming)?\b|\bdiv(e|ing)\b/, 'swimming diving'],
  [/\btrack\b/, 'track field'],
  [/\bxc\b|\bcross\b/, 'cross country'],
  [/\bcheer/, 'cheerleading'],
]

const words = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((word) => word && word !== 'and' && word !== 'boys' && word !== 'girls')

function canonical(value: string): string {
  const joined = words(value).join(' ')
  for (const [pattern, replacement] of SPORT_SYNONYMS) {
    if (pattern.test(joined)) return replacement
  }
  return joined
}

// "Boys Swim and Dive" → { sport: Swimming & Diving, division: 'Boys' };
// "Girls Basketball" → { sport: Girls Basketball, division: 'Girls' }. The
// Boys/Girls prefix picks between gendered sports and is kept as the
// award's division either way, so co-ed sports (Swimming & Diving, Track,
// Cross Country) still say whose team the honor was for.
export function matchSport(
  raw: string,
  sports: SportOption[],
  seasonType?: string,
): { sport: SportOption; division?: Division } | null {
  const division = /\bgirls?\b|\bwomen/i.test(raw)
    ? 'Girls'
    : /\bboys?\b|\bmen\b/i.test(raw)
      ? 'Boys'
      : undefined
  const key = canonical(raw)
  if (!key) return null

  const candidates = sports.filter((sport) => {
    const name = canonical(sport.name)
    return name === key || name.includes(key) || key.includes(name)
  })
  if (candidates.length === 0) return null

  const ranked = [...candidates].sort((a, b) => score(b) - score(a))
  return { sport: ranked[0], division }

  function score(sport: SportOption): number {
    let total = 0
    if (division && sport.name.toLowerCase().startsWith(division.toLowerCase())) total += 2
    if (seasonType && sport.seasonType === seasonType) total += 1
    if (canonical(sport.name) === key) total += 1
    return total
  }
}

export interface ParsedAwardRow {
  athleteName: string
  grade?: GradeValue
  honor: HonorValue
  sport: SportOption['id']
  division?: Division
}

// The blank template editors download from the paste box's help panel
// (served by AwardSeasons.ts at /api/award-seasons/template.csv). Its
// columns are the ones parseAwardRows reads, in that order.
export const TEMPLATE_CSV = 'Name,Grade,Award,Sport\r\n'

// One spreadsheet row's cells. Tab-separated when copied out of a
// spreadsheet; otherwise CSV, where a quoted cell may contain commas
// ("Smith, Jr.") and "" stands for a literal quote.
function splitCells(line: string): string[] {
  if (line.includes('\t')) return line.split('\t').map((cell) => cell.trim())
  const cells: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        cell += '"'
        i++
      } else if (char === '"') quoted = false
      else cell += char
    } else if (char === '"') quoted = true
    else if (char === ',') {
      cells.push(cell.trim())
      cell = ''
    } else cell += char
  }
  cells.push(cell.trim())
  return cells
}

// Accepts rows copied straight out of a spreadsheet (tab-separated) or typed
// by hand (comma-separated), in the column order Name, Grade, Award, Sport —
// the same columns the old awards spreadsheet used. A header row is
// detected and skipped. Throws one error naming every bad line, so nothing
// is half-imported.
export function parseAwardRows(
  text: string,
  sports: SportOption[],
  seasonType?: string,
): ParsedAwardRow[] {
  const rows: ParsedAwardRow[] = []
  const problems: string[] = []

  let firstRow = true
  text.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return
    const cells = splitCells(line)
    const [name = '', gradeCell = '', honorCell = '', sportCell = ''] = cells
    const lineLabel = `Line ${index + 1} ("${line.trim().slice(0, 40)}")`

    const isHeader = firstRow && /^name$|athlete/i.test(name) && !parseHonor(honorCell)
    firstRow = false
    if (isHeader) return

    const honor = parseHonor(honorCell)
    const grade = gradeCell ? parseGrade(gradeCell) : null
    const sportMatch = matchSport(sportCell, sports, seasonType)

    if (!name) problems.push(`${lineLabel}: missing a name`)
    else if (!honor) problems.push(`${lineLabel}: couldn't tell which award "${honorCell}" is`)
    else if (gradeCell && !grade && honor !== 'coach-of-the-year')
      problems.push(`${lineLabel}: couldn't tell which grade "${gradeCell}" is`)
    else if (!sportMatch) problems.push(`${lineLabel}: no sport in the CMS matches "${sportCell}"`)
    else
      rows.push({
        athleteName: name,
        grade: grade ?? undefined,
        honor,
        sport: sportMatch.sport.id,
        division: sportMatch.division,
      })
  })

  if (problems.length > 0) {
    throw new Error(
      `Nothing was added from the pasted list. Fix and save again — ${problems.join('; ')}`,
    )
  }
  return rows
}

// A photo matches an athlete when the athlete's slugified name appears in
// the file's slugified name — so "aaron-vandervort.jpg", "Aaron
// Vandervort.JPG" and the old site's "2026-winter-ne8-aaron-vandervort.png"
// all match "Aaron Vandervort".
export function photoMatchesAthlete(filename: string, athleteName: string): boolean {
  const file = slugify(filename.replace(/\.[a-z0-9]+$/i, ''))
  const name = slugify(athleteName)
  return Boolean(name) && `-${file}-`.includes(`-${name}-`)
}

export interface PhotoCandidate {
  athleteName: string
  sportName: string
  honor?: string
}

// Which awards a dropped card image belongs to. Usually that's just the one
// award whose athlete is named in the file. When an athlete has two awards
// in the season, the rest of the filename has to say which — the sport
// ("angelo-rinaldi-golf.png") or the award ("angelo-rinaldi-first-team.png").
// A file that names a two-award athlete without saying which matches
// nothing, rather than guessing: it stays in the drop box to attach by hand.
// Returns the indexes of the matching candidates.
export function awardsForPhoto(filename: string, candidates: PhotoCandidate[]): number[] {
  const named = candidates
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate }) => photoMatchesAthlete(filename, candidate.athleteName))
  if (named.length <= 1) return named.map(({ index }) => index)

  const fileSlug = slugify(filename.replace(/\.[a-z0-9]+$/i, ''))
  const nameSlug = slugify(named[0].candidate.athleteName)
  const rest = `-${fileSlug}-`.replace(`-${nameSlug}-`, '-').replace(/-/g, ' ')
  const restWords = new Set(canonical(rest).split(' ').filter(Boolean))
  const restHonor = parseHonor(rest)

  const scored = named.map(({ candidate, index }) => {
    const sportWords = canonical(candidate.sportName).split(' ').filter(Boolean)
    const sportScore = sportWords.filter((word) => restWords.has(word)).length
    const honorScore = restHonor && restHonor === candidate.honor ? 1 : 0
    return { index, score: sportScore * 2 + honorScore }
  })
  const best = Math.max(...scored.map(({ score }) => score))
  const winners = scored.filter(({ score }) => score === best)
  return best > 0 && winners.length === 1 ? [winners[0].index] : []
}
