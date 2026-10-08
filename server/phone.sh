#!/usr/bin/env bash
# Approve posts from your phone. Puts this machine and your phone on one private network
# (Tailscale, free for personal use) and opens Post Desk's dashboard there. From the repo folder:
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
systemctl daemon-reload
systemctl restart postdesk || true
cat <<MSG

On your phone: install the Tailscale app, sign in with the same account, then open
  http://$IP:8788
and add it to your home screen. Only devices signed in to your Tailscale can reach it.
MSG
