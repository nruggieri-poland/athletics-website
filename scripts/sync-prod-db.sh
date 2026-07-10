#!/bin/bash
# Pulls a fresh snapshot of the production database down into the local dev
# database, so local development has realistic data without ever pointing
# dev at the live database directly (that stays firewalled to localhost on
# the server, on purpose — see docs/DEPLOY.md's Security checklist). Media
# uploads are deliberately NOT synced — those get edited live in the CMS,
# same as any other content.
#
# Runs automatically before `npm run dev` in apps/cms (see its package.json
# "predev" script) and skips itself if it already ran recently, so starting
# the dev server repeatedly in one day doesn't repeatedly re-download and
# restore the whole database. Force a fresh pull with FORCE_SYNC=1.
set -euo pipefail

DROPLET_HOST="${PROD_DB_HOST:-root@134.209.213.16}"
LOCAL_DB="${LOCAL_DB_NAME:-athletics}"
MARKER_FILE="$HOME/.athletics-db-last-sync"
MAX_AGE_HOURS="${SYNC_MAX_AGE_HOURS:-24}"

if [ "${FORCE_SYNC:-0}" != "1" ] && [ -f "$MARKER_FILE" ]; then
  LAST_SYNC=$(cat "$MARKER_FILE")
  NOW=$(date +%s)
  AGE_HOURS=$(( (NOW - LAST_SYNC) / 3600 ))
  if [ "$AGE_HOURS" -lt "$MAX_AGE_HOURS" ]; then
    echo "[sync-db] Local DB was synced from production ${AGE_HOURS}h ago (< ${MAX_AGE_HOURS}h) — skipping. Force with FORCE_SYNC=1."
    exit 0
  fi
fi

echo "[sync-db] Pulling a fresh snapshot from production ($DROPLET_HOST)..."

if ! ssh -o ConnectTimeout=5 -o BatchMode=yes "$DROPLET_HOST" true 2>/dev/null; then
  echo "[sync-db] Could not reach $DROPLET_HOST over SSH — skipping sync, using existing local data."
  exit 0
fi

ssh "$DROPLET_HOST" "pg_dump --clean --if-exists --no-owner --no-privileges athletics" \
  | psql "$LOCAL_DB" --single-transaction -v ON_ERROR_STOP=1 -q

date +%s > "$MARKER_FILE"
echo "[sync-db] Done — local '$LOCAL_DB' now matches production."
