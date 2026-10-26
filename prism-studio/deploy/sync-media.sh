#!/bin/bash
# Copy the rendered episodes (and compilations) from the films repo to the server's films mirror, keeping the
# films/channels/<ch>/epNN/out paths the studio's "films:" media keys point at. Only finished files travel.
#   deploy/sync-media.sh user@server:/srv/prism-studio/films-mirror
set -eu
DEST=${1:?usage: deploy/sync-media.sh user@host:/path/to/films-mirror}
cd "$(dirname "$0")/../.."
rsync -av --prune-empty-dirs \
  --include='films/' --include='films/channels/' --include='films/channels/*/' --include='films/channels/*/ep*/' \
  --include='films/channels/*/ep*/out/***' --include='films/channels/*/compilations/***' --exclude='*' \
  ./ "$DEST/"
echo "synced. Then on the server: docker compose --env-file .env.production run --rm app import"
