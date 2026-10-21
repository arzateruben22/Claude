#!/usr/bin/env bash
# Installs or updates the OC Ultra live server on the desks' machine. server/setup.sh runs it after the desks are up,
# and a failure here never stops the desks. By hand, from the repo folder:
#   sudo bash server/live-install.sh
# It installs Node 22 if needed, builds the game page (about 530 MB of memory at its peak, so a 1 GB swap file is
# added when the machine has less than 2 GB and no swap), installs the server's one package, writes
# /etc/oc-live.env the first time (the cap of 25 and a random admin token), and (re)starts oc-live on
# 127.0.0.1:8791. Nobody outside can reach it until server/live.sh puts it on a public address.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Run it with sudo: sudo bash server/live-install.sh"; exit 1; }
DIR="$(cd "$(dirname "$0")/.." && pwd)"
OWNER="${SUDO_USER:-root}"
GAME="$DIR/top-speed-ultra"
export DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm_config_fund=false npm_config_audit=false
APT="apt-get -o DPkg::Lock::Timeout=600"
# the desks' user builds (its own HOME, so npm's cache is its own); no browser download for the test tool
as_owner() { sudo -u "$OWNER" -H env PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm_config_fund=false npm_config_audit=false "$@"; }

echo "Live server: checking Node..."
need_node() { ! command -v node > /dev/null || [ "$(node -p 'process.versions.node.split(".").map(Number).reduce((a, v, i) => a + v * [1e6, 1e3, 1][i], 0)')" -lt 22013000 ]; }
if need_node; then
  $APT install -y -qq ca-certificates curl gnupg > /dev/null
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - > /dev/null
  $APT install -y -qq nodejs > /dev/null
fi
echo "  node $(node -v)"

mem_mb=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
if [ "$mem_mb" -lt 2000 ] && [ "$(swapon --noheadings | wc -l)" = 0 ] && [ ! -f /swapfile ]; then
  echo "Live server: adding a 1 GB swap file (this machine has ${mem_mb} MB and the game build peaks near 530 MB)..."
  fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile > /dev/null && swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "Live server: building the game page (a minute or two)..."
cd "$GAME"
as_owner npm ci --no-audit --no-fund --loglevel=error > /dev/null
as_owner env NODE_OPTIONS=--max-old-space-size=900 npx vite build --logLevel error > /dev/null
as_owner node scripts/single-file.mjs
echo "Live server: installing its package..."
cd "$GAME/live"
as_owner npm ci --omit=dev --no-audit --no-fund --loglevel=error > /dev/null
sudo -u "$OWNER" mkdir -p "$GAME/live/data"

if [ ! -f /etc/oc-live.env ]; then
  umask 077
  cat > /etc/oc-live.env <<ENV
# OC Ultra live server settings. sudo bash server/live.sh changes the public address and the traffic key;
# sudo bash server/live-cap.sh 50 changes the cap. Restart after editing by hand: sudo systemctl restart oc-live
MAX_PLAYERS=25
ADMIN_TOKEN=$(head -c 24 /dev/urandom | base64 | tr -d '/+=')
NOW_WEATHER=nws
NOW_TRAFFIC=off
TOMTOM_KEY=
ENV
  chmod 600 /etc/oc-live.env
fi

sed -e "s#@DIR@#$DIR#g" -e "s#@USER@#$OWNER#g" "$DIR/server/systemd/oc-live.service" > /etc/systemd/system/oc-live.service
systemctl daemon-reload
systemctl enable oc-live.service > /dev/null 2>&1
systemctl restart oc-live.service
for i in $(seq 1 20); do curl -fs http://127.0.0.1:8791/health > /dev/null && break; sleep 0.5; done
if curl -fs http://127.0.0.1:8791/health > /dev/null; then
  echo "Live server: running on 127.0.0.1:8791 ($(curl -fs http://127.0.0.1:8791/health | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const h=JSON.parse(s);console.log(`cap ${h.cap}, ${h.players} signed up, weather feed ${h.feeds.weather}, traffic feed ${h.feeds.traffic}`)})'))"
else
  echo "Live server: did not answer. See: journalctl -u oc-live -n 40"; exit 1
fi
