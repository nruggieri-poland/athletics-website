import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

// Data-only: Media's Title moved to the top of the form and became each
// file's name in the admin (see Media.ts), so every file needs one. No
// schema change — the "title" column already existed.
//
// For each Media row with no title:
// - alt text of 60 characters or fewer → copied into title. No visible change
//   on the site, which already shows title-or-alt.
// - longer (sentence-style) alt text, or none → a title made from the
//   filename ("2027-basketball-classic-rules.pdf" → "2027 Basketball Classic
//   Rules"), the same rule Media.ts uses for blank titles on save.
// Rows that already have a title are untouched.

const SHORT_ALT = 60

// Frozen copy of Media.ts's nameFromFilename, so this migration keeps doing
// exactly what it did even if that helper changes later.
function nameFromFilename(filename: string | null): string {
  return (filename ?? '')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export async function up({ db, payload }: MigrateUpArgs): Promise<void> {
  const { rows } = await db.execute(sql`
    SELECT id, alt, filename FROM media WHERE title IS NULL OR btrim(title) = ''
  `)

  let fromAlt = 0
  let fromFilename = 0
  for (const row of rows as { id: number; alt: string | null; filename: string | null }[]) {
    const alt = row.alt?.trim() ?? ''
    let title = alt && alt.length <= SHORT_ALT ? alt : nameFromFilename(row.filename)
    if (title === alt) fromAlt++
    else fromFilename++
    if (!title) title = alt
    if (!title) continue
    await db.execute(sql`UPDATE media SET title = ${title} WHERE id = ${row.id}`)
  }

  payload.logger.info(`media_titles: filled ${fromAlt} titles from alt text, ${fromFilename} from filenames`)
}

// Not reversed: which titles were backfilled isn't recorded, and leaving them
// in place is harmless (the site falls back to alt text only when title is
// blank).
export async function down(_args: MigrateDownArgs): Promise<void> {}
