#!/usr/bin/env bash
# Suspends a driver on the OC Ultra live server (off the road now, every session ended, no log-in), or lifts it:
#   sudo bash server/live-ban.sh SomeName
#   sudo bash server/live-ban.sh SomeName off
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Run it with sudo: sudo bash server/live-ban.sh NAME [off]"; exit 1; }
NAME="${1:?the driver name}"; ON=true; [ "${2:-}" = off ] && ON=false
TOKEN="$(grep '^ADMIN_TOKEN=' /etc/oc-live.env | cut -d= -f2)"
curl -fsS -X POST http://127.0.0.1:8791/admin/ban -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d "{\"name\":\"$NAME\",\"banned\":$ON}" && echo
