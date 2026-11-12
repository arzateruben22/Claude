#!/bin/bash
# finish_v4.sh <n> yt: the 'subscribe' cut of v4 part n: mix the voice + music (no built-in sfx), then the sfx stem (kits/cinema/sound/sfx.py), QA. (The 1080 'follow' cut was done the same way by hand.)
cd /home/user/claude/films/channels/space; N=$1; O=long01/out
python3 -I season3/assemble_s3.py v4-part$N-yt --no-sfx 2>&1 | tail -1
mv $O/v4-part$N-yt.mp4 $O/v4-part$N-yt-nosfx.mp4
season3/mix_sfx.sh $O/v4-part$N-yt-nosfx.mp4 $O/v4-part$N-yt.json long01/v4/part$N.sfx.json $O/v4-part$N-yt.mp4 2>&1 | tail -1
python3 -I season3/edge_check.py $O/v4-part$N-yt.mp4 | cut -c1-200
~/.cache/cinema-voice/venv/bin/python -I season3/qa_v4.py $O/v4-part$N-yt.mp4 $O/v4-part$N-yt.json 2>&1 | grep -v "sherpa\|sample_rate\|^$" | cut -c1-230
echo YTMIX $N
