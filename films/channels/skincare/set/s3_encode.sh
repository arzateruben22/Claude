#!/bin/bash
# Season 3 v2 encode. usage: set/s3_encode.sh epNN   (run from films/channels/skincare)
# 1080x1920 follow file = Lanczos downsample of the 1440 follow master (CRF 17); 1440x2560 YouTube file = chunks 0..K-1 of the follow render + the re-rendered tail chunks of
# the subscribe render (frames before the CTA caption are bit-identical), CRF 16. No bitrate cap. Chunks of the YouTube build are listed in ep*v2y/build.../chunks.
set -euo pipefail
E=$1; N=${E#ep}; D=${E}v2; DY=${E}v2y; B=build/final-plain-1440/9x16
COMMON=(-c:v libx264 -preset slow -x264-params aq-mode=3:deblock=-1,-1 -pix_fmt yuv420p -profile:v high -r 30 -fps_mode cfr -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv -c:a copy -movflags +faststart)
ffmpeg -v error -y -i $D/$B/master.mp4 -i $D/mix.m4a -map 0:v:0 -map 1:a:0 -vf "scale=1080:1920:flags=lanczos+accurate_rnd+full_chroma_int" -crf 17 "${COMMON[@]}" $D/out/skin-sense-0$N-9x16.mp4
L=$DY/$B/chunks/list.txt; : > $L; echo "ffconcat version 1.0" >> $L
for f in $DY/$B/chunks/[0-9][0-9][0-9].mp4; do k=$(basename $f .mp4); echo "file '$PWD/$f'" >> $L; done
# chunks not rendered for the YouTube build come from the follow build
FIRST=$(ls $DY/$B/chunks/[0-9][0-9][0-9].mp4 | head -1 | xargs basename | sed 's/.mp4//')
: > $L; echo "ffconcat version 1.0" >> $L
for f in $D/$B/chunks/[0-9][0-9][0-9].mp4; do k=$(basename $f .mp4); if [ $((10#$k)) -lt $((10#$FIRST)) ]; then echo "file '$PWD/$f'" >> $L; fi; done
for f in $DY/$B/chunks/[0-9][0-9][0-9].mp4; do echo "file '$PWD/$f'" >> $L; done
ffmpeg -v error -y -f concat -safe 0 -i $L -i $D/mix-yt.m4a -map 0:v:0 -map 1:a:0 -crf 16 "${COMMON[@]}" $D/out/skin-sense-0$N-9x16-youtube.mp4
ls -la $D/out/*.mp4
