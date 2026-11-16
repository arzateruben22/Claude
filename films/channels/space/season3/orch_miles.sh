#!/bin/bash
# orch_miles.sh: re-render v4 parts 1,3,4,5,6,7,8 with the miles lines (stand-in voice) + the visuals; each part: render, then finish in the background. Packs/covers untouched (KEEP_PACK).
cd /home/user/claude/films/channels/space; export KEEP_PACK=1
for n in "$@"; do
  rm -f /tmp/pl/fin$n.log
  season3/render_v4.sh $n > /tmp/pl/rv$n.log 2>&1
  season3/finish_part_v4.sh $n > /tmp/pl/fin$n.log 2>&1 &
done
wait; echo ORCH_MILES_DONE > /tmp/pl/orch_miles.log
