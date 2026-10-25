#!/usr/bin/env bash
# Approve posts and watch the crawler from your phone. Puts this machine and your phone on one private
# network (Tailscale, free for personal use) and opens Post Desk and the Trading Deck there. From the repo folder:
#   sudo bash server/phone.sh
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Run it with sudo: sudo bash server/phone.sh"; exit 1; }
DIR="$(cd "$(dirname "$0")/.." && pwd)"
command -v tailscale > /dev/null || curl -fsSL https://tailscale.com/install.sh | sh
tailscale up                      # the first time, it prints a link: open it and sign in
IP="$(tailscale ip -4 | head -n 1)"
mkdir -p /etc/systemd/system/postdesk.service.d
cat > /etc/systemd/system/postdesk.service.d/phone.conf <<CONF
[Service]
ExecStart=
ExecStart=$DIR/.venv/bin/python -m postdesk run --no-browser --host $IP
CONF
mkdir -p /etc/systemd/system/paperbook.service.d
cat > /etc/systemd/system/paperbook.service.d/phone.conf <<CONF
[Service]
ExecStart=
ExecStart=$DIR/.venv/bin/python paperbook.py --watch 15 --serve 8790 --host $IP
CONF
systemctl daemon-reload
systemctl restart postdesk || true
systemctl restart paperbook || true
cat <<MSG

On your phone: install the Tailscale app, sign in with the same account, then open
  http://$IP:8790        Home: both apps on one screen, the trading desks and Post Desk. Pick one and go.
and add it to your home screen (Share, then Add to Home Screen): it opens like an app, with its own icon.
Straight to either one: http://$IP:8790/deck (Trading Deck) or http://$IP:8788 (Post Desk).
Only devices signed in to your Tailscale can reach them.
MSG
