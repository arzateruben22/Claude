#!/bin/bash
# re-render v4 parts 1 and 2 (miles on the counter; part 1 without its closer): packs stay as they are (KEEP_PACK)
cd /home/user/claude/films/channels/space; export KEEP_PACK=1
for n in 1 2; do season3/render_v4.sh $n > /tmp/pl/rv$n.log 2>&1; season3/finish_part_v4.sh $n > /tmp/pl/fin$n.log 2>&1 & done; wait; echo ORCH12_DONE > /tmp/pl/orch12.log
