#!/bin/bash
# Deploys the latest pushed code to this server. Pulls, installs
# dependencies only if package.json/lockfile changed, applies any new
# Payload migrations, and rebuilds+restarts only the piece(s) that actually
# changed (apps/cms and/or apps/web).
#
# This is for CODE changes only — content edits made through the CMS admin
# never need this, they deploy themselves automatically via the
# rebuild-on-publish hook (apps/cms/src/hooks/rebuildWeb.ts).
#
# Designed to run unattended from cron with no SSH access for debugging:
# every run publishes its own status to the live static site at
# /deploy-status.txt (see publish_status below), so "what did the last
# deploy do" is answerable from a browser.
#
# Run from anywhere on the server: ./scripts/deploy.sh
set -Eeuo pipefail
cd "$(dirname "$0")/.."

# Never wait on interactive input. Under cron there is no TTY, and some
# tools (payload/drizzle migration prompts, git credential prompts) will
# otherwise hang forever waiting for an answer that can never come — a
# hung run holds the lock below and silently blocks every future tick.
exec </dev/null

# Cron starts with a minimal PATH (often just /usr/bin:/bin). npm/node are
# evidently reachable (static-site deploys have always worked from cron),
# but globally-installed binaries like pm2 live in npm's global bin, which
# that minimal PATH may not include.
NPM_GLOBAL_PREFIX="$(npm prefix -g 2>/dev/null || true)"
if [ -n "$NPM_GLOBAL_PREFIX" ] && [ -d "$NPM_GLOBAL_PREFIX/bin" ]; then
  export PATH="$NPM_GLOBAL_PREFIX/bin:$PATH"
fi

# Single-instance lock. A CMS build takes minutes and cron fires every 5 —
# without this, two runs can overlap and race each other through the
# build-dir rename below. flock is standard on Linux; the fallback exists
# only so the script can be syntax-exercised on a dev Mac.
LOCK_FILE="/tmp/athletics-deploy.lock"
if command -v flock >/dev/null 2>&1; then
  exec 200>"$LOCK_FILE"
  if ! flock -n 200; then
    echo "[deploy] Another deploy run is still in progress — skipping this tick."
    exit 0
  fi
fi

STATE_FILE=".deploy-state"          # last commit that fully, successfully deployed
FAILSTATE_FILE=".deploy-failstate"  # "<commit> <consecutive failure count>"
FAIL_LOG=".deploy-last-failure.log" # full output of the most recent failed run
BUILD_DIR="apps/cms/.next"
BUILD_BACKUP="apps/cms/.next.last-good"
MAX_RETRIES=2
# A migration whose up() contains DROP is refused below — unless the file
# itself carries this marker, added by a human who reviewed the drop.
DESTRUCTIVE_MARKER="payload-deploy:allow-destructive"

RUN_LOG="$(mktemp)"
log() { echo "$@" | tee -a "$RUN_LOG"; }

# On every exit — success, failure, or parked — snapshot this run's output
# into the live static site. nginx serves apps/web/current directly, so
# this makes the deploy's own log readable at /deploy-status.txt from any
# browser: the only observability channel available with no SSH access.
publish_status() {
  {
    echo "deploy.sh — last run finished $(date -u '+%Y-%m-%d %H:%M:%S') UTC"
    echo "checked-out commit:     $(git rev-parse HEAD 2>/dev/null || echo unknown)"
    echo "last successful deploy: $(cat "$STATE_FILE" 2>/dev/null || echo 'none recorded yet')"
    echo "----------------------------------------"
    tail -n 120 "$RUN_LOG" 2>/dev/null
    # A parked or already-up-to-date tick overwrites this file with its own
    # (boring) output — carry the most recent failure's detail along every
    # time, since with no SSH access this file is the only place it can be
    # read. Cleared on the next fully successful deploy.
    if [ -f "$FAIL_LOG" ]; then
      echo ""
      echo "======== most recent FAILED run (kept until a deploy succeeds) ========"
      tail -n 80 "$FAIL_LOG" 2>/dev/null
    fi
  } > "apps/web/current/deploy-status.txt" 2>/dev/null || true
  rm -f "$RUN_LOG" 2>/dev/null || true
}
trap publish_status EXIT

# Wraps long-running steps so a hang becomes a loud failure instead of a
# stuck process holding the lock forever. coreutils `timeout` is always
# present on the Linux server; the fallback is for dev-Mac testing only.
run_with_timeout() {
  local secs="$1"
  shift
  if command -v timeout >/dev/null 2>&1; then
    timeout "$secs" "$@"
  else
    "$@"
  fi
}

log "[deploy] Fetching latest..."
run_with_timeout 120 git fetch origin main 2>&1 | tee -a "$RUN_LOG"

# reset --hard instead of pull: the server never hand-edits tracked files,
# so whatever origin/main says is always the truth. This makes the deploy
# immune to the whole class of "local drift blocks the pull" failures that
# used to need per-file guards (package-lock.json rewritten by npm,
# next-env.d.ts rewritten by Next's dev/build modes, and whatever file
# would have been next). Untracked/ignored files — .env, media/, the
# dist dirs, the state files below — are untouched by reset.
git reset --hard origin/main 2>&1 | tee -a "$RUN_LOG"
AFTER=$(git rev-parse HEAD)

# What was actually last deployed *successfully* — not just "what did this
# run's git pull change." A run that fails partway never writes
# $STATE_FILE, so the next tick sees the same gap between $LAST_DEPLOYED
# and $AFTER and retries the whole sequence — instead of comparing against
# its own pre-pull commit (which would already equal AFTER, having nothing
# left to pull) and silently giving up forever.
LAST_DEPLOYED=$(cat "$STATE_FILE" 2>/dev/null || echo "")

if [ "$LAST_DEPLOYED" = "$AFTER" ]; then
  log "[deploy] Already up to date — nothing to deploy."
  exit 0
fi

# Circuit breaker — if this exact commit has already failed to deploy
# MAX_RETRIES times, stop retrying it every 5 minutes. Retrying a
# transient failure is exactly what we want; retrying a deterministically
# broken commit forever just means repeatedly restarting into a bad build
# and rolling back, every 5 minutes, indefinitely. Once a fix is pushed,
# $AFTER changes and this resets on its own.
PREV_FAIL_COMMIT=""
PREV_FAIL_COUNT=0
if [ -f "$FAILSTATE_FILE" ]; then
  read -r PREV_FAIL_COMMIT PREV_FAIL_COUNT < "$FAILSTATE_FILE"
fi
if [ "$AFTER" = "$PREV_FAIL_COMMIT" ] && [ "$PREV_FAIL_COUNT" -ge "$MAX_RETRIES" ]; then
  log "[deploy] PARKED: commit $AFTER has already failed $PREV_FAIL_COUNT time(s) — staying on the last known-good version ($LAST_DEPLOYED) until a new commit is pushed. See earlier runs' output for the failure reason."
  exit 0
fi

if [ -z "$LAST_DEPLOYED" ]; then
  log "[deploy] No prior successful deploy recorded — treating everything as changed."
  CHANGED=$(git ls-tree -r HEAD --name-only)
else
  CHANGED=$(git diff --name-only "$LAST_DEPLOYED" "$AFTER")
fi
log "[deploy] Changed files since last successful deploy:"
echo "$CHANGED" | sed 's/^/  /' | tee -a "$RUN_LOG"

# Records that this attempt at $AFTER failed, for the circuit breaker
# above, then exits non-zero. Every failure path below funnels through
# here so the retry-vs-park decision lives in one place.
record_failure_and_exit() {
  local attempt=1
  if [ "$AFTER" = "$PREV_FAIL_COMMIT" ]; then
    attempt=$((PREV_FAIL_COUNT + 1))
  fi
  echo "$AFTER $attempt" > "$FAILSTATE_FILE"
  {
    echo "failed run — $(date -u '+%Y-%m-%d %H:%M:%S') UTC — commit $AFTER (attempt $attempt of $MAX_RETRIES)"
    cat "$RUN_LOG" 2>/dev/null
  } > "$FAIL_LOG" 2>/dev/null || true
  if [ "$attempt" -ge "$MAX_RETRIES" ]; then
    log "[deploy] FAILED (attempt $attempt of $MAX_RETRIES) — parking on the last known-good version until a new commit is pushed."
  else
    log "[deploy] FAILED (attempt $attempt of $MAX_RETRIES) — will retry on the next cron tick."
  fi
  exit 1
}

# Anything that fails without an explicit handler below still gets
# recorded, so no failure mode can silently bypass the circuit breaker.
trap 'log "[deploy] Unexpected failure near line $LINENO — aborting this attempt."; record_failure_and_exit' ERR

if echo "$CHANGED" | grep -qE '(^|/)package(-lock)?\.json$'; then
  # `npm ci` (not `npm install`) — installs exactly what package-lock.json
  # says and never rewrites it (and reset --hard above clears any drift
  # regardless).
  log "[deploy] package.json/lockfile changed — running npm ci..."
  if ! run_with_timeout 900 npm ci 2>&1 | tee -a "$RUN_LOG"; then
    log "[deploy] npm ci failed — nothing has been touched."
    record_failure_and_exit
  fi
fi

if echo "$CHANGED" | grep -q '^apps/cms/src/migrations/'; then
  # Refuse to auto-apply a migration that drops anything — unless the file
  # carries $DESTRUCTIVE_MARKER, placed there by a human who reviewed it.
  # An additive migration retried after a partial failure is, at worst, a
  # no-op the second time — Payload's own migration ledger skips whatever
  # already ran. A destructive one that turns out to be wrong can't be
  # undone by reverting the commit; the data is just gone. Only the `up()`
  # direction is scanned — `down()` legitimately contains DROPs.
  NEW_MIGRATIONS=$(echo "$CHANGED" | grep '^apps/cms/src/migrations/.*\.ts$' || true)
  DESTRUCTIVE_FOUND=false
  for f in $NEW_MIGRATIONS; do
    [ -f "$f" ] || continue
    if grep -q "$DESTRUCTIVE_MARKER" "$f"; then
      log "[deploy] $f contains destructive statements but carries the $DESTRUCTIVE_MARKER marker — allowing."
      continue
    fi
    if awk '/^export async function up/,/^export async function down/' "$f" | grep -qiE '\bDROP\b'; then
      log "[deploy] $f's up() contains a DROP and has no $DESTRUCTIVE_MARKER marker — refusing to auto-apply."
      DESTRUCTIVE_FOUND=true
    fi
  done
  if [ "$DESTRUCTIVE_FOUND" = true ]; then
    log "[deploy] One or more new migrations look destructive. Stopping here — nothing has been touched. Review the migration; if the drop is intended, add a '$DESTRUCTIVE_MARKER' comment to the file and push."
    record_failure_and_exit
  fi

  # --- Payload dev-mode ledger repair ---------------------------------
  # Payload's migration ledger can carry a "dev mode" marker (a row with
  # batch = -1), left behind whenever `next dev` runs against this
  # database (e.g. during initial server setup). While that marker
  # exists, `payload migrate` stops at an interactive confirmation no
  # cron run can ever answer — the root cause of every database deploy
  # on this server silently failing or hanging, before any other logic
  # gets a chance to run. Confirmed from the installed source
  # (@payloadcms/drizzle/dist/migrate.js): accepting the prompt does NOT
  # wipe anything — it only ignores the marker in memory and runs
  # migrations not yet recorded by name — and it never deletes the
  # marker, so it would re-prompt forever. The durable fix is repairing
  # the ledger: remove the marker, and backfill rows for the early
  # migrations whose schema is provably already present (each INSERT is
  # gated on its migration's own sentinel table existing via
  # to_regclass, and on the row not already existing — safe to run any
  # number of times, a no-op on a healthy ledger).
  DB_URI="$(grep -m1 '^DATABASE_URI=' apps/cms/.env 2>/dev/null | cut -d= -f2- | sed -e "s/^[\"']//" -e "s/[\"']\$//" || true)"
  if [ -n "$DB_URI" ] && command -v psql >/dev/null 2>&1; then
    DEV_ROWS="$(psql "$DB_URI" -tA -c "SELECT count(*) FROM payload_migrations WHERE batch = -1;" 2>/dev/null || echo "")"
    if [ -n "$DEV_ROWS" ] && [ "$DEV_ROWS" != "0" ]; then
      log "[deploy] Migration ledger carries a dev-mode marker — repairing so migrate can run non-interactively."
      log "[deploy] Ledger before repair:"
      psql "$DB_URI" -tA -c "SELECT name || ' (batch ' || batch || ')' FROM payload_migrations ORDER BY id;" 2>&1 | tee -a "$RUN_LOG" || true
      psql "$DB_URI" -v ON_ERROR_STOP=1 2>&1 <<'SQL' | tee -a "$RUN_LOG" || true
BEGIN;
DELETE FROM payload_migrations WHERE batch = -1;
INSERT INTO payload_migrations (name, batch)
SELECT '20260710_154727_initial_schema', 1
WHERE to_regclass('public.users') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM payload_migrations WHERE name = '20260710_154727_initial_schema');
INSERT INTO payload_migrations (name, batch)
SELECT '20260714_040659_add_media_folders', 1
WHERE to_regclass('public.payload_folders') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM payload_migrations WHERE name = '20260714_040659_add_media_folders');
INSERT INTO payload_migrations (name, batch)
SELECT '20260715_163354_add_opponents', 1
WHERE to_regclass('public.opponents') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM payload_migrations WHERE name = '20260715_163354_add_opponents');
COMMIT;
SQL
      log "[deploy] Ledger after repair:"
      psql "$DB_URI" -tA -c "SELECT name || ' (batch ' || batch || ')' FROM payload_migrations ORDER BY id;" 2>&1 | tee -a "$RUN_LOG" || true
    fi
  else
    log "[deploy] (psql or DATABASE_URI unavailable — skipping ledger inspection)"
  fi

  log "[deploy] New migration(s) detected — applying..."
  if ! run_with_timeout 600 npm run migrate --workspace=apps/cms 2>&1 | tee -a "$RUN_LOG"; then
    log "[deploy] Migration failed — the running CMS was never touched and keeps serving. Payload's migration ledger means a partial batch is not re-applied twice."
    record_failure_and_exit
  fi
fi

CMS_CHANGED=false
echo "$CHANGED" | grep -q '^apps/cms/' && CMS_CHANGED=true

WEB_CHANGED=false
echo "$CHANGED" | grep -q '^apps/web/' && WEB_CHANGED=true

if [ "$CMS_CHANGED" = true ]; then
  # Fail fast with a precise message if cron's environment can't restart
  # the CMS — this exact gap (pm2 findable interactively but not from
  # cron's PATH) is invisible without SSH unless the log says it plainly.
  if ! command -v pm2 >/dev/null 2>&1; then
    log "[deploy] pm2 is not on PATH ($PATH) — cron's environment cannot restart the CMS. Fix: install pm2 globally for the cron user, or set PATH in the crontab."
    record_failure_and_exit
  fi

  # Preserve whatever's currently running as a rollback target before
  # overwriting it — a rename, not a copy, so this is cheap even though
  # .next can be large. Discarded below on success, restored on failure.
  if [ -d "$BUILD_DIR" ]; then
    rm -rf "$BUILD_BACKUP"
    mv "$BUILD_DIR" "$BUILD_BACKUP"
  fi

  log "[deploy] apps/cms changed — rebuilding and restarting..."
  BUILD_OK=true
  run_with_timeout 900 npm run build --workspace=apps/cms 2>&1 | tee -a "$RUN_LOG" || BUILD_OK=false

  CMS_HEALTHY=false
  if [ "$BUILD_OK" = true ]; then
    # `pm2 restart` replaces the running process in place — it does not
    # keep the old one alive as a fallback. The backup above and the
    # rollback below exist specifically because of that: a build that
    # compiles fine can still crash on boot, and without this, that
    # failure mode would leave the broken process running with nothing to
    # fall back to.
    # 200>&- closes the flock fd for pm2's process tree: if pm2 ever has
    # to spawn its daemon here, an inherited lock fd would be held by that
    # daemon forever, silently skipping every future deploy tick.
    if ! run_with_timeout 60 pm2 restart athletics-cms 200>&- 2>&1 | tee -a "$RUN_LOG"; then
      log "[deploy] pm2 restart itself failed — the old process was never stopped and keeps serving. Restoring the previous build on disk to match it."
      rm -rf "$BUILD_DIR"
      if [ -d "$BUILD_BACKUP" ]; then
        mv "$BUILD_BACKUP" "$BUILD_DIR"
      fi
      record_failure_and_exit
    fi
    log "[deploy] Waiting for the CMS to come back up..."
    for i in $(seq 1 15); do
      CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/api/sports || true)
      if [ "$CODE" = "200" ]; then
        log "[deploy] CMS is back up."
        CMS_HEALTHY=true
        break
      fi
      sleep 1
    done
  fi

  if [ "$CMS_HEALTHY" = true ]; then
    rm -rf "$BUILD_BACKUP"
  else
    log "[deploy] New build did not come up healthy — rolling back to the last known-good version..."
    rm -rf "$BUILD_DIR"
    if [ -d "$BUILD_BACKUP" ]; then
      mv "$BUILD_BACKUP" "$BUILD_DIR"
      run_with_timeout 60 pm2 restart athletics-cms 200>&- 2>&1 | tee -a "$RUN_LOG" || true
      ROLLBACK_HEALTHY=false
      for i in $(seq 1 15); do
        CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/api/sports || true)
        if [ "$CODE" = "200" ]; then
          ROLLBACK_HEALTHY=true
          break
        fi
        sleep 1
      done
      if [ "$ROLLBACK_HEALTHY" = true ]; then
        log "[deploy] Rolled back successfully — still serving the last known-good version. Commit $AFTER was NOT deployed."
      else
        log "[deploy] CRITICAL: the rollback build also failed its health check — this isn't a bad-commit problem, something else is wrong (database connectivity, disk space, etc.)."
      fi
    else
      log "[deploy] No previous build available to roll back to (this looks like the very first deploy) — CMS may be down."
    fi
    # Regardless of whether the rollback itself succeeded, this commit did
    # not deploy — keep the working tree in sync with whatever's actually
    # running so the next tick's diff is computed correctly.
    if [ -n "$LAST_DEPLOYED" ]; then
      git reset --hard "$LAST_DEPLOYED"
    fi
    record_failure_and_exit
  fi
fi

if [ "$WEB_CHANGED" = true ] || [ "$CMS_CHANGED" = true ]; then
  # Rebuild the static site if its own code changed, or if the CMS changed
  # underneath it (safer to rebuild than assume the API shape it consumes
  # is unaffected) — zero-downtime either way via deploy-build.sh.
  log "[deploy] Rebuilding static site..."
  if ! run_with_timeout 900 ./apps/web/deploy-build.sh 2>&1 | tee -a "$RUN_LOG"; then
    log "[deploy] Static site rebuild failed — the CMS (if it changed) is already updated and healthy; the site keeps serving its previous build. Will retry next tick."
    record_failure_and_exit
  fi
fi

rm -f "$FAILSTATE_FILE" "$FAIL_LOG"
echo "$AFTER" > "$STATE_FILE"
log "[deploy] Done."
