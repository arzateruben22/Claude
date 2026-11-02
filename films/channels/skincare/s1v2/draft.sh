#!/bin/bash
# usage: draft.sh 04   (cues → compile → mix → draft render → assemble → review preview); Chromium steps hold /tmp/chromium.lock
set -x
cd /home/user/Claude
export PLAYWRIGHT_DIR=/opt/node22/lib CHROMIUM=/opt/pw-browsers/chromium
n=$1; E=films/channels/skincare/ep$n; R=kits/cinema/film/render.mjs; L=/tmp/chromium.lock
rm -rf $E/build/draft
flock $L node $R --film $E --cues || exit 1
python3 -I $E/compile.py | head -1
(cd $E && python3 -I ../../../../kits/cinema/studio/render.py sheet.json build/audio | tail -3)
flock $L node $R --film $E --tier draft || exit 1
flock $L node $R --film $E --tier draft --assemble --audio $E/build/audio/mix.m4a || exit 1
mkdir -p $E/review
src=$(ls -t $E/out/*-0$n-9x16-draft.mp4 | head -1); base=$(basename $src -draft.mp4)
ffmpeg -loglevel error -y -i $src -c:v libx264 -preset slow -crf 27 -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 128k $E/review/$base-draft-preview.mp4
cp $E/build/draft/9x16/contact-sheet.jpg $E/review/draft-contact-sheet.jpg
echo "DRAFT$n DONE"
