#!/bin/bash
# Skin Sense Season 2 long video (vol02): 16:9, 2560x1440, ivory look. Run ONLY when all six finals exist:
#   films/channels/skincare/ep01..ep06/out/skin-sense-00N-9x16.mp4 (1080x1920, delivered, -14 LUFS) and the matching .jpg posters.
# Narrated cards (--narration): a hook of about 15 s, a voiced bridge (6-9 s) before each episode, a finale with one subscribe line, then the 8 s end card. Voices: set/long_voice.py.
set -euo pipefail
cd "$(dirname "$0")/../../../../.."
export PLAYWRIGHT_DIR="${PLAYWRIGHT_DIR:-$(dirname "$(npm root -g)")}" CHROMIUM="${CHROMIUM:-/opt/pw-browsers/chromium}"
for n in 07 08 09 10 11 12; do f="films/channels/skincare/ep$n/out/skin-sense-0$n-9x16.mp4"; [ -f "$f" ] || { echo "missing final: $f" >&2; exit 2; }; done
node kits/cinema/film/compilation.mjs --channel films/channels/skincare --theme films/channels/skincare/theme-ivory.json \
  --episodes ep07,ep08,ep09,ep10,ep11,ep12 --name vol02 --title "What your skin does" --thumb "Skin Sense: Season 2" \
  --bridge 2 --card-bg films/channels/skincare/ep11/art/s2e05-02.webp --season 2 --ai-visuals --promise "How your skin works, with the evidence on the screen." --cut-cta --keep-cta ep10 --narration films/channels/skincare/compilations/vol02/voice --max-sources 3 --max-desc 5000 "$@"      # add --cards-only to draw only the cards and the thumbnail
