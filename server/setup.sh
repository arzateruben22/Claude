#!/usr/bin/env bash
# One-time setup on an always-on Linux machine (Ubuntu or Debian). From the repo folder:
#   sudo bash server/setup.sh
# Safe to run again after `git pull`: it refreshes the packages and the services.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Run it with sudo: sudo bash server/setup.sh"; exit 1; }
DIR="$(cd "$(dirname "$0")/.." && pwd)"
OWNER="${SUDO_USER:-root}"

echo "Installing Python..."
apt-get update -qq
apt-get install -y -qq python3 python3-venv python3-pip git > /dev/null

echo "Installing the desks' packages into $DIR/.venv ..."
sudo -u "$OWNER" python3 -m venv "$DIR/.venv"
sudo -u "$OWNER" "$DIR/.venv/bin/pip" install -q --upgrade pip
sudo -u "$OWNER" "$DIR/.venv/bin/pip" install -q -r "$DIR/night-desk/requirements.txt" \
  -r "$DIR/premarket-scanner/requirements.txt" -r "$DIR/post-desk/requirements.txt"

echo "Installing the services (they run as $OWNER)..."
for f in "$DIR"/server/systemd/*.service "$DIR"/server/systemd/*.timer; do
  sed -e "s#@DIR@#$DIR#g" -e "s#@USER@#$OWNER#g" "$f" > "/etc/systemd/system/$(basename "$f")"
done
systemctl daemon-reload
systemctl enable --now nightdesk.service paperbook.service postdesk.service \
  scanner-scan.timer scanner-grade.timer nightdesk-review.timer

echo
bash "$DIR/server/status.sh"
cat <<MSG

Running now: the coin desk (paper money) and the paper book.
Waiting for you:
  - Post Desk starts once you've connected X:  server/README.md, step 5
  - stocks start once premarket-scanner/.env has your Alpaca paper keys:  step 6
MSG
