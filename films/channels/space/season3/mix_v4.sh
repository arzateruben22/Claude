#!/bin/bash
# mix_v4.sh <n> <follow|yt>: voice + music (no built-in sfx), the sfx stem, the final cut v4-part<n>[-yt].mp4; then QA with a contact sheet.
cd /home/user/claude/films/channels/space; N=$1; V=$2; O=long01/out; S=""; [ "$V" = yt ] && S="-yt"; B=v4-part$N$S
python3 -I season3/assemble_s3.py $B --no-sfx 2>&1 | tail -1
mv $O/$B.mp4 $O/$B-nosfx.mp4
season3/mix_sfx.sh $O/$B-nosfx.mp4 $O/$B.json long01/v4/part$N.sfx.json $O/$B.mp4 2>&1 | tail -1
python3 -I season3/edge_check.py $O/$B.mp4 | cut -c1-200
~/.cache/cinema-voice/venv/bin/python -I season3/qa_v4.py $O/$B.mp4 $O/$B.json $O/$B-contact.jpg 2>&1 | grep -v "sherpa\|sample_rate\|^$" | cut -c1-230 > $O/$B-qa.txt; grep -v "^  " $O/$B-qa.txt | grep -v "speech :" 
rm -rf $O/$B-nosfx.mp4 $O/$B-audio
echo MIXED $N $V
