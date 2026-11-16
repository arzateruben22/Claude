#!/bin/bash
# stills_v4.sh <n>: three clean cover stills (2160x2200): a wide beach shot with the figure, the part's key visual, and a Moon close-up. Into ep<12+n>/out/cover-stills/.
cd /home/user/claude/films/channels/space; N=$1; O=long01/out; EP=ep$((12+N))
SPEC=$(python3 - <<PY
import json
t=json.load(open("$O/v4-part$N.json")); b=t["beats"]; ap=[x for x in b if x["kind"]=="approach"]; rest=[x for x in b if x["kind"]!="approach"]
ts=[f"{min(1.2, t['dur']/10):.1f}:beach"]
key=[x for x in rest if x["kind"] not in ("grow","pull")] or rest
if key: ts.append(f"{(key[0]['t0']+key[0]['t1'])/2:.1f}:moon")
gr=[x for x in b if x["kind"] in ("grow","pull")]
ts.append(f"{(gr[-1]['t0']+gr[-1]['t1'])/2+1.0:.1f}:moon" if gr else (f"{ap[0]['t1']+0.5:.1f}:moon" if ap else "5.0:moon"))
print(",".join(ts[:3]))
PY
)
export PLAYWRIGHT_DIR=$(dirname $(npm root -g)) CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome
rm -rf $EP/out/cover-stills; STILLS=$SPEC STILLDIR=$EP/out/cover-stills node season3/render_s3.mjs $O/v4-part$N.json /tmp/pl/dummy$N.mp4 2160 3840 30 2>&1 | tail -3
