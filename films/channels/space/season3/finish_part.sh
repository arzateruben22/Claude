#!/bin/bash
# finish_part.sh <n> [cover_secs] [cover_text] [accent]: render part n picture, mix, QA, (cover), package into ep(12+n)
cd /home/user/claude/films/channels/space; N=$1; O=long01/out
export PLAYWRIGHT_DIR=$(dirname $(npm root -g)) CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome
node season3/render_s3.mjs $O/part$N.json $O/part$N-picture.mp4 1080 1920 30 > $O/part$N-render.log 2>&1
python3 -I season3/assemble_s3.py part$N 2>&1 | tail -1
echo "freezes:"; python3 -I season3/edge_check.py $O/part$N.mp4 | cut -c1-200
ffmpeg -hide_banner -i $O/part$N.mp4 -vf "freezedetect=n=0.003:d=1" -an -f null - 2>&1 | grep -E "freeze_(start|end)" | sed 's/.*freeze_/freeze_/'
ffmpeg -hide_banner -i $O/part$N.mp4 -af ebur128 -f null - 2>&1 | grep -E "^\s+I:" | tail -1
if [ -n "$2" ]; then TEXT_Y=${TEXT_Y:-300} python3 -I season3/make_part_cover.py $N "$2" "$3" "$4" 2>&1 | tail -1; fi
python3 -I season3/package_part.py $N 2>&1 | tail -2; sha256sum films/channels/space/ep$((12+N))/out/*.mp4 2>/dev/null || sha256sum ep$((12+N))/out/*.mp4
echo PARTDONE $N
