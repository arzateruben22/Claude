#!/usr/bin/env bash
# Sets up the OC Ultra live server on a fresh Ubuntu 24.04 machine (a $6 DigitalOcean Droplet is enough to start).
#
#   sudo LIVE_DOMAIN=live.example.com bash deploy/setup.sh
#
# Run it from the repo's top-speed-ultra/live folder (clone the repo first: see README.md). It installs Node 22 and
# Caddy, copies the server to /opt/oc-live, builds nothing (the game's built page goes in /opt/oc-live/public if
# dist/top-speed-ultra.html exists next to this folder), writes /etc/oc-live.env, and starts both services. Run it
# again after a git pull to update: the database in /opt/oc-live/data is kept.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "run with sudo"; exit 1; }
: "${LIVE_DOMAIN:?set LIVE_DOMAIN=your.domain, pointed at the IP of this machine, before running}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
CAP="${MAX_PLAYERS:-25}"

echo "== packages"
if ! command -v node >/dev/null || [ "$(node -e 'console.log(process.versions.node.split(".")[0])')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
if ! command -v caddy >/dev/null; then
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update && apt-get install -y caddy
fi

echo "== user and files"
id oclive >/dev/null 2>&1 || useradd --system --home /opt/oc-live --shell /usr/sbin/nologin oclive
mkdir -p /opt/oc-live/data /opt/oc-live/public
for f in server.mjs now.mjs names.mjs ladder.mjs cruise.mjs package.json package-lock.json trends.json traffic-points.json; do
  [ -f "$HERE/$f" ] && install -m 644 "$HERE/$f" "/opt/oc-live/$f"
done
(cd /opt/oc-live && npm install --omit=dev --no-audit --no-fund)
if [ -f "$HERE/../dist/top-speed-ultra.html" ]; then cp "$HERE/../dist/top-speed-ultra.html" /opt/oc-live/public/index.html; echo "   the game page is served at https://$LIVE_DOMAIN/"; fi
chown -R root:root /opt/oc-live && chown -R oclive:oclive /opt/oc-live/data && chmod 700 /opt/oc-live/data

echo "== settings (/etc/oc-live.env)"
if [ ! -f /etc/oc-live.env ]; then
  cat > /etc/oc-live.env <<ENV
PORT=8791
HOST=127.0.0.1
MAX_PLAYERS=$CAP
DB_PATH=/opt/oc-live/data/live.db
PUBLIC_DIR=/opt/oc-live/public
TRUST_PROXY=1
ADMIN_TOKEN=$(head -c 24 /dev/urandom | base64 | tr -d '/+=')
LIVE_DOMAIN=$LIVE_DOMAIN
ENV
  chmod 600 /etc/oc-live.env
else
  sed -i "s/^LIVE_DOMAIN=.*/LIVE_DOMAIN=$LIVE_DOMAIN/" /etc/oc-live.env
fi

echo "== services"
cp "$HERE/deploy/oc-live.service" /etc/systemd/system/oc-live.service
cp "$HERE/deploy/Caddyfile" /etc/caddy/Caddyfile
mkdir -p /etc/systemd/system/caddy.service.d
printf '[Service]\nEnvironmentFile=/etc/oc-live.env\n' > /etc/systemd/system/caddy.service.d/oc-live.conf
systemctl daemon-reload
systemctl enable --now oc-live
systemctl restart oc-live
systemctl enable caddy
systemctl restart caddy
sleep 1
echo
echo "== done"
curl -s http://127.0.0.1:8791/health; echo
echo "The live server answers at https://$LIVE_DOMAIN (Caddy fetches the certificate on the first visit; give it a minute)."
echo "Cap: $CAP drivers at a time. Raise it with: bash deploy/cap.sh 50"
echo "Logs: journalctl -u oc-live -f"
