import config from '@payload-config'
import {
  REST_DELETE,
  REST_GET,
  REST_OPTIONS,
  REST_PATCH,
  REST_POST,
  REST_PUT,
} from '@payloadcms/next/routes'

const restGet = REST_GET(config)

// Uploaded media never changes in place — a re-upload gets a new filename,
// it never overwrites the old file — so these responses are safe to cache
// indefinitely. Payload's default file-serving route sends no Cache-Control
// header at all, meaning a browser doing a hard refresh (or, once deployed,
// Cloudflare) re-fetches every logo/photo from this server on every visit.
// Wrapping just the GET handler here to tag /api/media/file/* responses.
export async function GET(request: Request, ctx: { params: Promise<{ slug: string[] }> }) {
  const response = await restGet(request, ctx)
  const { slug } = await ctx.params
  if (slug?.[0] === 'media' && slug?.[1] === 'file') {
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable')
  }
  return response
}
export const POST = REST_POST(config)
export const DELETE = REST_DELETE(config)
export const PATCH = REST_PATCH(config)
export const PUT = REST_PUT(config)
export const OPTIONS = REST_OPTIONS(config)
