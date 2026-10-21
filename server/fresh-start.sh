#!/usr/bin/env bash
# Start the paper book over from today. Every desk's live paper results so far move to an archive folder
# (nothing is deleted), and each desk starts again with the paper bank in its settings. From the repo folder:
#   sudo bash server/fresh-start.sh
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Run it with sudo: sudo bash server/fresh-start.sh"; exit 1; }
DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y-%m-%d-%H%M)"

echo "This starts every desk over from today: each goes back to the"
echo "paper bank in their settings, and the results so far move to an archive folder."
read -r -p "Start over now? (y/n) " ok
case "$ok" in y|Y|yes|Yes|YES) ;; *) echo "Nothing changed."; exit 0 ;; esac

systemctl stop nightdesk.service majors.service paperbook.service
# Every coin rulebook keeps its live results in <desk>/output/live or <desk>/output/<book>/live.
for live in "$DIR"/night-desk/output/live "$DIR"/night-desk/output/*/live "$DIR"/majors-desk/output/live "$DIR"/majors-desk/output/*/live; do
  base="${live%/live}"; base="${base#$DIR/}"
  if [ -d "$DIR/$base/live" ]; then
    mkdir -p "$DIR/$base/archive"
    mv "$DIR/$base/live" "$DIR/$base/archive/live-$STAMP"
    echo "archived $base/live -> $base/archive/live-$STAMP"
  fi
done
for journal in "$DIR"/premarket-scanner/output/journal.csv "$DIR"/premarket-scanner/output/*/journal.csv; do
  base="${journal%/journal.csv}"; base="${base#$DIR/}"
  if [ -f "$DIR/$base/journal.csv" ]; then
    mkdir -p "$DIR/$base/archive"
    mv "$DIR/$base/journal.csv" "$DIR/$base/archive/journal-$STAMP.csv"
    echo "archived $base/journal.csv -> $base/archive/journal-$STAMP.csv"
  fi
done
if [ -f "$DIR/paper-book/output/benchmark.json" ]; then     # BTC buy-and-hold starts again from today too
  mkdir -p "$DIR/paper-book/output/archive"
  mv "$DIR/paper-book/output/benchmark.json" "$DIR/paper-book/output/archive/benchmark-$STAMP.json"
fi
systemctl start nightdesk.service majors.service paperbook.service
sleep 5

echo
bash "$DIR/server/status.sh"
echo
echo "Day one: $(TZ=America/Los_Angeles date '+%A %d %B %Y, %H:%M') Pacific. Every paper profit and loss counts from here."
