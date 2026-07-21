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
// it never overwrites the old file — so successful responses are safe to
// cache aggressively. Payload's default file-serving route sends no
// Cache-Control header at all, meaning a browser doing a hard refresh (or,
// once deployed, Cloudflare) re-fetches every logo/photo from this server
// on every visit. Wrapping just the GET handler here to tag
// /api/media/file/* responses.
//
// Two deliberate choices, both learned from a real incident: a handful of
// opponent logos got cached as broken for days because an earlier version
// of this tagged EVERY response — including a transient 500 — with a
// year-long max-age, and nothing purged it until someone noticed and
// manually cleared Cloudflare's cache.
//   1. Only successful (2xx) responses get the long-cache treatment.
//      Anything else gets `no-store` explicitly, so a failure can never be
//      cached anywhere, at any layer, for any length of time.
//   2. The TTL is one week, not one year. Uploaded files are still
//      effectively immutable at that timescale (a real filename never
//      gets reused), but if some other not-yet-understood edge case ever
//      does cache a bad response, it now self-heals within days instead
//      of requiring someone to notice and manually purge.
export async function GET(request: Request, ctx: { params: Promise<{ slug: string[] }> }) {
  const response = await restGet(request, ctx)
  const { slug } = await ctx.params
  if (slug?.[0] === 'media' && slug?.[1] === 'file') {
    response.headers.set('Cache-Control', response.ok ? 'public, max-age=604800, immutable' : 'no-store')
  }
  return response
}
export const POST = REST_POST(config)
export const DELETE = REST_DELETE(config)
export const PATCH = REST_PATCH(config)
export const PUT = REST_PUT(config)
export const OPTIONS = REST_OPTIONS(config)
