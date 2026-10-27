import { createWriteStream } from 'node:fs'
import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import type { PayloadRequest } from 'payload'
import {
  POSTER_FORMATS,
  posterHtml,
  type CardProps,
  type HonorValue,
  type PosterFormat,
} from '@athletics/award-card'
import { HONORS } from './awards.ts'

// Instagram graphics for an award season: every card drawn as a feed post
// (4:5) and/or a story (9:16) image at 2160px wide, by loading the shared
// card design (packages/award-card's posterHtml — the same markup and CSS
// the website uses) into headless Chrome and screenshotting it. Served by
// AwardSeasons.ts's /api/award-seasons/:id/instagram endpoint, which the
// season editor's "Instagram graphics" panel calls.
//
// Everything a poster needs (photo, logo, fonts, CSS) is inlined into the
// page as data, and the page is blocked from loading anything else — so
// renders don't depend on the server reaching its own public URL, and
// nothing in an athlete's name can make Chrome fetch anything.
//
// Chrome comes from the `puppeteer` package, which downloads its own copy
// on `npm ci`. A fresh Linux server also needs Chrome's system libraries
// once: `npx puppeteer browsers install chrome --install-deps` (as root),
// run from apps/cms.

// Resolves packages from the CMS's own folder at runtime. Next's bundler
// rewrites a plain `require.resolve('…')` at build time, and can't for a
// .css file or a font package's data files — resolving from process.cwd()
// (apps/cms, both under `next dev` and pm2) keeps this out of its reach.
const resolveFromCms = (specifier: string) =>
  createRequire(path.join(/*turbopackIgnore: true*/ process.cwd(), 'package.json')).resolve(
    specifier,
  )

const SITE_URL = 'polandathletics.com'
// Photos are downscaled to this width before going on a poster — the card's
// photo is ~1600px wide in the largest (story) render, so this keeps it
// sharp without shipping a 6000px camera original into Chrome 56 times.
const PHOTO_WIDTH = 1800
const CONCURRENCY = 3

type Relation =
  { id?: number | string; [key: string]: unknown } | number | string | null | undefined

interface AwardRow {
  id?: string
  athleteName?: string
  honor?: HonorValue
  honorTitle?: string | null
  grade?: string | null
  division?: string | null
  sport?: Relation
  photo?: Relation
}

export interface SeasonDoc {
  id: number | string
  schoolYear: string
  season: 'Fall' | 'Winter' | 'Spring'
  awards?: AwardRow[] | null
}

export interface PosterJob {
  filename: string
  format: PosterFormat
  card: CardProps
}

// What every poster in one export shares, inlined once.
export interface PosterContext {
  cardCss: string
  fontCss: string
  logoSrc?: string
  siteName?: string
}

const asObject = (value: Relation): Record<string, unknown> | null =>
  value && typeof value === 'object' ? value : null

const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

// Mirrors apps/web/src/lib/awards.ts (seasonYear, awardSportLabel,
// sortAwards), so a graphic says exactly what the website's card says.
const seasonLabel = (season: SeasonDoc) => {
  const [start, end] = season.schoolYear.split('-')
  return `${season.season} ${season.season === 'Fall' ? start : end}`
}

function sportLabel(award: AwardRow): string {
  const name = String(asObject(award.sport)?.name ?? '')
  if (!award.division || /^(boys|girls)\b/i.test(name)) return name
  return `${award.division} ${name}`
}

function sortAwards(awards: AwardRow[]): AwardRow[] {
  const rank = (award: AwardRow) => HONORS.findIndex((honor) => honor.value === award.honor)
  const sportOrder = (award: AwardRow) => Number(asObject(award.sport)?.sortOrder ?? 0)
  const last = (award: AwardRow) =>
    (award.athleteName ?? '').trim().split(/\s+/).pop()?.toLowerCase() ?? ''
  return [...awards].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      sportOrder(a) - sportOrder(b) ||
      sportLabel(a).localeCompare(sportLabel(b)) ||
      last(a).localeCompare(last(b)),
  )
}

let fontCssPromise: Promise<string> | null = null

// Inter, inlined: the server has no guarantee of any nice font installed,
// and a poster that silently falls back to DejaVu Sans would look broken.
function fontCss(): Promise<string> {
  if (!fontCssPromise) {
    fontCssPromise = (async () => {
      const dir = path.join(
        /*turbopackIgnore: true*/ path.dirname(resolveFromCms('@fontsource/inter/package.json')),
        'files',
      )
      const faces = await Promise.all(
        [400, 600, 700, 800, 900].map(async (weight) => {
          const file = await fs.readFile(
            path.join(/*turbopackIgnore: true*/ dir, `inter-latin-${weight}-normal.woff2`),
          )
          return `@font-face { font-family: "Inter"; font-style: normal; font-weight: ${weight}; font-display: block; src: url(data:font/woff2;base64,${file.toString('base64')}) format("woff2"); }`
        }),
      )
      return faces.join('\n')
    })()
  }
  return fontCssPromise
}

function cardCss(): Promise<string> {
  return fs.readFile(
    /*turbopackIgnore: true*/ resolveFromCms('@athletics/award-card/card.css'),
    'utf8',
  )
}

// An upload's original file as a data: URI, read straight off disk (Payload
// keeps uploads under the CMS's working directory) and resized with sharp.
async function uploadDataUri(
  req: PayloadRequest,
  collection: 'award-photos' | 'media',
  doc: Record<string, unknown> | null,
  resize: { width?: number; height?: number; format: 'jpeg' | 'png' },
): Promise<string | undefined> {
  const filename = typeof doc?.filename === 'string' ? doc.filename : undefined
  if (!filename) return undefined
  const staticDir = req.payload.collections[collection].config.upload.staticDir ?? collection
  const file = path.resolve(/*turbopackIgnore: true*/ process.cwd(), staticDir, filename)
  try {
    const sharp = req.payload.config.sharp
    if (!sharp) return undefined
    let image = sharp(await fs.readFile(/*turbopackIgnore: true*/ file))
      .rotate()
      .resize({ ...resize, withoutEnlargement: true, fit: 'inside' })
    image = resize.format === 'png' ? image.png() : image.jpeg({ quality: 90, mozjpeg: true })
    const buffer = await image.toBuffer()
    return `data:image/${resize.format};base64,${buffer.toString('base64')}`
  } catch (error) {
    req.payload.logger.warn(
      `[instagram] Couldn't read ${collection} file ${filename}: ${(error as Error).message}`,
    )
    return undefined
  }
}

// Builds one HTML page per (card × format). `awardId` narrows it to a
// single card (the panel's one-card preview).
export async function buildPosterJobs(
  req: PayloadRequest,
  season: SeasonDoc,
  formats: PosterFormat[],
  awardId?: string,
): Promise<{ jobs: PosterJob[]; context: PosterContext }> {
  const awards = sortAwards((season.awards ?? []).filter((award) => award.athleteName))
  const selected = awardId ? awards.filter((award) => award.id === awardId) : awards

  const settings = (await req.payload.findGlobal({ slug: 'site-settings', depth: 1, req })) as {
    siteName?: string
    logo?: Relation
  }
  const [css, fonts, logoSrc] = await Promise.all([
    cardCss(),
    fontCss(),
    uploadDataUri(req, 'media', asObject(settings.logo ?? null), { height: 320, format: 'png' }),
  ])

  const label = seasonLabel(season)
  const [start, end] = season.schoolYear.split('-')
  const year = season.season === 'Fall' ? start : end

  const jobs: PosterJob[] = []
  for (const award of selected) {
    const photo = asObject(award.photo ?? null)
    const photoSrc = await uploadDataUri(req, 'award-photos', photo, {
      width: PHOTO_WIDTH,
      format: 'jpeg',
    })
    const focalX = typeof photo?.focalX === 'number' ? photo.focalX : undefined
    const focalY = typeof photo?.focalY === 'number' ? photo.focalY : undefined
    const card: CardProps = {
      name: award.athleteName ?? '',
      honor: award.honor ?? 'first-team',
      honorText: award.honorTitle || undefined,
      sportLabel: sportLabel(award),
      statusText: award.honor === 'coach-of-the-year' ? 'Head Coach' : (award.grade ?? undefined),
      year,
      seasonLabel: label,
      photoSrc,
      photoPosition:
        focalX !== undefined && focalY !== undefined ? `${focalX}% ${focalY}%` : undefined,
    }
    const order = String(awards.indexOf(award) + 1).padStart(2, '0')
    const base = `${order}-${slug(card.name)}-${slug(card.honorText ?? HONORS.find((h) => h.value === card.honor)?.label ?? '')}`
    for (const format of formats) {
      jobs.push({ format, card, filename: `${format}/${base}-${format}.jpg` })
    }
  }
  return {
    jobs,
    context: { cardCss: css, fontCss: fonts, logoSrc, siteName: settings.siteName || undefined },
  }
}

export class ChromeUnavailableError extends Error {}

// Draws every job at 2× (2160px wide), a few pages at a time, handing each
// finished image to `onImage` as soon as it's done — so a whole season's
// worth never has to sit in memory at once (pm2 restarts the CMS at 512MB).
//
// JPEG at quality 95 rather than PNG: indistinguishable on a photo, about a
// quarter of the size (~1MB instead of ~4MB each), and Instagram re-encodes
// every upload as JPEG anyway.
export async function drawPosters(
  jobs: PosterJob[],
  context: PosterContext,
  onImage: (job: PosterJob, image: Uint8Array) => Promise<void> | void,
): Promise<void> {
  const { default: puppeteer } = await import('puppeteer')

  let browser
  try {
    browser = await puppeteer.launch({
      headless: true,
      // Chrome refuses to start its sandbox as root, which is how many
      // single-box servers run their Node processes. The pages it renders
      // here are entirely our own markup with all network access blocked.
      args: typeof process.getuid === 'function' && process.getuid() === 0 ? ['--no-sandbox'] : [],
    })
  } catch (error) {
    throw new ChromeUnavailableError(
      `Couldn't start Chrome to draw the graphics (${(error as Error).message.split('\n')[0]}). On the server, run "npx puppeteer browsers install chrome --install-deps" from apps/cms once, as root.`,
    )
  }

  try {
    const queue = [...jobs]
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
        const page = await browser.newPage()
        await page.setRequestInterception(true)
        page.on('request', (request) => {
          if (request.url().startsWith('data:')) request.continue()
          else request.abort()
        })
        for (let job = queue.shift(); job; job = queue.shift()) {
          const size = POSTER_FORMATS[job.format]
          await page.setViewport({ width: size.width, height: size.height, deviceScaleFactor: 2 })
          await page.setContent(
            posterHtml({ format: job.format, card: job.card, siteUrl: SITE_URL, ...context }),
            { waitUntil: 'load' },
          )
          await page.evaluate(async () => {
            await document.fonts.ready
            await Promise.all([...document.images].map((image) => image.decode().catch(() => {})))
          })
          const image = await page.screenshot({
            type: 'jpeg',
            quality: 95,
            clip: { x: 0, y: 0, width: size.width, height: size.height },
          })
          await onImage(job, image)
        }
        await page.close()
      }),
    )
  } finally {
    await browser.close()
  }
}

// Zips files already on disk into `zipPath`, streaming — one image in memory
// at a time. Stored, not deflated: JPEGs don't compress any further.
export async function zipFiles(
  files: { name: string; path: string }[],
  zipPath: string,
): Promise<void> {
  const { Zip, ZipPassThrough } = await import('fflate')
  const out = createWriteStream(zipPath)
  const finished = new Promise<void>((resolve, reject) => {
    out.on('finish', resolve)
    out.on('error', reject)
  })
  const zip = new Zip((error, chunk, final) => {
    if (error) {
      out.destroy(error)
      return
    }
    out.write(chunk)
    if (final) out.end()
  })
  for (const file of files) {
    const entry = new ZipPassThrough(file.name)
    zip.add(entry)
    entry.push(await fs.readFile(/*turbopackIgnore: true*/ file.path), true)
  }
  zip.end()
  await finished
}

export const seasonFileLabel = (season: SeasonDoc) => `NE8 ${seasonLabel(season)} Instagram`
