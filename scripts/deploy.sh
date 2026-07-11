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

echo "[deploy] Fetching latest..."
BEFORE=$(git rev-parse HEAD)
git pull --ff-only
AFTER=$(git rev-parse HEAD)

if [ "$BEFORE" = "$AFTER" ]; then
  echo "[deploy] Already up to date — nothing to deploy."
  exit 0
fi

CHANGED=$(git diff --name-only "$BEFORE" "$AFTER")
echo "[deploy] Changed files since last deploy:"
echo "$CHANGED" | sed 's/^/  /'

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
  echo "[deploy] New migration(s) detected — applying..."
  npm run migrate --workspace=apps/cms
fi

CMS_CHANGED=false
echo "$CHANGED" | grep -q '^apps/cms/' && CMS_CHANGED=true

WEB_CHANGED=false
echo "$CHANGED" | grep -q '^apps/web/' && WEB_CHANGED=true

if [ "$CMS_CHANGED" = true ]; then
  echo "[deploy] apps/cms changed — rebuilding and restarting..."
  npm run build --workspace=apps/cms
  pm2 restart athletics-cms
  echo "[deploy] Waiting for the CMS to come back up..."
  CMS_HEALTHY=false
  for i in $(seq 1 15); do
    CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/api/sports || true)
    if [ "$CODE" = "200" ]; then
      echo "[deploy] CMS is back up."
      CMS_HEALTHY=true
      break
    fi
    sleep 1
  done
  # Without this, a CMS that crash-loops on boot (bad env var, broken
  # migration, a runtime error not caught at build time) would leave the
  # deploy silently reporting success — PM2's autorestart keeps bouncing
  # the broken process, nginx keeps proxying to it, admins see 502s, and
  # nothing (not this script's exit code, not the GitHub Actions run that
  # triggered it) signals that anything went wrong.
  if [ "$CMS_HEALTHY" != true ]; then
    echo "[deploy] CMS did not come back up after restart — check \`pm2 logs athletics-cms\`."
    exit 1
  fi
fi

if [ "$WEB_CHANGED" = true ] || [ "$CMS_CHANGED" = true ]; then
  # Rebuild the static site if its own code changed, or if the CMS changed
  # underneath it (safer to rebuild than assume the API shape it consumes
  # is unaffected) — zero-downtime either way via deploy-build.sh.
  echo "[deploy] Rebuilding static site..."
  ./apps/web/deploy-build.sh
fi

echo "[deploy] Done."
