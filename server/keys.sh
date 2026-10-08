#!/usr/bin/env bash
# Put your keys where the desks look for them, without opening an editor. From the repo folder:
#   bash server/keys.sh
# Press Enter to skip anything you don't have yet; run it again later to add the rest.
# Keys stay on this machine, in files only your user can read.
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"

ask() {      # prompt, hidden?
  local value
  if [ -n "${2:-}" ]; then read -r -s -p "$1: " value; echo >&2; else read -r -p "$1: " value; fi
  printf '%s' "$value"
}

set_key() {  # .env file, KEY, value
  local file="$1" key="$2" value="$3"
  [ -n "$value" ] || return 0
  if [ ! -f "$file" ] && [ -f "$(dirname "$file")/.env.example" ]; then
    cp "$(dirname "$file")/.env.example" "$file"
  fi
  touch "$file"
  chmod 600 "$file"
  { grep -v "^${key}=" "$file" || true; printf '%s=%s\n' "$key" "$value"; } > "$file.tmp"
  mv "$file.tmp" "$file"
  chmod 600 "$file"
  echo "  saved $key"
}

echo "STOCKS: your free Alpaca *paper* account (alpaca.markets > Paper > API keys)"
akey="$(ask '  Alpaca API key ID')"
asecret="$(ask '  Alpaca secret key (hidden)' hidden)"
akey="${akey//[[:space:]]/}"
asecret="${asecret//[[:space:]]/}"
if [ -n "$asecret" ] && { [ "$asecret" = "$akey" ] || [ "${#asecret}" -lt 30 ]; }; then
  echo "  That secret doesn't look right: it's about 40 characters and different from the key ID."
  echo "  (Often the key ID was still copied.) Not saved. Copy the secret again and rerun: bash server/keys.sh"
  asecret=""
fi
set_key "$DIR/premarket-scanner/.env" ALPACA_API_KEY "$akey"
set_key "$DIR/premarket-scanner/.env" ALPACA_SECRET_KEY "$asecret"
if [ -n "$akey$asecret" ] && [ -x "$DIR/.venv/bin/python" ]; then
  echo "  checking them with Alpaca..."
  (cd "$DIR/premarket-scanner" && "$DIR/.venv/bin/python" -m scanner doctor 2>&1 | tail -n 1 | sed 's/^/  /') || true
fi

echo
echo "POSTING ON X: your X developer app (developer.x.com > your app > Keys and tokens > OAuth 2.0)"
set_key "$DIR/post-desk/.env" X_CLIENT_ID "$(ask '  OAuth 2.0 Client ID')"
set_key "$DIR/post-desk/.env" X_CLIENT_SECRET "$(ask '  OAuth 2.0 Client Secret (hidden)' hidden)"
echo "CLAUDE: the writer (console.anthropic.com > API keys)"
claude="$(ask '  Claude API key (hidden)' hidden)"
set_key "$DIR/post-desk/.env" ANTHROPIC_API_KEY "$claude"
set_key "$DIR/night-desk/.env" ANTHROPIC_API_KEY "$claude"
# the scanner's .env switches the stock timers on, so only touch it once the Alpaca keys are there
[ -f "$DIR/premarket-scanner/.env" ] && set_key "$DIR/premarket-scanner/.env" ANTHROPIC_API_KEY "$claude"

handle="$(ask '  Your X handle, without the @')"
if [ -n "$handle" ]; then
  if [[ "$handle" =~ ^@?[A-Za-z0-9_]{1,15}$ ]]; then
    sed -i "s/^handle = \".*\"/handle = \"${handle#@}\"/" "$DIR/post-desk/desk.toml"
    echo "  saved @${handle#@} in post-desk/desk.toml"
  else
    echo "  that doesn't look like an X handle (letters, numbers and _ only); skipped"
  fi
fi

echo
echo "Done. Stocks start at the next weekday scan (5:35am Pacific)."
echo "To start posting: bash server/connect-x.sh"
