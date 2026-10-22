#!/usr/bin/env bash
# Raise (or lower) how many drivers the live server lets in at once, without a restart, and keep it that way after
# one:   sudo bash deploy/cap.sh 50
set -euo pipefail
CAP="${1:?how many drivers at once, e.g. 50}"
[[ "$CAP" =~ ^[0-9]{1,3}$ ]] && [ "$CAP" -ge 1 ] && [ "$CAP" -le 500 ] || { echo "The cap is a number from 1 to 500."; exit 1; }
PORT="$(grep '^PORT=' /etc/oc-live.env | cut -d= -f2)"
# the token goes to curl on its standard input, never on a command line other users can read with ps
grep '^ADMIN_TOKEN=' /etc/oc-live.env | sed 's/^ADMIN_TOKEN=/authorization: Bearer /' \
  | curl -sf -X POST "http://127.0.0.1:${PORT:-8791}/admin/cap" -H @- -H 'content-type: application/json' -d "{\"cap\":$CAP}"; echo
sed -i "s/^MAX_PLAYERS=.*/MAX_PLAYERS=$CAP/" /etc/oc-live.env
echo "cap is now $CAP (also saved for the next restart)"
