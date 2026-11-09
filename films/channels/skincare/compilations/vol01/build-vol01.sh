#!/bin/bash
# Skin Sense Season 1 long video (vol01): 16:9, 2560x1440, ivory look. Run ONLY when all six finals exist:
#   films/channels/skincare/ep01..ep06/out/skin-sense-00N-9x16.mp4 (1080x1920, delivered, -14 LUFS) and the matching .jpg posters.
# Chapters: ep01..ep06 with a 2 s "Next" bridge card between episodes; 4 s intro card; 8 s outro (right half clear for end-screen elements).
set -euo pipefail
cd "$(dirname "$0")/../../../../.."
export PLAYWRIGHT_DIR="${PLAYWRIGHT_DIR:-$(dirname "$(npm root -g)")}" CHROMIUM="${CHROMIUM:-/opt/pw-browsers/chromium}"
for n in 1 2 3 4 5 6; do f="films/channels/skincare/ep0$n/out/skin-sense-00$n-9x16.mp4"; [ -f "$f" ] || { echo "missing final: $f" >&2; exit 2; }; done
node kits/cinema/film/compilation.mjs --channel films/channels/skincare --theme films/channels/skincare/theme-ivory.json \
  --episodes ep01,ep02,ep03,ep04,ep05,ep06 --name vol01 --title "The organ you live inside" --thumb "Skin Sense: Season 1" \
  --bridge 2 --card-bg films/channels/skincare/library/skin-layers-section-a.webp --max-sources 3 --max-desc 5000 "$@"      # add --cards-only to draw only the cards and the thumbnail
