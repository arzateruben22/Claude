#!/usr/bin/env bash
# One-time setup on an always-on Linux machine (Ubuntu or Debian). From the repo folder:
#   sudo bash server/setup.sh
# Safe to run again after `git pull`: it refreshes the packages and the services.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Run it with sudo: sudo bash server/setup.sh"; exit 1; }
DIR="$(cd "$(dirname "$0")/.." && pwd)"
OWNER="${SUDO_USER:-root}"
# A new server is often still installing its own updates: wait for them, and never stop to ask questions.
export DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a
APT="apt-get -o DPkg::Lock::Timeout=600"

echo "Installing Python..."
$APT update -qq
$APT install -y -qq python3 python3-venv python3-pip git > /dev/null

echo "Installing the desks' packages into $DIR/.venv ..."
sudo -u "$OWNER" python3 -m venv "$DIR/.venv"
sudo -u "$OWNER" "$DIR/.venv/bin/pip" install -q --upgrade pip
sudo -u "$OWNER" "$DIR/.venv/bin/pip" install -q -r "$DIR/night-desk/requirements.txt" \
  -r "$DIR/premarket-scanner/requirements.txt" -r "$DIR/post-desk/requirements.txt" \
  -r "$DIR/majors-desk/requirements.txt"

echo "Installing the services (they run as $OWNER)..."
for f in "$DIR"/server/systemd/*.service "$DIR"/server/systemd/*.timer; do
  sed -e "s#@DIR@#$DIR#g" -e "s#@USER@#$OWNER#g" "$f" > "/etc/systemd/system/$(basename "$f")"
done
systemctl daemon-reload
systemctl enable --now scanner-scan.timer scanner-grade.timer nightdesk-review.timer watchdog.timer backup.timer
systemctl enable nightdesk.service majors.service paperbook.service postdesk.service
# (Re)start so a `git pull` takes effect. The desks save open paper positions on the way out and resume them.
# Post Desk only starts once X is connected.
systemctl restart nightdesk.service majors.service paperbook.service postdesk.service

echo
bash "$DIR/server/status.sh"
cat <<MSG

Running now (paper money): memecoins, big coins (BTC, ETH, XRP, ADA...) and the paper book.
Next:
  bash server/keys.sh        your keys (Alpaca for stocks; X and Claude for posting)
  bash server/connect-x.sh   connect your X account, then posting starts
  bash server/alerts.sh      phone alerts if a desk stops or has a bad day, plus an evening summary
Backups of the paper records run every night (sudo bash server/backup.sh to make one now).
MSG
