#!/usr/bin/env bash
# The proving ground: replay every running rulebook against history, one at a time, in the background.
#   bash server/prove.sh           start it (returns at once; you can close Termius)
#   bash server/prove.sh status    what it has done so far
# Big coins: the past four years of Coinbase prices (2022's crash, the 2023-24 run-up, this year's fall), quarter
# by quarter against just holding. Stocks: every trading day since 2 January, month by month (needs the Alpaca
# keys). One test at a time, at low priority, because a stock replay needs about 600 MB: the live desks come first.
# The first run downloads history (about an hour); later runs reuse it. The paper book's Proving Ground page
# (/proving, next to the deck) grades the results. Memecoins can't be replayed: nobody keeps that history.
# Paper money only. It reads prices and writes test results; it never changes a desk or places an order.
set -uo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
PY="${PY:-$DIR/.venv/bin/python}"
LOG="$DIR/paper-book/output/proving.log"
COIN_DAYS="${COIN_DAYS:-1460}"
STOCKS_FROM="${STOCKS_FROM:-2026-01-02}"
DEMO="${DEMO:+--demo}"            # DEMO=1 bash server/prove.sh: the same on invented prices, to try it out
mkdir -p "$DIR/paper-book/output"

case "${1:-}" in
  status)
    if pgrep -f "prove.sh run" > /dev/null; then echo "Still running."; else echo "Not running."; fi
    [ -f "$LOG" ] && grep -E "^(==|  |Saved|Done|Couldn)" "$LOG" | tail -n 40
    exit 0 ;;
  run) ;;
  *)
    if pgrep -f "prove.sh run" > /dev/null; then
      echo "Already running. See how far it got: bash server/prove.sh status"; exit 0
    fi
    nohup nice -n 10 bash "$0" run > "$LOG" 2>&1 &
    echo "Started. It runs one test at a time in the background (about an hour the first time)."
    echo "  progress:  bash server/prove.sh status"
    echo "  results:   the Proving Ground page (/proving) or: $PY $DIR/paper-book/paperbook.py --proving"
    exit 0 ;;
esac

echo "Proving ground started $(date -u '+%Y-%m-%d %H:%M') UTC"
for f in "$DIR"/majors-desk/majors-*.toml; do
  b="$(basename "$f" .toml)"; b="${b#majors-}"
  echo "== big coins: $b ($COIN_DAYS days)"
  (cd "$DIR/majors-desk" && "$PY" -m majors backtest $DEMO --days "$COIN_DAYS" --book "$b" | sed 's/^/  /') \
    || echo "  Couldn't finish $b; the others carry on."
done
for b in main $(cd "$DIR/premarket-scanner" && ls criteria-*.toml 2>/dev/null | sed 's/^criteria-//; s/\.toml$//'); do
  echo "== stocks: $b (from $STOCKS_FROM)"
  (cd "$DIR/premarket-scanner" && "$PY" -m scanner backtest $DEMO --from "$STOCKS_FROM" --book "$b" \
     | grep -E "^Paper results|^  All |^  2026-|^Sum of sim|^Saved" | sed 's/^/  /') \
    || echo "  Couldn't finish $b; the others carry on."
done
"$PY" "$DIR/paper-book/paperbook.py" $DEMO > /dev/null 2>&1 || true   # rebuild the pages now, not in 15 minutes
echo
"$PY" "$DIR/paper-book/paperbook.py" $DEMO --proving
echo "Done $(date -u '+%Y-%m-%d %H:%M') UTC"
