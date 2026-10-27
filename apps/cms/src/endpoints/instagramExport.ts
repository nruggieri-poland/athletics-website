import { randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import type { PayloadHandler, PayloadRequest } from 'payload'
import type { PosterFormat } from '@athletics/award-card'
import {
  ChromeUnavailableError,
  buildPosterJobs,
  drawPosters,
  seasonFileLabel,
  zipFiles,
  type SeasonDoc,
} from '../lib/instagramExport.ts'

// An award season's Instagram graphics (see lib/instagramExport.ts), for
// the season editor's "Instagram graphics" panel. Editors only: drawing ~56
// high-resolution images keeps a Chrome busy for a minute, which isn't
// something to hand to anyone on the internet.
//
// A whole season runs as a background job rather than one long request —
// at ~1s an image it can outlast nginx's and Cloudflare's request timeouts:
//   POST /api/award-seasons/:id/instagram/exports?format=feed|story|both
//        → { jobId, total }
//   GET  /api/award-seasons/instagram/exports/:jobId        → progress
//   GET  /api/award-seasons/instagram/exports/:jobId/download → the zip
// One card (the panel's preview) is quick enough to answer directly:
//   GET  /api/award-seasons/:id/instagram?award=<row id>&format=feed|story
//
// Exports always use the season's latest saved version, draft or
// published, so graphics can be made before a season goes live. Jobs live
// in this process's memory and their files in the OS temp folder — fine for
// the single pm2 instance this CMS runs as; a restart just forgets them.

interface ExportJob {
  id: string
  userId: string
  status: 'running' | 'done' | 'error'
  done: number
  total: number
  error?: string
  dir: string
  zipPath: string
  filename: string
}

const jobs = new Map<string, ExportJob>()
// How long a finished zip stays downloadable before its files are deleted.
const KEEP_MS = 30 * 60 * 1000

const isRunning = () => [...jobs.values()].some((job) => job.status === 'running')

function parseFormats(value: string | null): PosterFormat[] {
  if (!value || value === 'both') return ['feed', 'story']
  return value === 'feed' || value === 'story' ? [value] : []
}

const searchParams = (req: PayloadRequest) =>
  req.searchParams ?? new URL(req.url ?? '', 'http://localhost').searchParams

async function loadSeason(req: PayloadRequest, id: string): Promise<SeasonDoc | null> {
  try {
    return (await req.payload.findByID({
      collection: 'award-seasons',
      id,
      depth: 1,
      draft: true,
      req,
    })) as unknown as SeasonDoc
  } catch {
    return null
  }
}

const unauthorized = () =>
  Response.json({ error: 'Sign in to the CMS to download graphics.' }, { status: 401 })

const failureMessage = (error: unknown) =>
  error instanceof ChromeUnavailableError
    ? error.message
    : `Drawing the graphics failed: ${(error as Error).message}`

export const startInstagramExport: PayloadHandler = async (req) => {
  if (!req.user) return unauthorized()
  const formats = parseFormats(searchParams(req).get('format'))
  if (formats.length === 0)
    return Response.json({ error: 'Use ?format=feed, story, or both.' }, { status: 400 })
  if (isRunning()) {
    return Response.json(
      { error: 'Another set of graphics is being drawn right now — try again in a minute.' },
      { status: 409 },
    )
  }

  const season = await loadSeason(req, String(req.routeParams?.id))
  if (!season)
    return Response.json({ error: 'That award season no longer exists.' }, { status: 404 })

  const { jobs: posters, context } = await buildPosterJobs(req, season, formats)
  if (posters.length === 0)
    return Response.json({ error: 'This season has no cards yet.' }, { status: 404 })

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ne8-instagram-'))
  const suffix = formats.length === 1 ? ` (${formats[0]})` : ''
  const job: ExportJob = {
    id: randomUUID(),
    userId: String(req.user.id),
    status: 'running',
    done: 0,
    total: posters.length,
    dir,
    zipPath: path.join(dir, 'export.zip'),
    filename: `${seasonFileLabel(season)}${suffix}.zip`,
  }
  jobs.set(job.id, job)

  const { logger } = req.payload
  const started = Date.now()
  // Deliberately not awaited: the request returns now and the panel polls.
  void (async () => {
    try {
      const written: { name: string; path: string }[] = []
      await drawPosters(posters, context, async (poster, image) => {
        const file = path.join(dir, poster.filename)
        await fs.mkdir(path.dirname(file), { recursive: true })
        await fs.writeFile(file, image)
        written.push({ name: poster.filename, path: file })
        job.done++
      })
      written.sort((a, b) => a.name.localeCompare(b.name))
      await zipFiles(written, job.zipPath)
      job.status = 'done'
      logger.info(
        `[instagram] Drew ${job.total} graphic(s) for award season ${season.id} in ${Date.now() - started}ms`,
      )
    } catch (error) {
      job.status = 'error'
      job.error = failureMessage(error)
      logger.error(`[instagram] ${job.error}`)
    } finally {
      setTimeout(() => {
        jobs.delete(job.id)
        void fs.rm(dir, { recursive: true, force: true })
      }, KEEP_MS).unref()
    }
  })()

  return Response.json({ jobId: job.id, total: job.total }, { status: 202 })
}

function ownJob(req: PayloadRequest): ExportJob | Response {
  if (!req.user) return unauthorized()
  const job = jobs.get(String(req.routeParams?.jobId))
  if (!job || job.userId !== String(req.user.id)) {
    return Response.json({ error: 'That export has expired — start a new one.' }, { status: 404 })
  }
  return job
}

export const instagramExportStatus: PayloadHandler = async (req) => {
  const job = ownJob(req)
  if (job instanceof Response) return job
  return Response.json(
    { status: job.status, done: job.done, total: job.total, error: job.error },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

export const downloadInstagramExport: PayloadHandler = async (req) => {
  const job = ownJob(req)
  if (job instanceof Response) return job
  if (job.status !== 'done') return Response.json({ error: 'Not finished yet.' }, { status: 409 })
  const { size } = await fs.stat(job.zipPath)
  return new Response(Readable.toWeb(createReadStream(job.zipPath)) as ReadableStream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Length': String(size),
      'Content-Disposition': `attachment; filename="${job.filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

export const instagramPreview: PayloadHandler = async (req) => {
  if (!req.user) return unauthorized()
  const params = searchParams(req)
  const awardId = params.get('award') ?? undefined
  const format = params.get('format')
  if (!awardId || (format !== 'feed' && format !== 'story')) {
    return Response.json({ error: 'Use ?award=<card id>&format=feed or story.' }, { status: 400 })
  }

  const season = await loadSeason(req, String(req.routeParams?.id))
  if (!season)
    return Response.json({ error: 'That award season no longer exists.' }, { status: 404 })

  const { jobs: posters, context } = await buildPosterJobs(req, season, [format], awardId)
  if (posters.length === 0) {
    return Response.json(
      { error: "That card isn't in this season's last save — save first if you just added it." },
      { status: 404 },
    )
  }

  let image: Uint8Array | undefined
  try {
    await drawPosters(posters, context, (_, drawn) => {
      image = drawn
    })
  } catch (error) {
    const message = failureMessage(error)
    req.payload.logger.error(`[instagram] ${message}`)
    return Response.json({ error: message }, { status: 500 })
  }
  return new Response(image as BodyInit, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Content-Disposition': `inline; filename="${posters[0].filename.split('/').pop()}"`,
      'Cache-Control': 'no-store',
    },
  })
}
