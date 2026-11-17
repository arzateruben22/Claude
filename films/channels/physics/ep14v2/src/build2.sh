#!/bin/bash
# RR S3 Part 2 v2: smoother joins. fly -> mosquito: a 1.2 s smoothstep dissolve (same counter, same kitchen, only the creature changes);
# mosquito -> faucet: a camera pan to the right with motion blur (whip.py), 0.9 s, toward the mug on the right edge.
set -e
cd /tmp/claude-0/-home-user-Claude/4a3ba513-421d-5923-9d9f-eb1b1341c5b2/scratchpad/rr-p2v
SRC=/root/.claude/uploads/4a3ba513-421d-5923-9d9f-eb1b1341c5b2/18203f4f-Episode_2_1080p.mp4
ffmpeg -v error -y -i $SRC -filter_complex "[0:v]trim=0:12.0,setpts=PTS-STARTPTS[a];[0:v]trim=12.0:19.5,setpts=PTS-STARTPTS[b];
[a][b]xfade=transition=custom:duration=1.2:offset=10.8:expr='A*(P*P*(3-2*P))+B*(1-P*P*(3-2*P))'[o]" -map "[o]" -c:v libx264 -crf 10 -preset fast -pix_fmt yuv420p -r 30 -an v2/first.mp4
python3 -I whip.py $SRC v2/whip.mp4
ffmpeg -v error -y -i $SRC -filter_complex "[0:v]trim=21.3,setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=1.6[o]" -map "[o]" -c:v libx264 -crf 10 -preset fast -pix_fmt yuv420p -r 30 -an v2/rest.mp4
ffmpeg -v error -y -i v2/first.mp4 -i v2/whip.mp4 -i v2/rest.mp4 -filter_complex "[0:v][1:v][2:v]concat=n=3:v=1:a=0[o]" -map "[o]" -c:v libx264 -crf 14 -preset medium -pix_fmt yuv420p -r 30 video2_noaudio.mp4
ffmpeg -v error -y -i $SRC -filter_complex "[0:a]atrim=0:12.0,asetpts=PTS-STARTPTS[a0];[0:a]atrim=12.0:20.4,asetpts=PTS-STARTPTS[a1];[0:a]atrim=20.4,asetpts=PTS-STARTPTS[a2];
[a0][a1]acrossfade=d=1.2[b1];[b1][a2]acrossfade=d=0.9[b2];[b2]volume=7dB,apad=whole_dur=51.5,atrim=0:51.5[o]" -map "[o]" -ar 48000 bed2.wav
ffmpeg -v error -y -i voice_raw2.wav -af "adeclip=threshold=10,highpass=f=70:poles=2,loudnorm=I=-16:TP=-2:LRA=11,alimiter=limit=0.89" -ar 48000 voice2.wav
~/.cache/cinema-voice/venv/bin/python -I mix2.py /tmp/claude-0/-home-user-Claude/4a3ba513-421d-5923-9d9f-eb1b1341c5b2/scratchpad/rr-p2v/ 2>&1 | grep -v -i warn
ffmpeg -v error -y -i mix_raw2.wav -af "alimiter=limit=0.80:level=disabled" -ar 48000 -ac 1 mix2.wav
ffmpeg -hide_banner -i mix2.wav -af loudnorm=print_format=summary -f null - 2>&1 | grep -E "Input (Integrated|True Peak)"
ffprobe -v error -show_entries stream=duration -of csv=p=0 video2_noaudio.mp4
ffmpeg -v error -y -i video2_noaudio.mp4 -i mix2.wav -c:v copy -c:a aac -b:a 320k -shortest m2_follow.mp4
ffmpeg -v error -y -i video2_noaudio.mp4 -i mix2.wav -vf scale=1440:2560:flags=lanczos -c:v libx264 -crf 14 -preset medium -pix_fmt yuv420p -c:a aac -b:a 320k -shortest m2_sub.mp4
python3 -I /tmp/claude-0/-home-user-Claude/4a3ba513-421d-5923-9d9f-eb1b1341c5b2/scratchpad/cta/cta.py --video m2_follow.mp4 --channel physics --at 35.4 --word follow --out final2/reality-rulebook-s3p2-9x16.mp4 --crf 16 --preset medium --auto-y
python3 -I /tmp/claude-0/-home-user-Claude/4a3ba513-421d-5923-9d9f-eb1b1341c5b2/scratchpad/cta/cta.py --video m2_sub.mp4 --channel physics --at 35.4 --word subscribe --out final2/reality-rulebook-s3p2-9x16-youtube.mp4 --crf 16 --preset medium --auto-y
echo build2-done
