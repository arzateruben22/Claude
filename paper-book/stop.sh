#!/usr/bin/env bash
# Stop what start.sh started. The coin desk saves its paper positions on the way out.
set -uo pipefail
RUN="$(cd "$(dirname "$0")" && pwd)/run"
for f in "$RUN"/*.pid; do
  [ -e "$f" ] || { echo "nothing running"; exit 0; }
  pid="$(cat "$f")"
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid" && echo "stopped $(basename "$f" .pid) (pid $pid)"
  fi
  rm -f "$f"
done
