#!/bin/bash
# RR S3 Part 2 with the owner's narration: the owner's ChatGPT Episode 2 (52 s) with the two camera-move transitions,
# the held end card, the owner's nine takes on the baked captions, a quieter bed, the owner's closer C2.
set -e
cd /tmp/claude-0/-home-user-Claude/4a3ba513-421d-5923-9d9f-eb1b1341c5b2/scratchpad/rr-p2v
SRC=/root/.claude/uploads/4a3ba513-421d-5923-9d9f-eb1b1341c5b2/18203f4f-Episode_2_1080p.mp4
# picture: fly -> mosquito (smoothleft 0.7 s @11.3), mosquito -> tap (smoothdown 0.8 s @18.9), end card held 1.6 s
ffmpeg -v error -y -i $SRC -filter_complex "
[0:v]trim=0:12.0,setpts=PTS-STARTPTS[v0];[0:v]trim=12.0:20.4,setpts=PTS-STARTPTS[v1];[0:v]trim=20.4,setpts=PTS-STARTPTS[v2];
[v0][v1]xfade=transition=smoothleft:duration=0.7:offset=11.3[x1];[x1][v2]xfade=transition=smoothdown:duration=0.8:offset=18.9[x2];
[x2]tpad=stop_mode=clone:stop_duration=1.6[o]" -map "[o]" -c:v libx264 -crf 14 -preset medium -pix_fmt yuv420p -r 30 -an video_noaudio.mp4
# the source's own bed through the same cuts (acrossfade = the same overlaps), +7 dB under the voice
ffmpeg -v error -y -i $SRC -filter_complex "
[0:a]atrim=0:12.0,asetpts=PTS-STARTPTS[a0];[0:a]atrim=12.0:20.4,asetpts=PTS-STARTPTS[a1];[0:a]atrim=20.4,asetpts=PTS-STARTPTS[a2];
[a0][a1]acrossfade=d=0.7[b1];[b1][a2]acrossfade=d=0.8[b2];[b2]volume=7dB,apad=whole_dur=52.1,atrim=0:52.1[o]" -map "[o]" -ar 48000 bed.wav
# the owner's voice: de-clip the hard consonants, rumble cut, level -16 LUFS
ffmpeg -v error -y -i voice_raw.wav -af "adeclip=threshold=10,highpass=f=70:poles=2,loudnorm=I=-16:TP=-2:LRA=11,alimiter=limit=0.89" -ar 48000 voice.wav
# the owner's closer C2 ("Part two of eight. Full video on YouTube."), same level as the voice, under the end card at 48.3 s
ffmpeg -v error -y -i /tmp/claude-0/-home-user-Claude/4a3ba513-421d-5923-9d9f-eb1b1341c5b2/scratchpad/rr-p2/c2.wav -af "adeclip=threshold=10,volume=5dB,alimiter=limit=0.89:level=disabled,adelay=48300|48300,apad=whole_dur=52.1,atrim=0:52.1" -ar 48000 -ac 1 c2p.wav
ffmpeg -v error -y -i bed.wav -i voice.wav -i c2p.wav -filter_complex "[0:a]aformat=channel_layouts=mono[b];[1:a]aformat=channel_layouts=mono[v];[2:a]aformat=channel_layouts=mono[c];[b][v][c]amix=inputs=3:normalize=0:duration=first,alimiter=limit=0.84:level=disabled[o]" -map "[o]" -ar 48000 -ac 1 mix.wav
ffmpeg -hide_banner -i mix.wav -af loudnorm=print_format=summary -f null - 2>&1 | grep -E "Input (Integrated|True Peak|LRA)"
ffmpeg -v error -y -i video_noaudio.mp4 -i mix.wav -c:v copy -c:a aac -b:a 320k -shortest m_follow.mp4
ffmpeg -v error -y -i video_noaudio.mp4 -i mix.wav -vf scale=1440:2560:flags=lanczos -c:v libx264 -crf 14 -preset medium -pix_fmt yuv420p -c:a aac -b:a 320k -shortest m_sub.mp4
echo build-done
