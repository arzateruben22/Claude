#!/bin/bash
# run_v2.sh <n...>: v2 parts in the given order: the 1080 file ('follow') then the YouTube file ('subscribe')
cd /home/user/claude/films/channels/space
declare -A COV=( [1]='8.5|3.8 cm a year' [2]='20|1.3× wider' [3]='20|8× the tides' [4]='20|6.5× the light' [5]='45|A dark noon' [6]='20|The ground moves too' [7]='45|Faster than a day' [8]='30|Too close' )
for n in "$@"; do
  s=${COV[$n]%%|*}; t=${COV[$n]#*|}
  SKIP_YT=1 season3/finish_part_c.sh $n "$s" "$t" cm > /tmp/v2p$n.log 2>&1
  season3/finish_yt_c.sh $n > /tmp/v2y$n.log 2>&1
  echo V2DONE $n > /tmp/v2done$n.log
done
