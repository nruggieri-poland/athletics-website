import { setTimeout as sleep } from 'node:timers/promises';

// Pushes already-parsed schedule events (pulled from the published
// nruggieri-poland/schedules JSON, see pull-and-sync.js) into Payload's
// custom /api/import-feed endpoint (apps/cms/src/endpoints/importFeed.ts).

const PAYLOAD_URL       = process.env.PAYLOAD_URL;
const SYNC_API_KEY      = process.env.PAYLOAD_SYNC_API_KEY;
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES        = 3;

// `teamSlugs` must be the set of teams actually, successfully synced this
// run (including ones with zero events) — NOT just derived from `events` —
// so importFeed.ts's retire-missing-games logic only fires for teams whose
// source data was genuinely fetched, never for a team whose fetch merely
// failed (transient network/5xx), which would otherwise look identical to
// "this team has no games" and wrongly retire its real schedule.
export async function pushEventsToPayload(events, teamSlugs) {
  if (!PAYLOAD_URL) {
    console.warn('  [payload sync] PAYLOAD_URL not set — skipping push to Payload.');
    return null;
  }
  if (!SYNC_API_KEY) {
    throw new Error('PAYLOAD_SYNC_API_KEY environment variable is not set.');
  }

  let lastErr;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(`${PAYLOAD_URL}/api/import-feed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `sync-key ${SYNC_API_KEY}`,
        },
        body: JSON.stringify({ events, teamSlugs }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Payload import-feed ${res.status}: ${text.slice(0, 500)}`);
      }

      const summary = await res.json();
      console.log(
        `  [payload sync] created=${summary.created ?? 0} updated=${summary.updated ?? 0} ` +
        `retired=${summary.retired ?? 0} skipped=${summary.skipped ?? 0}`
      );
      if (Array.isArray(summary.warnings) && summary.warnings.length) {
        for (const w of summary.warnings) console.warn(`  [payload sync warning] ${w}`);
      }
      return summary;
    } catch (err) {
      clearTimeout(timeout);
      lastErr = err;
      if (attempt === MAX_RETRIES) break;
      console.warn(`  [payload sync] attempt ${attempt} failed (${err.message}), retrying…`);
      await sleep(2000 * attempt);
    }
  }
  throw lastErr;
}
