#!/bin/bash
# mux the audio, make the 1440 YouTube file, add the like/follow pop-up at the spoken "like" (42.7 s)
set -e
cd "$(dirname "$0")"
CTA=../../cta/cta.py
mkdir -p ../final
ffmpeg -v error -y -i video_noaudio.mp4 -i audio_d3.wav -c:v copy -c:a aac -b:a 320k -shortest m_follow.mp4
ffmpeg -v error -y -i video_noaudio.mp4 -i audio_d4.wav -vf scale=1440:2560:flags=lanczos -c:v libx264 -crf 14 -preset medium -pix_fmt yuv420p -c:a aac -b:a 320k -shortest m_sub.mp4
python3 -I $CTA --video m_follow.mp4 --channel physics --at 42.7 --word follow --out ../final/reality-rulebook-s3p3-9x16.mp4 --crf 16 --preset medium --auto-y
python3 -I $CTA --video m_sub.mp4 --channel physics --at 42.7 --word subscribe --out ../final/reality-rulebook-s3p3-9x16-youtube.mp4 --crf 16 --preset medium --auto-y
echo post-done
