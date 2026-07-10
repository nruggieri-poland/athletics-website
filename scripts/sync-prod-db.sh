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
#
# PROD_DB_HOST is intentionally NOT defaulted/hardcoded here — the server's
# address doesn't belong in git history (found in a security audit: it was
# previously hardcoded here as `root@<real-ip>`, meaning production's login
# and IP were sitting in plaintext for anyone with repo read access, and
# every developer's routine `npm run dev` depended on a full-privilege root
# key). Set it once in your own shell profile instead — see
# docs/DEPLOY.md's "Local database sync" section for the one-time setup,
# which also uses a read-only Postgres role and a forced-command-restricted
# key, not root, so this can't be used to write/alter/drop anything even if
# the key ever leaked.
if [ -z "${PROD_DB_HOST:-}" ]; then
  echo "[sync-db] PROD_DB_HOST is not set — skipping sync, using existing local data."
  echo "[sync-db] Set it in your shell profile (e.g. ~/.zshrc): export PROD_DB_HOST=dbsync@<server>"
  echo "[sync-db] See docs/DEPLOY.md's 'Local database sync' section for the one-time server-side setup."
  exit 0
fi

DROPLET_HOST="$PROD_DB_HOST"
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

# Only force non-interactive mode when there's no real terminal to prompt
# through (e.g. this script gets run as a background process, not typed
# into a shell directly) — otherwise let SSH ask for a passphrase/password
# normally, same as it would for any other ssh command.
if [ -t 0 ]; then
  SSH_OPTS=(-o ConnectTimeout=15)
else
  SSH_OPTS=(-o ConnectTimeout=5 -o BatchMode=yes)
fi

TMP_DUMP=$(mktemp)
trap 'rm -f "$TMP_DUMP"' EXIT

set +e
ssh "${SSH_OPTS[@]}" "$DROPLET_HOST" "pg_dump --clean --if-exists --no-owner --no-privileges athletics" > "$TMP_DUMP"
SSH_EXIT=$?
set -e

if [ "$SSH_EXIT" -ne 0 ]; then
  echo "[sync-db] Could not pull from production (ssh exited $SSH_EXIT) — skipping, local data unchanged."
  echo "[sync-db] If your key needs a passphrase, try \`ssh-add ~/.ssh/id_ed25519\` once so it's cached, or run \`npm run sync:prod-db\` directly in a terminal so ssh can prompt you."
  exit 0
fi

if [ ! -s "$TMP_DUMP" ]; then
  echo "[sync-db] Received an empty dump from production — skipping restore."
  exit 0
fi

set +e
psql "$LOCAL_DB" --single-transaction -v ON_ERROR_STOP=1 -q < "$TMP_DUMP"
PSQL_EXIT=$?
set -e

if [ "$PSQL_EXIT" -ne 0 ]; then
  echo "[sync-db] Restore into local database failed (psql exited $PSQL_EXIT)."
  exit 1
fi

date +%s > "$MARKER_FILE"
echo "[sync-db] Done — local '$LOCAL_DB' now matches production."
