#!/bin/bash
# Season 3 v2 clean stills (no captions, no hook): set/s3_stills.sh epNN t1,t2,t3   (scene seconds; run from the repo root)
set -euo pipefail
E=$1; T=$2; D=films/channels/skincare; S=$D/${E}v2s
export PLAYWRIGHT_DIR="${PLAYWRIGHT_DIR:-$(dirname "$(npm root -g)")}" CHROMIUM="${CHROMIUM:-/opt/pw-browsers/chromium}"
rm -rf $S; mkdir -p $S; cp $D/${E}v2/film.json $D/${E}v2/scene.mjs $S/
python3 - <<PY
import json; e=json.load(open("$D/${E}v2/episode.json")); e["caps"]=[]; e.pop("hook",None); json.dump(e,open("$S/episode.json","w"))
PY
node kits/cinema/film/render.mjs --film $S --tier final --plain --size 1440x2560 --times $T --build /tmp/claude-0/st_$E --fresh --share-cpu 2>&1 | grep -E "rendered|ERROR"
mkdir -p $D/${E}v2/out/stills; i=1; for f in $(find /tmp/claude-0/st_$E -name "*.png" | sort); do cp $f $D/${E}v2/out/stills/skin-sense-0${E#ep}-still-$i.png; i=$((i+1)); done
rm -rf $S
