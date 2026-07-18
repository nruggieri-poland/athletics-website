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
# Run from anywhere on the server: ./scripts/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

STATE_FILE=".deploy-state"          # last commit that fully, successfully deployed
FAILSTATE_FILE=".deploy-failstate"  # "<commit> <consecutive failure count>"
BUILD_DIR="apps/cms/.next"
BUILD_BACKUP="apps/cms/.next.last-good"
MAX_RETRIES=2

echo "[deploy] Fetching latest..."

# `npm ci` further down is supposed to never touch package-lock.json, but
# in practice it still does on this server: the lockfile was generated on
# a Mac, and npm resolving/re-verifying the Linux-specific optional
# packages (esbuild, sharp, lightningcss) during install can rewrite
# those platform-specific entries anyway, leaving a local diff. That diff
# then blocks the next `git pull --ff-only` with "local changes would be
# overwritten." Nothing on this server ever hand-edits package-lock.json,
# so it's always safe to discard whatever's there before pulling — the
# committed version is the only one that matters.
git checkout -- package-lock.json 2>/dev/null || true

# Next.js rewrites this file to match whichever mode last built it (`next
# dev` and `next build` reference different generated-type paths) — same
# "harmless local drift blocks the pull" problem as package-lock.json
# above, for the same reason: nothing here should ever hand-edit it.
git checkout -- apps/cms/next-env.d.ts 2>/dev/null || true

git pull --ff-only
AFTER=$(git rev-parse HEAD)

# What was actually last deployed *successfully* — not just "what did this
# run's git pull change." A run that pulls a new commit but then fails
# partway (a build OOM, a migration hiccup) never reaches the bottom of
# this script, so $STATE_FILE never gets written. The next cron tick then
# sees the same gap between $LAST_DEPLOYED and $AFTER and retries the
# whole sequence again — instead of comparing against its own BEFORE
# (which would already equal AFTER, having nothing left to pull) and
# silently giving up forever.
LAST_DEPLOYED=$(cat "$STATE_FILE" 2>/dev/null || echo "")

if [ "$LAST_DEPLOYED" = "$AFTER" ]; then
  echo "[deploy] Already up to date — nothing to deploy."
  exit 0
fi

# Circuit breaker — if this exact commit has already failed to deploy
# MAX_RETRIES times, stop retrying it every 5 minutes. Retrying a
# transient failure (an OOM'd build, a flaky migration) is exactly what
# we want; retrying a deterministically broken commit forever just means
# repeatedly restarting into a bad build and rolling back, every 5
# minutes, indefinitely — a real (if brief) availability cost for a
# commit that was never going to succeed no matter how many times it's
# retried. Once a fix is pushed, $AFTER changes and this resets on its own.
PREV_FAIL_COMMIT=""
PREV_FAIL_COUNT=0
if [ -f "$FAILSTATE_FILE" ]; then
  read -r PREV_FAIL_COMMIT PREV_FAIL_COUNT < "$FAILSTATE_FILE"
fi
if [ "$AFTER" = "$PREV_FAIL_COMMIT" ] && [ "$PREV_FAIL_COUNT" -ge "$MAX_RETRIES" ]; then
  echo "[deploy] Commit $AFTER has already failed $PREV_FAIL_COUNT time(s) — parking on the last known-good version ($LAST_DEPLOYED) until a new commit is pushed. Check \`pm2 logs athletics-cms\` and this log's earlier runs for why it failed."
  exit 0
fi

if [ -z "$LAST_DEPLOYED" ]; then
  echo "[deploy] No prior successful deploy recorded — treating everything as changed."
  CHANGED=$(git ls-tree -r HEAD --name-only)
else
  CHANGED=$(git diff --name-only "$LAST_DEPLOYED" "$AFTER")
fi
echo "[deploy] Changed files since last successful deploy:"
echo "$CHANGED" | sed 's/^/  /'

# Records that this attempt at $AFTER failed, for the circuit breaker
# above, then exits non-zero. Every failure path below calls this instead
# of a bare `exit 1` so the retry-vs-give-up decision stays in one place.
record_failure_and_exit() {
  if [ "$AFTER" = "$PREV_FAIL_COMMIT" ]; then
    echo "$AFTER $((PREV_FAIL_COUNT + 1))" > "$FAILSTATE_FILE"
  else
    echo "$AFTER 1" > "$FAILSTATE_FILE"
  fi
  exit 1
}

if echo "$CHANGED" | grep -qE '(^|/)package(-lock)?\.json$'; then
  # `npm ci` (not `npm install`) — installs exactly what package-lock.json
  # says and never rewrites it. `npm install` can regenerate lockfile
  # metadata slightly differently depending on the exact npm version, which
  # is what caused a real deploy to fail here: the server's npm produced a
  # lockfile that differed from git's, so the next `git pull --ff-only`
  # refused to overwrite those "local changes."
  echo "[deploy] package.json/lockfile changed — running npm ci..."
  npm ci
fi

if echo "$CHANGED" | grep -q '^apps/cms/src/migrations/'; then
  # Refuse to auto-apply a migration that drops anything. An additive
  # migration retried after a partial failure is, at worst, a no-op the
  # second time — Payload's own migration ledger skips whatever already
  # ran. A destructive one that turns out to be wrong can't be undone by
  # reverting the commit; the data is just gone. That one case needs a
  # human to look at it on purpose, not an unattended cron job deciding
  # for them. Only the `up()` direction is scanned — `down()` legitimately
  # contains DROPs to undo what `up()` created.
  NEW_MIGRATIONS=$(echo "$CHANGED" | grep '^apps/cms/src/migrations/.*\.ts$' || true)
  DESTRUCTIVE_FOUND=false
  for f in $NEW_MIGRATIONS; do
    if [ -f "$f" ] && awk '/^export async function up/,/^export async function down/' "$f" | grep -qiE '\bDROP\b'; then
      echo "[deploy] $f's up() contains a DROP — refusing to auto-apply."
      DESTRUCTIVE_FOUND=true
    fi
  done
  if [ "$DESTRUCTIVE_FOUND" = true ]; then
    echo "[deploy] One or more new migrations look destructive. Stopping here — nothing has been touched. Apply it by hand once you've confirmed it's safe, or push a follow-up commit that removes the DROP."
    record_failure_and_exit
  fi

  echo "[deploy] New migration(s) detected — applying..."
  npm run migrate --workspace=apps/cms
fi

CMS_CHANGED=false
echo "$CHANGED" | grep -q '^apps/cms/' && CMS_CHANGED=true

WEB_CHANGED=false
echo "$CHANGED" | grep -q '^apps/web/' && WEB_CHANGED=true

if [ "$CMS_CHANGED" = true ]; then
  # Preserve whatever's currently running as a rollback target before
  # overwriting it — a rename, not a copy, so this is cheap even though
  # .next can be large. Only ever updated here, right before a build that
  # might fail; discarded below on success, restored on failure.
  if [ -d "$BUILD_DIR" ]; then
    rm -rf "$BUILD_BACKUP"
    mv "$BUILD_DIR" "$BUILD_BACKUP"
  fi

  echo "[deploy] apps/cms changed — rebuilding and restarting..."
  BUILD_OK=true
  npm run build --workspace=apps/cms || BUILD_OK=false

  CMS_HEALTHY=false
  if [ "$BUILD_OK" = true ]; then
    # `pm2 restart` replaces the running process in place — it does not
    # keep the old one alive as a fallback. Everything above (the backup)
    # and below (the rollback) exists specifically because of that: a
    # build that compiles fine can still crash on boot (a bad env var, a
    # runtime-only config error), and without this, that failure mode
    # would leave the broken process running with nothing to fall back to.
    pm2 restart athletics-cms
    echo "[deploy] Waiting for the CMS to come back up..."
    for i in $(seq 1 15); do
      CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/api/sports || true)
      if [ "$CODE" = "200" ]; then
        echo "[deploy] CMS is back up."
        CMS_HEALTHY=true
        break
      fi
      sleep 1
    done
  fi

  if [ "$CMS_HEALTHY" = true ]; then
    rm -rf "$BUILD_BACKUP"
  else
    echo "[deploy] New build did not come up healthy — rolling back to the last known-good version..."
    rm -rf "$BUILD_DIR"
    if [ -d "$BUILD_BACKUP" ]; then
      mv "$BUILD_BACKUP" "$BUILD_DIR"
      pm2 restart athletics-cms
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
        echo "[deploy] Rolled back successfully — still serving the last known-good version. Commit $AFTER was NOT deployed; check \`pm2 logs athletics-cms\` for why it failed."
      else
        echo "[deploy] CRITICAL: the rollback build also failed its health check — this isn't a bad-commit problem, something else is wrong (database connectivity, disk space, etc). Manual check needed: \`pm2 logs athletics-cms\`."
      fi
    else
      echo "[deploy] No previous build available to roll back to (this looks like the very first deploy) — CMS may be down. Manual check needed: \`pm2 logs athletics-cms\`."
    fi
    # Regardless of whether the rollback itself succeeded, this commit
    # did not deploy — keep the working tree in sync with whatever's
    # actually running so the next tick's diff is computed correctly.
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
  echo "[deploy] Rebuilding static site..."
  ./apps/web/deploy-build.sh
fi

rm -f "$FAILSTATE_FILE"
echo "$AFTER" > "$STATE_FILE"
echo "[deploy] Done."
