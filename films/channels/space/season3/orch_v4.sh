#!/bin/bash
# orch_v4.sh <first> <last>: render part n (blocking), then finish it in the background while the next one renders. Logs: /tmp/pl/rv<n>.log, /tmp/pl/fin<n>.log
cd /home/user/claude/films/channels/space
for n in $(seq $1 $2); do
  season3/render_v4.sh $n > /tmp/pl/rv$n.log 2>&1
  season3/finish_part_v4.sh $n > /tmp/pl/fin$n.log 2>&1 &
done
wait; echo ORCH_DONE > /tmp/pl/orch.log
