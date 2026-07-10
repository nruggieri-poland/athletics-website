#!/bin/bash
# Zero-downtime build+deploy for the static site. Building straight into the
# directory nginx serves from (the old approach) meant nginx briefly served
# an empty/half-written directory on every rebuild — Astro clears its output
# dir at the start of each build. This alternates between two directories
# (dist-blue / dist-green), builds into whichever one ISN'T currently live,
# then atomically flips the `current` symlink once the build succeeds.
# nginx's root points at `current`, never at dist-blue/dist-green directly.
set -euo pipefail
cd "$(dirname "$0")"

BLUE="dist-blue"
GREEN="dist-green"
LIVE_LINK="current"

if [ -L "$LIVE_LINK" ] && [ "$(readlink "$LIVE_LINK")" = "$BLUE" ]; then
  TARGET="$GREEN"
else
  TARGET="$BLUE"
fi

echo "[deploy] Building into $TARGET..."
rm -rf "$TARGET"
npx astro build --outDir "$TARGET"

echo "[deploy] Swapping $LIVE_LINK -> $TARGET..."
ln -sfn "$TARGET" "$LIVE_LINK"

echo "[deploy] Done. Live: $TARGET"
