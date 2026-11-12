#!/bin/bash
# finish_yt.sh <n>: the YouTube file of part n, with the 'subscribe' CTA line (the 1080 file says 'follow'): render part<n>-yt, mix, QA, upscale to 1440p into ep(12+n)/out
cd /home/user/claude/films/channels/space; N=$1; O=long01/out; EP=ep$((12+N)); NAME=one-more-orbit-s3-part$N
export PLAYWRIGHT_DIR=$(dirname $(npm root -g)) CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome
for try in 1 2 3; do flock -s /tmp/heavy.lock node season3/render_s3.mjs $O/part$N-yt.json $O/part$N-yt-picture.mp4 1080 1920 30 > $O/part$N-yt-render.log 2>&1; grep -q "^done" $O/part$N-yt-render.log && break; echo "render failed, retry $try"; sleep 5; done
python3 -I season3/assemble_s3.py part$N-yt 2>&1 | tail -1
season3/shrink.sh $O/part$N-yt.mp4
echo "freezes:"; python3 -I season3/edge_check.py $O/part$N-yt.mp4 | cut -c1-200
ffmpeg -hide_banner -i $O/part$N-yt.mp4 -vf "freezedetect=n=0.003:d=1" -an -f null - 2>&1 | grep -E "freeze_(start|end)" | sed 's/.*freeze_/freeze_/'
ffmpeg -hide_banner -i $O/part$N-yt.mp4 -af ebur128 -f null - 2>&1 | grep -E "^\s+I:" | tail -1
T=$(mktemp -d); mkdir -p $T/ep/out; cp $O/part$N-yt.mp4 $T/ep/out/$NAME-9x16.mp4
flock -x /tmp/heavy.lock python3 -I /home/user/claude/kits/cinema/film/youtube1440.py $T/ep --force 2>&1 | tail -1 | cut -c1-120
cp $T/ep/out/$NAME-9x16-youtube.mp4 $EP/out/$NAME-9x16-youtube.mp4; rm -rf $T
sha256sum $EP/out/$NAME-9x16-youtube.mp4
echo YTDONE $N
