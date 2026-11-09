#!/bin/bash
# The film loops: the last seconds are music only and the studio's own 0.6 s tail fade leaves them ~6 dB under the
# opening. This lifts the music tail up to the opening's level and ends on a short fade, so the loop point does not
# jump. Run after studio/render.py:  bash films/channels/whatif/ep12/loopfix.sh
set -e
A="$(dirname "$0")/build/audio"
D=$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['dur'])" "$(dirname "$0")/film.json")
ffmpeg -v error -y -i "$A/mix.wav" -af "volume='1+1.0*clip((t-($D-2.1))/1.8,0,1)':eval=frame,afade=t=out:st=$(python3 -c "print($D-0.06)"):d=0.06" -c:a aac -b:a 256k -ar 48000 "$A/mix-loop.m4a"
echo "wrote $A/mix-loop.m4a"
