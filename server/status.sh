#!/usr/bin/env bash
# What's running, what's waiting, and when the stock scanner runs next.
for u in nightdesk majors postdesk paperbook; do
  printf "%-12s %s\n" "$u" "$(systemctl is-active "$u.service" 2>/dev/null)"
done
echo
systemctl list-timers --no-pager 'scanner-*' 'nightdesk-*' 2>/dev/null | head -n 6
DIR="$(cd "$(dirname "$0")/.." && pwd)"
echo
"$DIR/.venv/bin/python" "$DIR/paper-book/paperbook.py" --standings
echo
"$DIR/.venv/bin/python" "$DIR/paper-book/paperbook.py" --proving
echo
ts_ip="$(command -v tailscale > /dev/null && tailscale ip -4 2>/dev/null | head -n 1 || true)"
if [ -n "$ts_ip" ]; then
  echo "ON YOUR PHONE (Tailscale app on): http://$ts_ip:8790   (type it exactly, with http:// and :8790)"
fi
echo "Home, both apps: http://127.0.0.1:8790 (Trading Deck: /deck, proving ground: /proving, crawler: /crawler, galaxy: /galaxy, book: /book; Post Desk: port 8788) through ssh -L 8790:127.0.0.1:8790 -L 8788:127.0.0.1:8788 (or your Tailscale address after phone.sh)"
