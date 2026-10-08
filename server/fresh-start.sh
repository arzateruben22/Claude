#!/usr/bin/env bash
# Start the paper book over from today. Every desk's live paper results so far move to an archive folder
# (nothing is deleted), and each desk starts again with the paper bank in its settings. From the repo folder:
#   sudo bash server/fresh-start.sh
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Run it with sudo: sudo bash server/fresh-start.sh"; exit 1; }
DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y-%m-%d-%H%M)"

echo "This starts every desk over from today: memecoins, big coins and stocks go back to the"
echo "paper bank in their settings, and the results so far move to an archive folder."
read -r -p "Start over now? (y/n) " ok
case "$ok" in y|Y|yes|Yes|YES) ;; *) echo "Nothing changed."; exit 0 ;; esac

systemctl stop nightdesk.service majors.service paperbook.service
for d in night-desk majors-desk; do
  if [ -d "$DIR/$d/output/live" ]; then
    mkdir -p "$DIR/$d/output/archive"
    mv "$DIR/$d/output/live" "$DIR/$d/output/archive/live-$STAMP"
    echo "archived $d/output/live -> $d/output/archive/live-$STAMP"
  fi
done
if [ -f "$DIR/premarket-scanner/output/journal.csv" ]; then
  mkdir -p "$DIR/premarket-scanner/output/archive"
  mv "$DIR/premarket-scanner/output/journal.csv" "$DIR/premarket-scanner/output/archive/journal-$STAMP.csv"
  echo "archived premarket-scanner/output/journal.csv -> premarket-scanner/output/archive/journal-$STAMP.csv"
fi
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
