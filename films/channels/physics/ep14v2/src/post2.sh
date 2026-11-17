#!/bin/bash
set -e
cd /tmp/claude-0/-home-user-Claude/4a3ba513-421d-5923-9d9f-eb1b1341c5b2/scratchpad/rr-p2v
mkdir -p final
ffmpeg -v error -y -i video_noaudio.mp4 -i mix.wav -c:v copy -c:a aac -b:a 320k -shortest m_follow.mp4
ffmpeg -v error -y -i video_noaudio.mp4 -i mix.wav -vf scale=1440:2560:flags=lanczos -c:v libx264 -crf 14 -preset medium -pix_fmt yuv420p -c:a aac -b:a 320k -shortest m_sub.mp4
python3 -I /tmp/claude-0/-home-user-Claude/4a3ba513-421d-5923-9d9f-eb1b1341c5b2/scratchpad/cta/cta.py --video m_follow.mp4 --channel physics --at 35.9 --word follow --out final/reality-rulebook-s3p2-9x16.mp4 --crf 16 --preset medium --auto-y
python3 -I /tmp/claude-0/-home-user-Claude/4a3ba513-421d-5923-9d9f-eb1b1341c5b2/scratchpad/cta/cta.py --video m_sub.mp4 --channel physics --at 35.9 --word subscribe --out final/reality-rulebook-s3p2-9x16-youtube.mp4 --crf 16 --preset medium --auto-y
echo post2-done
