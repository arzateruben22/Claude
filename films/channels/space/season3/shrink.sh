#!/bin/bash
# shrink.sh <file.mp4> [limit_mb]: re-encode in place (x264 slow, crf 19, maxrate 11M, audio copied) when a delivery file is over the limit (GitHub refuses files over 100 MB)
f=$1; lim=${2:-92}; sz=$(( $(stat -c %s "$f") / 1000000 ))
if [ "$sz" -gt "$lim" ]; then
  ffmpeg -v error -y -i "$f" -c:v libx264 -preset slow -crf 19 -maxrate 11M -bufsize 22M -pix_fmt yuv420p -profile:v high -r 30 -color_primaries bt709 -color_trc bt709 -colorspace bt709 -c:a copy -movflags +faststart "$f.tmp.mp4" && mv "$f.tmp.mp4" "$f"; echo "shrunk $f: ${sz} MB -> $(( $(stat -c %s "$f") / 1000000 )) MB"
fi
