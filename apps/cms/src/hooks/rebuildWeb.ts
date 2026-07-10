import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Debounced rebuild-on-publish: Astro is a fully static build (no running
// server process — nginx serves apps/web/current, a symlink flipped by
// deploy-build.sh), so "republish" just means running that script and
// letting Cloudflare know the old cached responses are stale. Runs
// in-process inside the Payload/Next.js server (apps/cms), which already
// lives on the same box as apps/web in this self-hosted, no-Docker
// deployment — no HTTP round-trip needed.

const execAsync = promisify(exec)
const dirname = path.dirname(fileURLToPath(import.meta.url))
const webDir = path.resolve(dirname, '../../../web') // apps/cms/src/hooks -> apps/web

// Debounced so a burst of edits (e.g. an editor stepping through several
// fields, or a large EventLink sync run touching dozens of Games) triggers
// one rebuild, not dozens.
const DEBOUNCE_MS = 45_000

let timer: ReturnType<typeof setTimeout> | null = null
let running = false
let rerunQueued = false

async function purgeCloudflare(): Promise<void> {
  const zoneId = process.env.CF_ZONE_ID
  const token = process.env.CF_API_TOKEN
  if (!zoneId || !token) {
    console.warn('[rebuild] CF_ZONE_ID/CF_API_TOKEN not set — skipping Cloudflare purge.')
    return
  }
  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ purge_everything: true }),
    })
    if (!res.ok) {
      console.error(`[rebuild] Cloudflare purge failed: ${res.status} ${await res.text()}`)
    } else {
      console.log('[rebuild] Cloudflare cache purged.')
    }
  } catch (err) {
    console.error('[rebuild] Cloudflare purge request failed:', err)
  }
}

async function runRebuild(): Promise<void> {
  if (running) {
    // Another change came in mid-build — the on-disk content may already be
    // stale by the time this build finishes, so queue exactly one more run
    // rather than trying to cancel/restart the in-flight build.
    rerunQueued = true
    return
  }
  running = true
  try {
    console.log('[rebuild] Building apps/web...')
    // Not `npm run build` — that builds straight into the directory nginx
    // serves from, which Astro clears at the start of every build, so
    // visitors would briefly see 404s mid-rebuild. deploy-build.sh builds
    // into an offline directory and only atomically flips the live symlink
    // once the build succeeds — see that script's comment for the details.
    const { stdout, stderr } = await execAsync('./deploy-build.sh', { cwd: webDir })
    if (stderr) console.warn(stderr)
    console.log(stdout.split('\n').slice(-5).join('\n'))
    console.log('[rebuild] Build complete.')
    await purgeCloudflare()
  } catch (err) {
    console.error('[rebuild] Build failed:', err)
  } finally {
    running = false
    if (rerunQueued) {
      rerunQueued = false
      void runRebuild()
    }
  }
}

export function scheduleRebuild(): void {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    void runRebuild()
  }, DEBOUNCE_MS)
}
