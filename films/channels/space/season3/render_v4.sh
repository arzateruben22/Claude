#!/bin/bash
# render_v4.sh <n>: build both timelines of v4 part n, render both pictures (chunked, two at a time). Then mix.sh does the rest.
cd /home/user/claude/films/channels/space; N=$1; O=long01/out
python3 season3/build_v4.py $N > $O/v4-part$N-build.log 2>&1; python3 season3/build_v4.py $N --yt > $O/v4-part$N-yt-build.log 2>&1
rm -f $O/v4-part$N-picture.mp4 $O/v4-part$N-yt-picture.mp4
season3/render_chunked.sh $O/v4-part$N.json $O/v4-part$N-picture.mp4 1080 1920 11 > $O/v4-part$N-r1.log 2>&1 &
season3/render_chunked.sh $O/v4-part$N-yt.json $O/v4-part$N-yt-picture.mp4 1080 1920 11 > $O/v4-part$N-r2.log 2>&1 &
wait; ls -la $O/v4-part$N-picture.mp4 $O/v4-part$N-yt-picture.mp4; echo RENDERED $N
