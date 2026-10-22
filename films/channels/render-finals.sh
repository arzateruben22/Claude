#!/bin/bash
# Render the three channels' episode-1 finals one after another, and assemble each with its mastered
# soundtrack. Idempotent: run it again after a kill or a restart and it resumes where it stopped
# (render.mjs keeps every verified frame; a delivered episode is skipped).
#
#   setsid nohup films/channels/render-finals.sh >/dev/null 2>&1 &      # log: films/channels/finals.log
set -u
cd "$(dirname "$0")/../.."
export PLAYWRIGHT_DIR=$(dirname "$(npm root -g)") CHROMIUM=/opt/pw-browsers/chromium
LOG=films/channels/finals.log
say() { echo "[$(date -u +%FT%TZ)] $*" >> "$LOG"; }
for c in physics space body; do
  F=films/channels/$c/ep01
  if ls "$F"/out/*-9x16.mp4 >/dev/null 2>&1; then say "$c: already delivered"; continue; fi
  ok=0
  for attempt in 1 2 3; do
    say "$c: final render (attempt $attempt)"
    if node kits/cinema/film/render.mjs --film "$F" --tier final --resume >> "$LOG" 2>&1; then ok=1; break; fi
    say "$c: render exited $?"
  done
  [ $ok = 1 ] || { say "$c: giving up after 3 attempts"; exit 1; }
  say "$c: assemble"
  node kits/cinema/film/render.mjs --film "$F" --tier final --assemble --audio "$F/build/audio/mix.wav" >> "$LOG" 2>&1 || { say "$c: assemble failed"; exit 1; }
done
say "all three finals delivered"
