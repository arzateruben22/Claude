#!/bin/bash
# WIP snapshot round: each lane worktree's full working tree -> origin/claude/wip-<name> (temporary index, never stash)
S=/tmp/claude-0/-home-user-Claude/104ede24-b5bc-5131-bb4c-1bc7e86a4fd2/scratchpad
cd /home/user/Claude || exit 1
git fetch -q origin 'refs/heads/claude/wip-*:refs/remotes/origin/claude/wip-*' 2>/dev/null
declare -A WT=( [hyper]=tsu-hyper [fix-road]=tsu-fix-road [bar]=tsu-bar [wheel]=tsu-wheel [navhud]=tsu-navhud [final-live]=tsu-live [cast]=tsu-cast )
for name in hyper fix-road bar wheel navhud final-live cast; do
  wt=/home/user/Claude/${WT[$name]}
  [ -d "$wt" ] || { echo "$name: no worktree"; continue; }
  prev=$(git rev-parse -q --verify origin/claude/wip-$name 2>/dev/null)
  export GIT_INDEX_FILE=$S/snap/idx-$name
  rm -f "$GIT_INDEX_FILE"
  if ! git -C "$wt" read-tree HEAD || ! git -C "$wt" add -A -- . ; then echo "$name: add failed"; unset GIT_INDEX_FILE; continue; fi
  tree=$(git -C "$wt" write-tree)
  head=$(git -C "$wt" rev-parse HEAD)
  unset GIT_INDEX_FILE
  if [ -n "$prev" ] && [ "$tree" = "$(git rev-parse "$prev^{tree}")" ]; then echo "$name: unchanged since last snapshot"; continue; fi
  if [ "$tree" = "$(git rev-parse "$head^{tree}")" ]; then echo "$name: clean, tree equals HEAD $head"; continue; fi
  c=$(git -C "$wt" commit-tree "$tree" -p "$head" ${prev:+-p "$prev"} -m "WIP snapshot of tsu-$name ($(date -u +%FT%TZ))" -m "Claude-Session: https://claude.ai/code/session_01NkQ41gebWX6mPbmCQZBc81")
  if git push -q origin "$c:refs/heads/claude/wip-$name" 2>$S/snap/push-$name.err; then echo "$name: pushed $c"; else echo "$name: push failed: $(tail -1 $S/snap/push-$name.err)"; fi
done
echo "round done $(date -u +%T)"
