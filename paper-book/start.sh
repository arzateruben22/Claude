#!/usr/bin/env bash
# Start paper trading on this computer (Mac or Linux). Paper money only.
#   memecoins  Night Desk runs nonstop on live prices (its dashboard: http://127.0.0.1:8787)
#   big coins  Majors Desk decides every hour on Coinbase prices
#   book    the paper book refreshes every 15 minutes
#   stocks  run on a schedule instead: see "Stocks" in paper-book/README.md
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PY="${PYTHON:-$ROOT/.venv/bin/python}"
[ -x "$PY" ] || PY="$(command -v python3)"
RUN="$ROOT/paper-book/run"
mkdir -p "$RUN"

start() {   # name, folder, arguments...
  local name="$1" dir="$2"; shift 2
  if [ -f "$RUN/$name.pid" ] && kill -0 "$(cat "$RUN/$name.pid")" 2>/dev/null; then
    echo "$name is already running (pid $(cat "$RUN/$name.pid"))"
    return
  fi
  (cd "$dir" && nohup "$PY" "$@" >> "$RUN/$name.log" 2>&1 & echo $! > "$RUN/$name.pid")
  echo "started $name (pid $(cat "$RUN/$name.pid")); log: $RUN/$name.log"
}

start coins "$ROOT/night-desk" -m nightdesk run --no-browser
start majors "$ROOT/majors-desk" -m majors run
start book "$ROOT/paper-book" paperbook.py --watch 15
echo
echo "Coin desk dashboard: http://127.0.0.1:8787"
echo "Paper book:          $ROOT/paper-book/output/paper-book.html"
echo "Trade Crawler:       $ROOT/paper-book/output/crawler.html"
echo "Stop everything:     paper-book/stop.sh   (open coin positions are saved and resume next start)"
