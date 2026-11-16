#!/bin/bash
# resume after a worker restart: P5 yt QA + package + stills, P6 finish (pictures exist), then the remaining parts (1,3,4,7,8)
cd /home/user/claude/films/channels/space; export KEEP_PACK=1; O=long01/out
~/.cache/cinema-voice/venv/bin/python -I season3/qa_v4.py $O/v4-part5-yt.mp4 $O/v4-part5-yt.json $O/v4-part5-yt-contact.jpg 2>&1 | grep -v "sherpa\|sample_rate\|^$" | cut -c1-230 > $O/v4-part5-yt-qa.txt
grep -q "QA PASS" $O/v4-part5-qa.txt && grep -q "QA PASS" $O/v4-part5-yt-qa.txt && { python3 -I season3/package_v4.py 5 | tail -1; season3/stills_v4.sh 5 | tail -3; rm -f $O/v4-part5-picture.mp4 $O/v4-part5-yt-picture.mp4; echo P5DONE > /tmp/pl/p5done.log; }
season3/finish_part_v4.sh 6 > /tmp/pl/fin6.log 2>&1
season3/orch_miles.sh 1 3 4 7 8
