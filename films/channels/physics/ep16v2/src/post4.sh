#!/bin/bash
# Part 4 (even): mux the audio (the owner's closer C4), the 1440 YouTube file, a SILENT-ask pop-up at 40.3 s (after "a hundredth of a second"), loudness pass
set -e
cd "$(dirname "$0")"
CTA=../cta/cta.py
mkdir -p final
ffmpeg -v error -y -i video4_noaudio.mp4 -i audio4.wav -c:v copy -c:a aac -b:a 320k -shortest m4_follow.mp4
ffmpeg -v error -y -i video4_noaudio.mp4 -i audio4.wav -vf scale=1440:2560:flags=lanczos -c:v libx264 -crf 14 -preset medium -pix_fmt yuv420p -c:a aac -b:a 320k -shortest m4_sub.mp4
python3 -I $CTA --video m4_follow.mp4 --channel physics --at 40.3 --word follow --out final/p4_follow.mp4 --crf 16 --preset medium --auto-y
python3 -I $CTA --video m4_sub.mp4 --channel physics --at 40.3 --word subscribe --out final/p4_sub.mp4 --crf 16 --preset medium --auto-y
echo post-done
