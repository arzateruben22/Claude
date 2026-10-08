#!/usr/bin/env bash
# What's running, what's waiting, and when the stock scanner runs next.
for u in nightdesk majors postdesk paperbook; do
  printf "%-12s %s\n" "$u" "$(systemctl is-active "$u.service" 2>/dev/null)"
done
echo
systemctl list-timers --no-pager 'scanner-*' 'nightdesk-*' 2>/dev/null | head -n 6
DIR="$(cd "$(dirname "$0")/.." && pwd)"
echo
"$DIR/.venv/bin/python" "$DIR/paper-book/paperbook.py" --print
echo
echo "Trade Crawler: http://127.0.0.1:8790 (galaxy: /galaxy, book: /book) through ssh -L 8790:127.0.0.1:8790 (or your Tailscale address after phone.sh)"
