#!/usr/bin/env bash
# Puts the OC Ultra live server (installed by setup.sh) on a public https address, so anyone can open the game,
# sign up and drive, and optionally turns on live freeway traffic. From the repo folder:
#   sudo bash server/live.sh                              free: a Tailscale Funnel address (https://<machine>.<tailnet>.ts.net)
#   sudo LIVE_DOMAIN=live.example.com bash server/live.sh your own domain, pointed at this machine, with Caddy
# Run it again any time; it checks the public address end to end (the page, the API and the game's socket).
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Run it with sudo: sudo bash server/live.sh"; exit 1; }
DIR="$(cd "$(dirname "$0")/.." && pwd)"
curl -fs http://127.0.0.1:8791/health > /dev/null || bash "$DIR/server/live-install.sh"

set_env() { bash "$DIR/server/live-env.sh" "$1" "$2"; }

if [ -n "${LIVE_DOMAIN:-}" ]; then
  echo "Public address: https://$LIVE_DOMAIN with Caddy (its A record must point at this machine)..."
  if ! command -v caddy > /dev/null; then
    apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl gnupg > /dev/null
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -qq && apt-get install -y -qq caddy > /dev/null
  fi
  cp "$DIR/top-speed-ultra/live/deploy/Caddyfile" /etc/caddy/Caddyfile
  mkdir -p /etc/systemd/system/caddy.service.d
  printf '[Service]\nEnvironment=LIVE_DOMAIN=%s\n' "$LIVE_DOMAIN" > /etc/systemd/system/caddy.service.d/oc-live.conf
  systemctl daemon-reload && systemctl enable caddy > /dev/null 2>&1 && systemctl restart caddy
  URL="https://$LIVE_DOMAIN"
else
  echo "Public address: Tailscale Funnel (free, no domain needed)..."
  command -v tailscale > /dev/null || curl -fsSL https://tailscale.com/install.sh | sh
  tailscale status > /dev/null 2>&1 || tailscale up        # the first time, it prints a link: open it and sign in
  if ! tailscale funnel --bg 8791; then        # https on 443 to 127.0.0.1:8791
    cat <<MSG

Funnel isn't on for this machine yet. Tailscale printed a link above, or:
  1. Open https://login.tailscale.com/admin/dns and turn on MagicDNS and HTTPS Certificates.
  2. In the access controls, let this machine use Funnel (the "funnel" node attribute; Tailscale's admin page
     offers to add it).
  3. Run this script again.
Or use your own domain instead: sudo LIVE_DOMAIN=live.example.com bash server/live.sh
MSG
    exit 1
  fi
  HOST="$(tailscale status --json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).Self.DNSName.replace(/\.$/,"")))')"
  URL="https://$HOST"
fi

# live traffic: a free TomTom developer key (developer.tomtom.com); Enter keeps what's there (or leaves it off)
if [ -t 0 ]; then
  read -r -p "TomTom key for live freeway traffic (Enter to skip): " KEY
  if [ -n "$KEY" ]; then
    [[ "$KEY" =~ ^[A-Za-z0-9_-]{8,128}$ ]] || { echo "That doesn't look like a TomTom key (letters and numbers)."; exit 1; }
    set_env NOW_TRAFFIC tomtom; set_env TOMTOM_KEY "$KEY"; systemctl restart oc-live; sleep 2
  fi
fi

# password reset by email (optional): a free Resend key and a sender on a domain you verified with Resend
if [ -t 0 ] && ! grep -q '^RESEND_KEY=.\+' /etc/oc-live.env; then
  read -r -p "Resend API key for password-reset emails (Enter to skip; needs your own domain): " RKEY
  if [ -n "$RKEY" ]; then
    [[ "$RKEY" =~ ^re_[A-Za-z0-9_]{8,128}$ ]] || { echo "Resend keys start with re_."; exit 1; }
    read -r -p "Send from (an address on a domain verified with Resend, e.g. OC Ultra <noreply@yourdomain.com>): " RFROM
    [[ "$RFROM" == *@*.* && "$RFROM" != *$'\n'* ]] || { echo "That doesn't look like an email address."; exit 1; }
    set_env RESEND_KEY "$RKEY"; set_env MAIL_FROM "$RFROM"; systemctl restart oc-live; sleep 2
  fi
fi

echo "Checking $URL end to end..."
ok=1
for i in $(seq 1 30); do curl -fs "$URL/health" > /dev/null && break; sleep 2; done
curl -fs "$URL/health" > /dev/null && echo "  the API answers" || { echo "  the API doesn't answer at $URL/health yet (a new certificate can take a minute; run this again)"; ok=0; }
curl -fsI "$URL/" | grep -qi 'text/html' && echo "  the game page is served" || { echo "  the game page isn't served"; ok=0; }
if node -e '
  const ws = new WebSocket(process.argv[1].replace(/^http/, "ws") + "/ws");
  const t = setTimeout(() => { console.log("  the socket: no answer"); process.exit(1); }, 10000);
  ws.onopen = () => ws.send(JSON.stringify({ t: "hello", token: "a-check-from-live.sh-not-a-real-token" }));
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.t === "bye") { clearTimeout(t); console.log("  the socket works (it refused a made-up log-in, as it should)"); process.exit(0); } };
  ws.onerror = () => { clearTimeout(t); console.log("  the socket failed to connect"); process.exit(1); };
' "$URL"; then :; else ok=0; fi
grep -q '^TOMTOM_KEY=.\+' /etc/oc-live.env && echo "  live traffic: on (TomTom)" || echo "  live traffic: off (simulated typical day); run this again with a TomTom key to turn it on"
grep -q '^RESEND_KEY=.\+' /etc/oc-live.env && echo "  password reset by email: on" || echo "  password reset by email: off (players can still change their password while signed in)"
echo
if [ "$ok" = 1 ]; then
  cat <<MSG
OC Ultra live is public at:
  $URL
Open it on your phone, tap Account under "Live · alpha", sign up, turn on "Drive live", and Drive.
Send the same link to anyone: up to $(grep '^MAX_PLAYERS=' /etc/oc-live.env | cut -d= -f2) drive at once, the rest wait in line.
  bash server/live-status.sh        who's on, the cap, the feeds
  sudo bash server/live-cap.sh 50   raise the cap (no restart)
MSG
else
  echo "Something above isn't right yet. Logs: journalctl -u oc-live -n 40"
  exit 1
fi
