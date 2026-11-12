#!/bin/bash
# (env FROM / TO select a time range)
# render_chunked.sh <timeline.json> <out.mp4> <W> <H> [chunk_seconds]: renders in short chunks (a fresh browser each, retried), then joins them without re-encoding.
# A browser that renders a long run of frames of a huge-Moon timeline can run out of memory and die; short chunks never do.
cd /home/user/claude/films/channels/space
TL=$1; OUT=$2; W=$3; H=$4; CH=${5:-7}
export PLAYWRIGHT_DIR=$(dirname $(npm root -g)) CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome
DUR=${TO:-$(python3 -c "import json;print(json.load(open('$TL'))['dur'])")}; FROM=${FROM:-0}; D=$(dirname $OUT); B=$(basename $OUT .mp4); rm -f $D/.chunk_$B*.mp4 $D/.chunks_$B.txt
N=$(python3 -c "import math;print(math.ceil(($DUR-$FROM)/$CH))"); : > $D/.chunks_$B.txt
for i in $(seq 0 $((N-1))); do
  a=$(python3 -c "print(round($FROM+$i*$CH,3))"); b=$(python3 -c "print(round(min($FROM+($i+1)*$CH,$DUR),3))"); f=$D/.chunk_${B}_$i.mp4
  for try in 1 2 3 4; do flock -s /tmp/heavy.lock node season3/render_s3.mjs $TL $f $W $H 30 $a $b > $D/.chunk_${B}_$i.log 2>&1; grep -q "^done" $D/.chunk_${B}_$i.log && break; sleep 3; done
  grep -q "^done" $D/.chunk_${B}_$i.log || { echo "chunk $i failed"; exit 1; }
  echo "file '$(basename $f)'" >> $D/.chunks_$B.txt
done
ffmpeg -v error -y -f concat -safe 0 -i $D/.chunks_$B.txt -c copy $OUT && echo "done $OUT" > $D/$B-render.log; rm -f $D/.chunk_${B}_*.mp4 $D/.chunk_${B}_*.log
