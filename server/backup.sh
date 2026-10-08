#!/usr/bin/env bash
# A copy of every desk's paper records (never keys or tokens), kept for 30 days in /var/backups/desks.
# The backup timer runs it at 3:30am Pacific. By hand, from the repo folder:
#   sudo bash server/backup.sh
# To restore one: stop the desks, then unpack it over the repo folder:
#   sudo systemctl stop nightdesk majors paperbook
#   sudo tar -xzf /var/backups/desks/desks-YYYY-MM-DD-HHMM.tar.gz -C ~/desks
#   sudo systemctl start nightdesk majors paperbook
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Run it with sudo: sudo bash server/backup.sh"; exit 1; }
DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${BACKUP_DIR:-/var/backups/desks}"
KEEP="${BACKUP_KEEP:-30}"
STAMP="$(date +%Y-%m-%d-%H%M)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$DEST"
chmod 700 "$DEST"

cd "$DIR"
for p in night-desk/output/live night-desk/output/archive majors-desk/output/live majors-desk/output/archive \
         premarket-scanner/output/journal.csv premarket-scanner/output/archive \
         paper-book/output/ledger.csv paper-book/output/benchmark.json paper-book/output/archive; do
  if [ -e "$p" ]; then
    cp -a --parents "$p" "$WORK/"
  fi
done
if [ -f post-desk/output/live/desk.db ]; then          # a consistent copy, even while Post Desk is writing
  mkdir -p "$WORK/post-desk/output/live"
  "$DIR/.venv/bin/python" -c 'import sqlite3, sys
src, dst = sqlite3.connect(sys.argv[1]), sqlite3.connect(sys.argv[2])
src.backup(dst); dst.close(); src.close()' post-desk/output/live/desk.db "$WORK/post-desk/output/live/desk.db"
fi

tar -czf "$DEST/desks-$STAMP.tar.gz" -C "$WORK" .
chmod 600 "$DEST/desks-$STAMP.tar.gz"
ls -1t "$DEST"/desks-*.tar.gz | tail -n +"$((KEEP + 1))" | xargs -r rm -f --
echo "saved $DEST/desks-$STAMP.tar.gz ($(du -h "$DEST/desks-$STAMP.tar.gz" | cut -f1)); keeping the newest $KEEP"
