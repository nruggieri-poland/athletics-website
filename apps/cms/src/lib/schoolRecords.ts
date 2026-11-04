// School records (collections/RecordBooks.ts): reading dates and marks the
// way people type them, importing rows pasted from a records spreadsheet,
// and working out each record's current holder(s) from its history.
//
// Pure functions, no Payload calls, so the rules live in one place. The
// collection runs them on save and stores the result in `currentRecords`,
// which is what the site and the sidebar's "Record check" panel read.

import { splitCells } from './awards.ts'

export const STATUSES = [
  { label: 'Original', value: 'original' },
  { label: 'Broken', value: 'broken' },
  { label: 'Tied', value: 'tied' },
] as const
export type RecordStatus = (typeof STATUSES)[number]['value']

export const BETTER_WHEN = [
  { label: "Don't check", value: 'none' },
  { label: 'Lower is better (strokes, times)', value: 'lower' },
  { label: 'Higher is better (points, distances)', value: 'higher' },
] as const
export type BetterWhen = (typeof BETTER_WHEN)[number]['value']

export const TEMPLATE_CSV = 'Status,Record,Holder(s),Mark,Date,Notes\r\n'

// ---------------------------------------------------------------- dates

const MONTHS = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
] as const
const MONTH_LABELS = [
  'Jan.',
  'Feb.',
  'March',
  'April',
  'May',
  'June',
  'July',
  'Aug.',
  'Sept.',
  'Oct.',
  'Nov.',
  'Dec.',
]

export interface RecordDate {
  // YYYY-MM-DD, for ordering. A month or year alone sorts as its first day;
  // a season ("1987-88") as August 1 of its first year.
  sortKey: string
  // How the site shows it: "Sept. 5, 2024", "Sept. 2024", "1987", "1987-88".
  display: string
}

const pad = (n: number) => String(n).padStart(2, '0')

function validDay(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function fullYear(text: string): number {
  const n = Number(text)
  if (text.length === 4) return n
  // Two-digit years: anything up to next year is this century.
  const nextYear = (new Date().getFullYear() + 1) % 100
  return n <= nextYear ? 2000 + n : 1900 + n
}

function exactDate(year: number, month: number, day: number): RecordDate | null {
  if (year < 1850 || year > 2200 || !validDay(year, month, day)) return null
  return {
    sortKey: `${year}-${pad(month)}-${pad(day)}`,
    display: `${MONTH_LABELS[month - 1]} ${day}, ${year}`,
  }
}

// Accepts 9/5/2024, 9/5/24, 2024-09-05 (also with a time after it, as a
// spreadsheet export gives), September 5, 2024, Sept 2024, 1987, 1987-88
// and 1987-1988. Returns null for anything else.
export function parseRecordDate(input: unknown): RecordDate | null {
  const text = String(input ?? '')
    .trim()
    .replace(/\s+/g, ' ')
  if (!text) return null

  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(text)
  if (m) return exactDate(fullYear(m[3]), Number(m[1]), Number(m[2]))

  m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T][\d:.]+Z?)?$/.exec(text)
  if (m) return exactDate(Number(m[1]), Number(m[2]), Number(m[3]))

  m = /^([a-z]+)\.?(?: (\d{1,2})(?:st|nd|rd|th)?,?)? (\d{4})$/i.exec(text)
  if (m) {
    const month = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase() as (typeof MONTHS)[number]) + 1
    if (month === 0) return null
    const year = Number(m[3])
    if (m[2]) return exactDate(year, month, Number(m[2]))
    if (year < 1850 || year > 2200) return null
    return { sortKey: `${year}-${pad(month)}-01`, display: `${MONTH_LABELS[month - 1]} ${year}` }
  }

  m = /^(\d{4})$/.exec(text)
  if (m) {
    const year = Number(m[1])
    if (year < 1850 || year > 2200) return null
    return { sortKey: `${year}-01-01`, display: String(year) }
  }

  m = /^(\d{4}) ?[-–/] ?(\d{2}|\d{4})$/.exec(text)
  if (m) {
    const start = Number(m[1])
    const end = m[2].length === 2 ? Math.floor(start / 100) * 100 + Number(m[2]) : Number(m[2])
    // 1999-00 rolls over the century.
    const endYear = end < start ? end + 100 : end
    if (endYear !== start + 1 || start < 1850 || start > 2200) return null
    return { sortKey: `${start}-08-01`, display: `${start}-${String(endYear).slice(2)}` }
  }

  return null
}

export const DATE_HELP =
  'Use a date like 9/5/2024, a month like "Sept 2024", a year like 1987, or a season like 1987-88.'

// ---------------------------------------------------------------- marks

// The number in a mark, for the soft "does this look right?" checks only:
// "69 (-3)" → 69, "4:32.10" → 272.1 seconds, "45' 6.5"" → 546.5 inches,
// "1:02:03" → 3723 seconds. Anything in parentheses is ignored. null when
// there's no single number to compare.
export function markValue(mark: unknown): number | null {
  const text = String(mark ?? '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[’′]/g, "'")
    .replace(/[”″]/g, '"')
    .trim()
  if (!text) return null

  let m = /^(\d+)\s*'\s*(?:(\d+(?:\.\d+)?)\s*"?)?/.exec(text)
  if (m) return Number(m[1]) * 12 + Number(m[2] ?? 0)

  m = /^(?:(\d+):)?(\d{1,2}):(\d{1,2}(?:\.\d+)?)\b/.exec(text)
  if (m) return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3])

  m = /^-?\d+(?:\.\d+)?/.exec(text.replace(/,(?=\d{3}\b)/g, ''))
  if (m) return Number(m[0])

  return null
}

// ---------------------------------------------------------------- shapes

export interface Holder {
  name: string
  classOf?: number | null
}

export interface RecordEntry {
  id?: string | null
  status: RecordStatus
  mark: string
  holders?: Holder[] | null
  date: string
  notes?: string | null
}

export interface RecordCategory {
  id?: string | null
  name: string
  betterWhen?: BetterWhen | null
  entries?: RecordEntry[] | null
}

export interface Performance {
  status: RecordStatus
  holders: Holder[]
  date: string
  dateSort: string
  notes?: string
}

export interface CurrentRecord {
  category: string
  // Empty when the category has no entries yet (the site leaves it out).
  mark: string
  // Whoever set the mark, then everyone who tied it since, oldest first.
  performances: Performance[]
  warnings: string[]
}

const cleanHolders = (holders: Holder[] | null | undefined): Holder[] =>
  (holders ?? [])
    .filter((holder) => holder?.name?.trim())
    .map((holder) => ({
      name: holder.name.trim(),
      ...(holder.classOf ? { classOf: Number(holder.classOf) } : {}),
    }))

const holderKey = (holders: Holder[] | null | undefined) =>
  cleanHolders(holders)
    .map((holder) => holder.name.toLowerCase())
    .sort()
    .join('|')

const entryLabel = (entry: RecordEntry) => {
  const names = cleanHolders(entry.holders).map((holder) => holder.name)
  const who = names.length > 2 ? `${names[0]} and others` : names.join(' & ')
  return `${entry.mark || '(no mark)'}${who ? ` by ${who}` : ''}`
}

const statusLabel = (status: RecordStatus) =>
  STATUSES.find((option) => option.value === status)?.label ?? status

// ------------------------------------------------- current record + checks

// Walks a category's entries oldest first. An Original or Broken entry sets
// the record; a Tied entry joins whoever holds it. The admin's status is
// always followed — the warnings only point out entries worth a second look.
export function deriveCurrent(category: RecordCategory): CurrentRecord {
  const warnings: string[] = []
  const betterWhen = category.betterWhen ?? 'none'
  const entries = (category.entries ?? [])
    .map((entry, index) => ({ entry, index, date: parseRecordDate(entry.date) }))
    .sort(
      (a, b) => (a.date?.sortKey ?? '').localeCompare(b.date?.sortKey ?? '') || a.index - b.index,
    )

  let mark = ''
  let performances: Performance[] = []
  const seen = new Set<string>()

  for (const { entry, date } of entries) {
    const label = entryLabel(entry)
    const key = [entry.status, entry.mark.trim(), date?.sortKey, holderKey(entry.holders)].join('/')
    if (seen.has(key)) warnings.push(`${label} on ${date?.display ?? entry.date} is listed twice.`)
    seen.add(key)

    const performance: Performance = {
      status: entry.status,
      holders: cleanHolders(entry.holders),
      date: date?.display ?? String(entry.date ?? ''),
      dateSort: date?.sortKey ?? '',
      ...(entry.notes?.trim() ? { notes: entry.notes.trim() } : {}),
    }

    if (!mark) {
      if (entry.status !== 'original') {
        warnings.push(
          `${label} is marked ${statusLabel(entry.status)}, but it's the earliest entry — should it be Original?`,
        )
      }
      mark = entry.mark.trim()
      performances = [performance]
      continue
    }

    const now = markValue(mark)
    const next = markValue(entry.mark)
    const comparable = now !== null && next !== null

    if (entry.status === 'tied') {
      if (comparable && Math.abs(now - next) > 1e-9) {
        warnings.push(`${label} is marked Tied, but the record it would tie is ${mark}.`)
      }
      performances.push(performance)
      continue
    }

    if (entry.status === 'original') {
      warnings.push(
        `${label} is marked Original, but there's an earlier entry — should it be Broken?`,
      )
    } else if (comparable && Math.abs(now - next) <= 1e-9) {
      warnings.push(
        `${label} is marked Broken, but it equals the record (${mark}) — should it be Tied?`,
      )
    } else if (
      comparable &&
      ((betterWhen === 'lower' && next > now) || (betterWhen === 'higher' && next < now))
    ) {
      warnings.push(
        `${label} is marked Broken, but it isn't ${betterWhen === 'lower' ? 'lower' : 'higher'} than the record (${mark}).`,
      )
    }
    mark = entry.mark.trim()
    performances = [performance]
  }

  if (entries.length === 0) warnings.push('No entries yet — this record is left off the site.')

  return { category: category.name, mark, performances, warnings }
}

export const deriveAll = (categories: RecordCategory[] | null | undefined): CurrentRecord[] =>
  (categories ?? []).filter((category) => category?.name?.trim()).map(deriveCurrent)

// ---------------------------------------------------------------- paste

// "Angelo Rinaldi '25", "Angelo Rinaldi (2025)", "Angelo Rinaldi, Class of
// 2025" → a holder with a class year.
export function parseHolder(text: string): Holder | null {
  let name = text.trim()
  if (!name) return null
  let classOf: number | undefined
  const m =
    /^(.*?)\s*(?:\(\s*(?:class of\s*)?['’]?(\d{2}|\d{4})\s*\)|['’](\d{2})|,?\s*class of\s*['’]?(\d{2}|\d{4}))$/i.exec(
      name,
    )
  if (m && m[1].trim()) {
    const year = m[2] ?? m[3] ?? m[4]
    // Class years run a few years ahead of today (current students).
    const n = Number(year)
    const ahead = (new Date().getFullYear() + 6) % 100
    classOf = year.length === 4 ? n : n <= ahead ? 2000 + n : 1900 + n
    name = m[1].trim()
  }
  return { name, ...(classOf ? { classOf } : {}) }
}

function parseStatus(text: string): RecordStatus | '' | null {
  const value = text.trim().toLowerCase()
  if (!value) return ''
  if (value.startsWith('tie')) return 'tied'
  if (value.startsWith('br') || value === 'new') return 'broken'
  if (value.startsWith('orig') || value.startsWith('set') || value.startsWith('first'))
    return 'original'
  return null
}

export interface PastedRow {
  category: string
  status: RecordStatus | ''
  entry: Omit<RecordEntry, 'status'>
}

// Columns: Status, Record, Holder(s), Mark, Date, Notes — the first five in
// the same order as the old "Record History" tab, so it pastes straight in.
// A header row is skipped. Throws one error naming every bad line, so
// nothing is half-imported.
export function parseRecordRows(text: string): PastedRow[] {
  const rows: PastedRow[] = []
  const problems: string[] = []
  let first = true

  text.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return
    const [statusCell = '', category = '', holdersCell = '', mark = '', dateCell = '', ...rest] =
      splitCells(line)
    const notes = rest.join(', ').trim()
    const lineLabel = `Line ${index + 1} ("${line.trim().replace(/\t/g, ' · ').slice(0, 50)}")`

    const isHeader = first && /record/i.test(category) && !parseRecordDate(dateCell)
    first = false
    if (isHeader) return

    const status = parseStatus(statusCell)
    const date = parseRecordDate(dateCell)
    const holders = holdersCell
      .split(/[;,](?!\s*(?:jr|sr|ii|iii|iv)\b)/i)
      .map(parseHolder)
      .filter((holder): holder is Holder => holder !== null)

    const issues = [
      status === null && `can't read the status "${statusCell}" (use Original, Broken or Tied)`,
      !category.trim() && 'the Record column is empty',
      holders.length === 0 && 'no holder name',
      !mark.trim() && 'the Mark column is empty',
      !date && `can't read the date "${dateCell}"`,
    ].filter(Boolean)

    if (issues.length > 0) {
      problems.push(`${lineLabel}: ${issues.join('; ')}.`)
      return
    }

    rows.push({
      category: category.trim(),
      status: status as RecordStatus | '',
      entry: { mark: mark.trim(), holders, date: dateCell.trim(), ...(notes ? { notes } : {}) },
    })
  })

  if (problems.length > 0) {
    throw new Error(
      `Nothing was added — fix ${problems.length === 1 ? 'this line' : 'these lines'} and paste again. ${problems.join(' ')} ${DATE_HELP}`,
    )
  }
  return rows
}

// Adds pasted rows to a book's categories (creating categories by name),
// skipping rows already there. A row with no status becomes Original when
// nothing in its category is older, otherwise Broken.
export function mergePastedRows(
  categories: RecordCategory[],
  rows: PastedRow[],
): { categories: RecordCategory[]; added: number; skipped: number } {
  const result = categories.map((category) => ({
    ...category,
    entries: [...(category.entries ?? [])],
  }))
  let added = 0
  let skipped = 0
  const autoStatus: { category: RecordCategory; entry: RecordEntry }[] = []

  for (const row of rows) {
    let category = result.find(
      (candidate) => candidate.name.trim().toLowerCase() === row.category.toLowerCase(),
    )
    if (!category) {
      category = { name: row.category, betterWhen: 'none', entries: [] }
      result.push(category)
    }
    const sortKey = parseRecordDate(row.entry.date)?.sortKey
    const duplicate = category.entries.some(
      (entry) =>
        entry.mark.trim().toLowerCase() === row.entry.mark.toLowerCase() &&
        parseRecordDate(entry.date)?.sortKey === sortKey &&
        holderKey(entry.holders) === holderKey(row.entry.holders),
    )
    if (duplicate) {
      skipped++
      continue
    }
    const entry: RecordEntry = { ...row.entry, status: row.status || 'broken' }
    category.entries.push(entry)
    if (!row.status) autoStatus.push({ category, entry })
    added++
  }

  for (const { category, entry } of autoStatus) {
    const key = parseRecordDate(entry.date)?.sortKey ?? ''
    const older = (category.entries ?? []).some(
      (other) => other !== entry && (parseRecordDate(other.date)?.sortKey ?? '') < key,
    )
    entry.status = older ? 'broken' : 'original'
  }

  return { categories: result, added, skipped }
}
