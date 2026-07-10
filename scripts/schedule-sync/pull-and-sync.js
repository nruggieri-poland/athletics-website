import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pushEventsToPayload } from './push-to-payload.js';

// Pulls the per-team schedule JSON that nruggieri-poland/schedules already
// publishes every ~15 minutes via its own GitHub Actions workflow (built on
// the same EventLink feed as the old WordPress plugin) and pushes it into
// Payload. No EventLink parsing happens here — that repo already did it;
// this script is just a second consumer of its output, exactly like the
// JSON/CSV/ICS files it also produces for other uses.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.join(__dirname, 'pshs-athletics-teams.csv');

const SOURCE_BASE_URL =
  process.env.SCHEDULE_SOURCE_BASE_URL ||
  'https://raw.githubusercontent.com/nruggieri-poland/schedules/main/dist/teams';

const FETCH_TIMEOUT_MS = 15_000;

function readTeamSlugs() {
  const text = fs.readFileSync(CSV_PATH, 'utf-8').replace(/^﻿/, '').trim();
  const lines = text.split(/\r?\n/);
  const header = lines[0].split(',').map((h) => h.trim());
  const slugIndex = header.indexOf('Slug');
  if (slugIndex === -1) throw new Error(`"Slug" column not found in ${CSV_PATH}`);
  return lines
    .slice(1)
    .map((line) => line.split(',')[slugIndex]?.trim())
    .filter(Boolean);
}

async function fetchTeamEvents(slug) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${SOURCE_BASE_URL}/${slug}.json`, { signal: controller.signal });
    if (res.status === 404) {
      // No games published for this team right now (e.g. off-season) — a
      // real, synced state, not a failure. Still marked `ok: true` so
      // importFeed.ts can safely retire any stale games for this team.
      console.log(`  [pull] ${slug}: nothing published (404)`);
      return { slug, events: [], ok: true };
    }
    if (!res.ok) {
      console.warn(`  [pull] ${slug}: fetch failed (${res.status})`);
      return { slug, events: [], ok: false };
    }
    const events = await res.json();
    if (!Array.isArray(events)) {
      console.warn(`  [pull] ${slug}: unexpected response shape, skipping`);
      return { slug, events: [], ok: false };
    }
    console.log(`  [pull] ${slug}: ${events.length} events`);
    return { slug, events, ok: true };
  } catch (err) {
    console.warn(`  [pull] ${slug}: ${err.message}`);
    return { slug, events: [], ok: false };
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const slugs = readTeamSlugs();
  console.log(`Pulling schedules for ${slugs.length} teams from ${SOURCE_BASE_URL}...\n`);

  const results = await Promise.all(slugs.map(fetchTeamEvents));

  const allEvents = results.flatMap((r) => r.events);
  const syncedTeamSlugs = results.filter((r) => r.ok).map((r) => r.slug);
  const failedTeamSlugs = results.filter((r) => !r.ok).map((r) => r.slug);

  console.log(
    `\n${allEvents.length} events across ${syncedTeamSlugs.length} reachable teams` +
      (failedTeamSlugs.length ? ` (${failedTeamSlugs.length} teams failed to fetch, skipped)` : '') +
      '.\n',
  );

  if (syncedTeamSlugs.length === 0) {
    throw new Error('No teams were reachable this run — aborting before pushing to Payload.');
  }

  const summary = await pushEventsToPayload(allEvents, syncedTeamSlugs);
  console.log('\nDone.', summary);

  if (failedTeamSlugs.length > 0) {
    // Surface partial failure in CI (e.g. GitHub Actions run status) without
    // discarding the results we did get.
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
