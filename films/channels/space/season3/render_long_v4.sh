#!/bin/bash
# render_long_v4.sh: the v4 long film (2560x1440) in 2 time slices (30 s chunks), then long01/out/v4-long-picture.mp4
cd /home/user/claude/films/channels/space; O=long01/out; read a b d < /tmp/pl/long_bounds.txt
FROM=$a TO=$b season3/render_chunked.sh $O/v4-long.json $(pwd)/$O/lseg0.mp4 2560 1440 30 > /tmp/pl/lseg0.log 2>&1 &
FROM=$b TO=$d season3/render_chunked.sh $O/v4-long.json $(pwd)/$O/lseg1.mp4 2560 1440 30 > /tmp/pl/lseg1.log 2>&1 &
wait
printf "file lseg0.mp4\nfile lseg1.mp4\n" > $O/.lsegs.txt
ffmpeg -v error -y -f concat -i $O/.lsegs.txt -c copy $O/v4-long-picture.mp4 && rm -f $O/lseg0.mp4 $O/lseg1.mp4 && echo LONGRENDERED > /tmp/pl/longdone.log
