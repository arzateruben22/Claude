#!/bin/bash
# render_long.sh: the long film (2560x1440) in 3 time slices, each in 30 s chunks, then one picture file out/long-picture.mp4
cd /home/user/claude/films/channels/space; O=long01/out; python3 - <<'P' > /tmp/long_bounds.txt
import json; d=json.load(open('long01/out/long.json'))['dur']; print(0, round(d/3,3), round(2*d/3,3), d)
P
read a b c d < /tmp/long_bounds.txt
FROM=$a TO=$b season3/render_chunked.sh $O/long.json $(pwd)/$O/seg0.mp4 2560 1440 30 > /tmp/lseg0.log 2>&1 &
FROM=$b TO=$c season3/render_chunked.sh $O/long.json $(pwd)/$O/seg1.mp4 2560 1440 30 > /tmp/lseg1.log 2>&1 &
FROM=$c TO=$d season3/render_chunked.sh $O/long.json $(pwd)/$O/seg2.mp4 2560 1440 30 > /tmp/lseg2.log 2>&1 &
wait
printf "file seg0.mp4\nfile seg1.mp4\nfile seg2.mp4\n" > $O/segs.txt
ffmpeg -v error -y -f concat -i $O/segs.txt -c copy $O/long-picture.mp4 && echo LONGDONE > /tmp/longdone.log
