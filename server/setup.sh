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
# Units from older versions (one service per rulebook): every rulebook now runs inside its market's service.
for old in majors-4h scanner-wild-scan scanner-wild-grade scanner-fade-scan scanner-fade-grade \
           scanner-quick-scan scanner-quick-grade scanner-early-scan scanner-early-grade; do
  for f in /etc/systemd/system/$old.service /etc/systemd/system/$old.timer; do
    if [ -e "$f" ]; then systemctl disable --now "$(basename "$f")" 2>/dev/null || true; rm -f "$f"; fi
  done
done
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

Running now (paper money): twenty desks, each on its own \$100 of paper money, and the paper book. The clear
losers were retired on 22 Oct 2026 (their rulebooks are kept in each market's retired/ folder). The Trading Deck
lines them all up: bash server/status.sh shows where to open it. To test every rulebook against history, one at
a time and safely in the background: bash server/prove.sh
Next:
  bash server/keys.sh        your keys (Alpaca for stocks; X and Claude for posting)
  bash server/connect-x.sh   connect your X account, then posting starts
  bash server/alerts.sh      phone alerts if a desk stops or has a bad day, plus an evening summary
Backups of the paper records run every night (sudo bash server/backup.sh to make one now).
MSG
