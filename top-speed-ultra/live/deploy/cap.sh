#!/usr/bin/env bash
# Raise (or lower) how many drivers the live server lets in at once, without a restart, and keep it that way after
# one:   sudo bash deploy/cap.sh 50
set -euo pipefail
CAP="${1:?how many drivers at once, e.g. 50}"
set -a; . /etc/oc-live.env; set +a
curl -sf -X POST "http://127.0.0.1:${PORT:-8791}/admin/cap" -H "authorization: Bearer $ADMIN_TOKEN" -H 'content-type: application/json' -d "{\"cap\":$CAP}"; echo
sed -i "s/^MAX_PLAYERS=.*/MAX_PLAYERS=$CAP/" /etc/oc-live.env
echo "cap is now $CAP (also saved for the next restart)"
