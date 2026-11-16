#!/bin/bash
# finish_part_v4.sh <n>: after render_v4.sh: mix both cuts + QA (mix_v4.sh), then package into ep<12+n>, 2-3 clean cover stills (2160x2200), clean up the pictures, commit and push.
cd /home/user/claude/films/channels/space; N=$1; O=long01/out; EP=ep$((12+N))
season3/mix_v4.sh $N follow > $O/v4-part$N-mixA.log 2>&1 &
season3/mix_v4.sh $N yt > $O/v4-part$N-mixB.log 2>&1 &
wait; cat $O/v4-part$N-mixA.log $O/v4-part$N-mixB.log | cut -c1-170
if grep -q "QA FAIL" $O/v4-part$N-qa.txt $O/v4-part$N-yt-qa.txt; then echo "QA FAILED for part $N: not packaging"; exit 1; fi
python3 -I season3/package_v4.py $N 2>&1 | tail -1
python3 - <<PY > /tmp/pl/stills$N.txt
import json
t=json.load(open("$O/v4-part$N.json")); b=t["beats"]; ap=[x for x in b if x["kind"]=="approach"]; rest=[x for x in b if x["kind"]!="approach"]
ts=[]
ts.append(f"{min(1.2, t['dur']/10):.1f}:beach")                                    # wide: the figure on the beach, the Moon small
key=[x for x in rest if x["kind"] not in ("grow","pull")] or rest
if key: ts.append(f"{(key[0]['t0']+key[0]['t1'])/2:.1f}:" + ("beach" if key[0]["kind"] in ("flex","tide","climb") else "moon"))   # the camera is on the figure in these beats                       # the part's key visual (eclipse, flex, strain, slide, tide, bright ...)
gr=[x for x in b if x["kind"] in ("grow","pull")]
ts.append(f"{(gr[-1]['t0']+gr[-1]['t1'])/2+1.0:.1f}:moon" if gr else (f"{ap[0]['t1']+0.5:.1f}:moon" if ap else "5.0:moon"))   # close-up: the Moon big, late in a grow beat
print(",".join(ts[:3]))
PY
export PLAYWRIGHT_DIR=$(dirname $(npm root -g)) CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome
STILLS=$(cat /tmp/pl/stills$N.txt) STILLDIR=$EP/out/cover-stills node season3/render_s3.mjs $O/v4-part$N.json /tmp/pl/dummy$N.mp4 2160 3840 30 2>&1 | tail -3
rm -f $O/v4-part$N-picture.mp4 $O/v4-part$N-yt-picture.mp4 $O/.chunk_* $O/.chunks_*
cd /home/user/claude && git add films/channels/space/$EP films/channels/space/long01/out/v4-part$N*.json films/channels/space/long01/out/v4-part$N*-contact.jpg films/channels/space/long01/out/v4-part$N*-qa.txt films/channels/space/long01/v4/part$N.sfx.json 2>/dev/null
echo FINISHED $N
