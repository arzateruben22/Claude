#!/usr/bin/env bash
# Changes how many drivers the live server lets in at once, right away and after restarts:
#   sudo bash server/live-cap.sh 50
# The ladder (top-speed-ultra/live/README.md): 25, then 50, 100, 200, 500, a week at each rung first.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Run it with sudo: sudo bash server/live-cap.sh 50"; exit 1; }
CAP="${1:?how many drivers at once, e.g. 50}"
TOKEN="$(grep '^ADMIN_TOKEN=' /etc/oc-live.env | cut -d= -f2)"
curl -fsS -X POST http://127.0.0.1:8791/admin/cap -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d "{\"cap\":$CAP}" > /dev/null
if grep -q '^MAX_PLAYERS=' /etc/oc-live.env; then sed -i "s/^MAX_PLAYERS=.*/MAX_PLAYERS=$CAP/" /etc/oc-live.env; else echo "MAX_PLAYERS=$CAP" >> /etc/oc-live.env; fi
echo "The cap is now $CAP drivers at once (kept for restarts)."
bash "$(dirname "$0")/live-status.sh"
