#!/usr/bin/env bash
# Sets one setting in /etc/oc-live.env (KEY=VALUE), keeping the file's other lines and its 0600 permissions. Used by
# live.sh and live-cap.sh. The value is written as given (no sed), so any character in it is safe:
#   sudo bash server/live-env.sh MAX_PLAYERS 50
#   sudo bash server/live-env.sh CRUISE 'Fri 20:00, Sun 18:00'      (then: sudo systemctl restart oc-live)
set -euo pipefail
KEY="${1:?KEY}"; VAL="${2-}"
[[ "$KEY" =~ ^[A-Z_][A-Z0-9_]*$ ]] || { echo "bad key: $KEY"; exit 1; }
[[ "$VAL" != *$'\n'* ]] || { echo "one line only"; exit 1; }
F=/etc/oc-live.env; T="$(mktemp /etc/.oc-live.env.XXXXXX)"
chmod 600 "$T"
# a value with spaces is quoted (systemd strips the quotes; a shell reading the file then sees one word)
if [[ "$VAL" =~ [[:space:]] ]]; then VAL="\"${VAL//\"/\\\"}\""; fi
{ [ -f "$F" ] && grep -v "^$KEY=" "$F" || true; printf '%s=%s\n' "$KEY" "$VAL"; } > "$T"
mv "$T" "$F"
