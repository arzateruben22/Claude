#!/usr/bin/env bash
# Suspends a driver on the OC Ultra live server (off the road now, every session ended, no log-in), or lifts it:
#   sudo bash server/live-ban.sh SomeName
#   sudo bash server/live-ban.sh SomeName off
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Run it with sudo: sudo bash server/live-ban.sh NAME [off]"; exit 1; }
NAME="${1:?the driver name}"; ON=true; [ "${2:-}" = off ] && ON=false
[[ "$NAME" =~ ^[A-Za-z0-9_]{3,16}$ ]] || { echo "A driver name is 3 to 16 letters, numbers or underscores."; exit 1; }
# the token goes to curl on its standard input, never on a command line other users can read with ps
grep '^ADMIN_TOKEN=' /etc/oc-live.env | sed 's/^ADMIN_TOKEN=/authorization: Bearer /' \
  | curl -fsS -X POST http://127.0.0.1:8791/admin/ban -H @- -H 'content-type: application/json' -d "{\"name\":\"$NAME\",\"banned\":$ON}" && echo
