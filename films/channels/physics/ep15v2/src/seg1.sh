#!/bin/bash
# the owner's kernel clip with the speed ramp: 0-1 s (trembles) x3.4, 1-2.6 s (the split) x2.375, both motion-interpolated;
# 2.6-5 s and 5-9 s x2 (30 fps, one source frame each). 19.83 s. usage: seg1.sh  (run from ep15v2/src; writes seg1.mp4)
set -e
cd "$(dirname "$0")"
V=../../reference/clips/ep3/p3-kernel-clip.mp4
MI="minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1"
ffmpeg -v error -y -i $V -filter_complex "
[0:v]split=4[a0][b0][c0][d0];
[a0]trim=0:1.0,setpts=(PTS-STARTPTS)*3.4,$MI[a];
[b0]trim=1.0:2.6,setpts=(PTS-STARTPTS)*2.375,$MI[b];
[c0]trim=2.6:5.0,setpts=(PTS-STARTPTS)*2,fps=30[c];
[d0]trim=5.0:9.0,setpts=(PTS-STARTPTS)*2,fps=30[d];
[a][b][c][d]concat=n=4:v=1:a=0,setsar=1[o]" -map "[o]" -c:v libx264 -crf 12 -preset fast -pix_fmt yuv420p -r 30 seg1.mp4
