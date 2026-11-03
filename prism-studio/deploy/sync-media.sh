#!/bin/bash
# Copy the rendered episodes (and compilations) from the films repo to the server's films mirror, keeping the
# films/channels/<ch>/epNN/out paths the studio's "films:" media keys point at. Only finished files travel, plus what the
# import reads beside them (script.md, claims.json, film.json, build/qa-delivery.json), so titles, captions, sources
# and QA arrive too. (A hosted studio with no SSH: npm run media:push, docs/LAUNCH-CHECKLIST.md.)
#   deploy/sync-media.sh user@server:/srv/prism-studio/films-mirror
set -eu
DEST=${1:?usage: deploy/sync-media.sh user@host:/path/to/films-mirror}
cd "$(dirname "$0")/../.."
rsync -av --prune-empty-dirs \
  --include='films/' --include='films/channels/' --include='films/channels/*/' --include='films/channels/*/ep*/' \
  --include='films/channels/*/ep*/out/***' --include='films/channels/*/compilations/***' \
  --include='films/channels/*/ep*/script.md' --include='films/channels/*/ep*/claims.json' --include='films/channels/*/ep*/film.json' \
  --include='films/channels/*/ep*/build/' --include='films/channels/*/ep*/build/qa-delivery.json' --exclude='*' \
  ./ "$DEST/"
echo "synced. Then on the server: docker compose --env-file .env.production run --rm app import"
