import type { PayloadHandler } from 'payload'

// Temporary diagnostic marker — exists only to answer one question from
// outside the server, with no SSH/log access available: does the
// build+restart half of deploy.sh actually complete on this box at all,
// independent of whether a migration is also involved? This route only
// exists if a fresh build picked it up and PM2 restarted into it, so
// hitting /api/health-check-canary and getting this response (rather than
// a 404) is itself the answer. Bump CANARY_VERSION on any follow-up test
// so a stale cached response can't be mistaken for a fresh one.
const CANARY_VERSION = 'canary-1'

export const healthCheckCanaryHandler: PayloadHandler = async () => {
  return Response.json({ ok: true, version: CANARY_VERSION })
}
