#!/usr/bin/env bash
# Start (or resume) a render of one film folder detached from this shell (setsid + nohup), so it outlives
# a background job's 2 h limit. Generalized from films/skin-school-tiktok/motion/run.sh: the first argument
# is the episode folder. The log goes to <film>/build/<tier>/<aspect>/render.log. Every start is
# render.mjs --resume: it keeps every verified frame and chunk and renders what is left, so after a
# container restart or a killed job, run this again. See README.md.
#
#   kits/cinema/film/run.sh <film> --tier final [--aspect 9x16] [render.mjs options]
#   kits/cinema/film/run.sh <film>               the last start's options again
#   kits/cinema/film/run.sh <film> status        is it rendering? the log's last lines
#   kits/cinema/film/run.sh <film> stop          SIGTERM to the renderer (finished frames stay)
#
# render.mjs exiting with 1 (unexpected) or 3 (a frame failed on 3 fresh pages) is started again, up to 3
# times. A refusal (2), a failed encode (4) or a signal (130/143, also a kill by PID) stops it.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
R="$HERE/render.mjs"
if [ $# -lt 1 ] || [ ! -f "$1/film.json" ]; then
  echo "usage: run.sh <film folder with film.json> [status|stop] [render.mjs options]" >&2; exit 2
fi
FILM="$(cd "$1" && pwd)"; shift
mkdir -p "$FILM/build"
LAST="$FILM/build/last-run.args"
export PLAYWRIGHT_DIR="${PLAYWRIGHT_DIR:-$(dirname "$(npm root -g)")}"
export CHROMIUM="${CHROMIUM:-/opt/pw-browsers/chromium}"

alive() { [ -n "${1:-}" ] && [ -r "/proc/$1/cmdline" ] && tr '\0' ' ' < "/proc/$1/cmdline" | grep -q -- "$2"; }

cmd=start
case "${1:-}" in status|stop) cmd="$1"; shift;; esac
if [ $# -gt 0 ]; then ARGS=("$@")
elif [ -s "$LAST" ]; then mapfile -d '' ARGS < "$LAST"
else echo "nothing to resume yet: start with options, e.g. run.sh $FILM --tier draft (they are saved for the next bare run.sh)" >&2; exit 2
fi
for a in "${ARGS[@]}"; do
  case "$a" in
    --fresh) echo "run.sh only resumes and never discards: run render.mjs --fresh ... yourself, then run.sh." >&2; exit 2;;
    --film|--film=*) echo "run.sh takes the film folder as its first argument, not --film" >&2; exit 2;;
  esac
done
BASE="$(node "$R" --film "$FILM" "${ARGS[@]}" --where)" || exit 2
LOG="$BASE/render.log"; PIDF="$BASE/run.pid"
RPID="$(cat "$BASE/render.pid" 2>/dev/null || true)"
SPID="$(cat "$PIDF" 2>/dev/null || true)"

case "$cmd" in
  status)
    if alive "$RPID" render.mjs; then echo "rendering: PID $RPID ($BASE)"; else echo "not rendering ($BASE)"; fi
    if alive "$SPID" run.sh-supervisor; then echo "supervisor: PID $SPID"; fi
    [ -f "$LOG" ] && tail -n 6 "$LOG"
    exit 0;;
  stop)
    if alive "$RPID" render.mjs; then kill -TERM "$RPID" && echo "sent SIGTERM to render.mjs (PID $RPID); finished frames stay on disk"; else echo "not rendering ($BASE)"; fi
    exit 0;;
esac

if alive "$SPID" run.sh-supervisor; then echo "already running (supervisor PID $SPID). run.sh $FILM status, or tail -f $LOG"; exit 0; fi
LOCKPID="$(sed -n 's/.*"pid": *\([0-9]*\).*/\1/p' "$FILM/build/.render.lock" 2>/dev/null | head -1)"
if alive "$LOCKPID" render.mjs; then echo "another render of this film is running (PID $LOCKPID, see $FILM/build/.render.lock): one at a time" >&2; exit 1; fi
[ $# -gt 0 ] && printf '%s\0' "${ARGS[@]}" > "$LAST"
mkdir -p "$BASE"
export R PIDF FILM
setsid nohup bash -c '
  echo $$ > "$PIDF"
  n=0
  while :; do
    echo "[run.sh $(date -u +%FT%TZ)] node render.mjs --film $FILM --resume $*"
    node "$R" --film "$FILM" --resume "$@"; rc=$?
    echo "[run.sh $(date -u +%FT%TZ)] render.mjs exited with $rc"
    if [ "$rc" -eq 1 ] || [ "$rc" -eq 3 ]; then
      n=$((n + 1))
      if [ "$n" -gt 3 ]; then echo "[run.sh] stopping after 3 restarts"; break; fi
      echo "[run.sh] restart $n of 3 in 20 s (it resumes)"; sleep 20
    else break; fi
  done
  rm -f "$PIDF"
' run.sh-supervisor "${ARGS[@]}" >> "$LOG" 2>&1 < /dev/null &
sleep 3
echo "started in the background: supervisor PID $(cat "$PIDF" 2>/dev/null || echo "?"), renderer PID $(cat "$BASE/render.pid" 2>/dev/null || echo "?")"
echo "log: $LOG   (tail -f it; run.sh $FILM status; run.sh $FILM stop)"
tail -n 4 "$LOG"
