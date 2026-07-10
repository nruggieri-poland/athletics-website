// One-off (but safely re-runnable) script — some opponent-logo uploads are
// already narrower than Payload's smallest configured image size (400px),
// so Payload correctly declines to generate a "thumbnail" variant (it never
// upscales) and mediaUrl() falls back to serving the original file. Several
// of those originals are poorly-compressed PNGs (e.g. 370x458px but 110KB),
// serving far more bytes than a 10-24px calendar icon needs. This
// re-encodes each one as WebP at its native resolution — same pixels, a
// fraction of the bytes — by replacing the Media doc's underlying file via
// Payload's Local API (all existing Game.opponentLogo references keep
// pointing at the same doc id, so nothing else needs to change).
// Run with: npm run optimize:logos

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { getPayload } from 'payload'
import config from '../payload.config.ts'

async function main() {
  const payload = await getPayload({ config })

  const media = await payload.find({
    collection: 'media',
    limit: 1000,
    depth: 0,
  })

  const candidates = media.docs.filter((doc) => {
    const sizes = doc.sizes as Record<string, { url?: string | null } | undefined> | undefined
    const hasThumbnail = !!sizes?.thumbnail?.url
    const isPng = doc.mimeType === 'image/png'
    return !hasThumbnail && isPng
  })

  console.log(`${candidates.length} media doc(s) are undersized PNGs with no thumbnail variant.`)

  let optimized = 0
  let savedBytes = 0

  for (const doc of candidates) {
    const originalPath = path.join(process.cwd(), 'media', doc.filename as string)
    if (!fs.existsSync(originalPath)) {
      console.warn(`  [skip] ${doc.filename} not found on disk`)
      continue
    }

    const originalSize = fs.statSync(originalPath).size
    const webpBuffer = await sharp(originalPath).webp({ quality: 85 }).toBuffer()

    if (webpBuffer.length >= originalSize) {
      console.log(`  [skip] ${doc.filename} — WebP (${webpBuffer.length}B) isn't smaller than the PNG (${originalSize}B)`)
      continue
    }

    const tempPath = path.join(os.tmpdir(), `${path.parse(doc.filename as string).name}.webp`)
    fs.writeFileSync(tempPath, webpBuffer)

    await payload.update({
      collection: 'media',
      id: doc.id,
      data: {},
      filePath: tempPath,
    })

    fs.unlinkSync(tempPath)

    const delta = originalSize - webpBuffer.length
    savedBytes += delta
    optimized++
    console.log(
      `  [ok] ${doc.filename} — ${(originalSize / 1024).toFixed(1)}KB -> ${(webpBuffer.length / 1024).toFixed(1)}KB`,
    )
  }

  console.log(`\nDone. ${optimized} logo(s) re-encoded, ${(savedBytes / 1024).toFixed(1)}KB saved.`)
  process.exit(0)
}

await main().catch((err) => {
  console.error(err)
  process.exit(1)
})
