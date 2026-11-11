#!/bin/bash
# render long.json at 2560x1440 in 3 parallel segments, then concat to long-picture.mp4
cd /home/user/claude/films/channels/space/long01/out
export PLAYWRIGHT_DIR=$(dirname $(npm root -g)) CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome
R=../../season3/render_s3.mjs
for i in 0 1 2; do
  a=$(python3 -c "print(round($i*517.7/3,3))"); b=$(python3 -c "print(round(($i+1)*517.7/3,3) if $i<2 else 517.693)")
  node $R long.json seg$i.mp4 2560 1440 30 $a $b > seg$i.log 2>&1 &
done
wait
printf "file seg0.mp4\nfile seg1.mp4\nfile seg2.mp4\n" > segs.txt
ffmpeg -v error -y -f concat -i segs.txt -c copy long-picture.mp4 && echo LONGDONE
