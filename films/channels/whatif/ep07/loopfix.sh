#!/bin/bash
# The film loops: the last seconds are music only and the studio's own 0.6 s tail fade leaves them ~6 dB under the
# opening. This lifts the music tail up to the opening's level and ends on a short fade, so the loop point does not
# jump. Run after studio/render.py:  bash films/channels/whatif/ep07/loopfix.sh
set -e
A="$(dirname "$0")/build/audio"
ffmpeg -v error -y -i "$A/mix.wav" -af "volume='1+1.0*clip((t-69.2)/1.8,0,1)':eval=frame,afade=t=out:st=71.7:d=0.3" -c:a aac -b:a 256k -ar 48000 "$A/mix-loop.m4a"
echo "wrote $A/mix-loop.m4a"
