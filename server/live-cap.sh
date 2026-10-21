#!/usr/bin/env bash
# Changes how many drivers the live server lets in at once, right away and after restarts:
#   sudo bash server/live-cap.sh 50
# The ladder (top-speed-ultra/live/README.md): 25, then 50, 100, 200, 500, a week at each rung first.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Run it with sudo: sudo bash server/live-cap.sh 50"; exit 1; }
CAP="${1:?how many drivers at once, e.g. 50}"
[[ "$CAP" =~ ^[0-9]{1,3}$ ]] && [ "$CAP" -ge 1 ] && [ "$CAP" -le 500 ] || { echo "The cap is a number from 1 to 500."; exit 1; }
DIR="$(cd "$(dirname "$0")/.." && pwd)"
# the token goes to curl on its standard input, never on a command line other users can read with ps
grep '^ADMIN_TOKEN=' /etc/oc-live.env | sed 's/^ADMIN_TOKEN=/authorization: Bearer /' \
  | curl -fsS -X POST http://127.0.0.1:8791/admin/cap -H @- -H 'content-type: application/json' -d "{\"cap\":$CAP}" > /dev/null
bash "$DIR/server/live-env.sh" MAX_PLAYERS "$CAP"
echo "The cap is now $CAP drivers at once (kept for restarts)."
bash "$(dirname "$0")/live-status.sh"
