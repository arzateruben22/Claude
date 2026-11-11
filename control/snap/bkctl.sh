#!/bin/bash
# Back up the control files (scripts, args, lane check, owner screenshots, character sheets) to origin/claude/wip-control.
S=/tmp/claude-0/-home-user-Claude/104ede24-b5bc-5131-bb4c-1bc7e86a4fd2/scratchpad
cd /home/user/Claude/tsu-live || exit 1
export GIT_INDEX_FILE=$(mktemp -u /tmp/claude-0/idx.XXXX)
git read-tree --empty
shopt -s nullglob
for f in $S/wf/*.js $S/wf/*.json $S/lane-check.md $S/snap/*.sh $S/pwtest.cjs $S/owner/* $S/characters/*.md $S/characters/*/*; do
  [ -f "$f" ] || continue
  h=$(git hash-object -w "$f") && git update-index --add --cacheinfo 100644,$h,control/${f#$S/}
done
T=$(git write-tree); P=$(git ls-remote origin refs/heads/claude/wip-control | cut -f1)
C=$(git commit-tree $T ${P:+-p $P} -m "Control files backup $(date -u +%FT%TZ)" -m "Claude-Session: https://claude.ai/code/session_01NkQ41gebWX6mPbmCQZBc81")
rm -f $GIT_INDEX_FILE
if [ -z "$C" ] || [ -z "$T" ]; then echo "bkctl: commit failed, nothing pushed"; exit 1; fi
git push -q origin $C:refs/heads/claude/wip-control && echo "bkctl: pushed $C"
