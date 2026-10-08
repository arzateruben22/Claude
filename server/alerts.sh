#!/usr/bin/env bash
# Phone alerts through ntfy (free app, no account): a push when a desk stops, keeps crashing, goes quiet or
# has a bad day, or the nightly backup goes missing, plus a short summary every evening. From the repo folder:
#   bash server/alerts.sh
# Safe to run again: it keeps the same topic and sends another test push.
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
FILE="$DIR/server/.alerts"
PY="$DIR/.venv/bin/python"
[ -x "$PY" ] || { echo "Run sudo bash server/setup.sh first."; exit 1; }

if [ ! -f "$FILE" ]; then
  # The topic name is the only thing that keeps your pushes private, so it's long and random.
  printf 'NTFY_TOPIC=%s\n' "$("$PY" -c 'import secrets; print("desks-" + secrets.token_hex(8))')" > "$FILE"
fi
chmod 600 "$FILE"
TOPIC="$(sed -n 's/^NTFY_TOPIC=//p' "$FILE")"

(cd "$DIR/paper-book" && "$PY" watchdog.py --test) || echo "Couldn't reach ntfy.sh just now; the watchdog will keep trying."
cat <<MSG

On your phone:
  1. Install the free "ntfy" app (App Store or Google Play) and allow notifications.
  2. Tap +, choose "Subscribe to topic", and type this topic exactly:

       $TOPIC

  3. Tap Subscribe. If the "Alerts are on" test push isn't there, send another with:
       bash server/alerts.sh

The watchdog checks every 5 minutes and sends the evening summary at 8pm Pacific. Keep the topic private:
anyone who knows it can read your pushes.
MSG
