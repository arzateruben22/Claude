#!/bin/bash
# Re-render episode finals after a kit change, one after another: cues → compile → soundtrack → final → assemble
# → QA. Idempotent and restart-safe: each film gets a marker per round, a final started in this round
# resumes (render.mjs keeps every verified frame), and a film already done in this round is skipped.
#
#   setsid nohup films/channels/rerender-finals.sh films/channels/space/ep01 films/channels/physics/ep01 … >/dev/null 2>&1 &
#   log: films/channels/rerender.log
set -u
cd "$(dirname "$0")/../.."
export PLAYWRIGHT_DIR=$(dirname "$(npm root -g)") CHROMIUM=/opt/pw-browsers/chromium
LOG=films/channels/rerender.log
REV=${RERENDER_ROUND:-round-767b57b}   # the round (the readability pass); set a new one only when every final must render again
say() { echo "[$(date -u +%FT%TZ)] $*" >> "$LOG"; }
R=kits/cinema/film/render.mjs
for F in "$@"; do
  B=$F/build
  mkdir -p "$B"
  # markers from this round written under earlier names (by commit e837620, then by kit tree 5623233)
  [ "$REV" = round-767b57b ] && for o in e837620 kit-5623233; do for x in started done; do [ -f "$B/rerender-$o.$x" ] && touch "$B/rerender-$REV.$x"; done; done
  if [ -f "$B/rerender-$REV.done" ]; then say "$F: already re-rendered at $REV"; continue; fi
  if [ ! -f "$B/rerender-$REV.started" ]; then
    say "$F: start at $REV (cues, compile, soundtrack)"
    python3 -I "$F/compile.py" >> "$LOG" 2>&1 || { say "$F: compile failed"; continue; }
    node $R --film "$F" --cues --share-cpu >> "$LOG" 2>&1 || { say "$F: cues failed"; continue; }
    python3 -I "$F/compile.py" >> "$LOG" 2>&1 || { say "$F: compile (2) failed"; continue; }
    (cd "$F" && python3 -I ../../../../kits/cinema/studio/render.py sheet.json build/audio --root .) >> "$LOG" 2>&1 || { say "$F: soundtrack failed"; continue; }
    rm -rf "$B/final/9x16"
    touch "$B/rerender-$REV.started"
  fi
  ok=0
  for attempt in 1 2 3; do
    say "$F: final render (attempt $attempt)"
    if node $R --film "$F" --tier final --resume >> "$LOG" 2>&1; then ok=1; break; fi
    say "$F: render exited $?"
  done
  [ $ok = 1 ] || { say "$F: giving up after 3 attempts"; continue; }
  say "$F: assemble"
  node $R --film "$F" --tier final --assemble --audio "$B/audio/mix.wav" >> "$LOG" 2>&1 || { say "$F: assemble failed"; continue; }
  python3 -I kits/cinema/film/qa.py "$F" >> "$LOG" 2>&1 && say "$F: QA PASS" || say "$F: QA FAILED (see above)"
  cp "$B/final/9x16/contact-sheet.jpg" "$F/out/$(basename "$(ls "$F"/out/*-9x16.mp4 | head -1)" .mp4)-contact.jpg" 2>/dev/null
  touch "$B/rerender-$REV.done"
  say "$F: delivered"
done
say "re-render queue done"
