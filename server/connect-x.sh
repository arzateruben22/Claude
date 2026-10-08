#!/usr/bin/env bash
# Connect your X account to Post Desk (once), then start it. From the repo folder:
#   bash server/connect-x.sh
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR/post-desk"
if ! grep -q '^X_CLIENT_ID=.' .env 2>/dev/null; then
  echo "First add your X app's keys: bash server/keys.sh"
  exit 1
fi
../.venv/bin/python -m postdesk auth --paste
echo
../.venv/bin/python -m postdesk doctor --online || true
echo
sudo systemctl start postdesk && echo "Post Desk is running. Drafts start arriving; nothing posts until you approve it."
