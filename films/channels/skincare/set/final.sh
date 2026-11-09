#!/bin/bash
# Final tier for a Skin Sense episode in the new look: 1080x1920 at 30 fps (plain 2D scene), studio score and effects, assemble, QA.
#   films/channels/skincare/set/final.sh ep05
set -euo pipefail
cd "$(dirname "$0")/../../../.."
E=$1; D=films/channels/skincare/$E; N=${E#ep}
export PLAYWRIGHT_DIR="${PLAYWRIGHT_DIR:-$(dirname "$(npm root -g)")}" CHROMIUM="${CHROMIUM:-/opt/pw-browsers/chromium}"
python3 -I films/channels/skincare/set/build_ep.py $E >/dev/null
python3 -I films/channels/skincare/set/make_sheet.py $E
python3 -I kits/cinema/studio/render.py --root $D $D/sheet.json $D/audio | tail -4
node kits/cinema/film/render.mjs --film $D --tier final --plain
node kits/cinema/film/render.mjs --film $D --tier final --plain --assemble --audio $D/audio/mix.m4a
python3 -I kits/cinema/film/qa.py $D || true
ls -la $D/out
