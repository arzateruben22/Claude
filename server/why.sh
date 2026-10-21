#!/usr/bin/env bash
# No trades yet? Why, desk by desk, in plain words. From the repo folder:
#   bash server/why.sh
# It only reads. Paper money only.
set -uo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
PY="$DIR/.venv/bin/python"
pacific() { [ -n "$1" ] && [ "$1" != "n/a" ] && TZ=America/Los_Angeles date -d "$1" '+%a %d %b, %-I:%M %p Pacific' 2>/dev/null; }

memecoins() {   # $1: the desk's state.json
"$PY" - "$1" <<'PYEOF'
import json, os, sys, time
path = sys.argv[1]
if not os.path.exists(path):
    print("  Nothing saved yet. A desk saves within a minute of starting, so if it was just updated, look again")
    print("  in a minute. Still nothing after a few minutes? journalctl -u nightdesk -n 30 --no-pager")
    sys.exit()
s = json.load(open(path))
c = s.get("counts", {})
seen, killed, judged, yes, bought = (c.get(k, 0) for k in ("seen", "killed", "judged", "yes", "bought"))
print(f"  {seen} new coins checked since the start")
print(f"  {killed} failed a rug check and were thrown out for good")
print(f"  {max(0, seen - killed - judged)} never got busy or safe enough to qualify (or are still being watched)")
print(f"  {judged} passed every check and were judged · {yes} judged worth buying · {bought} bought")
signs = sorted(s.get("kill_rules", {}).items(), key=lambda kv: -kv[1])[:3]
if signs:
    print("  most common rug signs: " + ", ".join(f"{rule} ({n})" for rule, n in signs))
waits = sorted(s.get("wait_rules", {}).items(), key=lambda kv: -kv[1])[:5]
if waits:
    print("  rules the others were still failing when their 90 minutes ran out:")
    for rule, n in waits:
        print(f"    {rule}: {n}")
near = sorted(s.get("near_miss", {}).items(), key=lambda kv: -kv[1])[:3]
if near:
    print("  close calls (failed just one rule): " + ", ".join(f"{rule} ({n})" for rule, n in near))
elif seen and not waits:
    print("  (why the others never qualified shows up here about 90 minutes after the latest update)")
held = s.get("positions", [])
if held:
    print("  holding now: " + ", ".join("$" + p["symbol"] for p in held))
age = (time.time() - os.path.getmtime(path)) / 60
if age > 5:
    print(f"  ! last saved {age:.0f} minutes ago, so it may be stuck: journalctl -u nightdesk -n 30 --no-pager")
if not seen:
    print("  ! it hasn't found a single new coin, so it may not be reaching DexScreener: journalctl -u nightdesk -n 30 --no-pager")
PYEOF
}

stocks() {   # $1: the journal
"$PY" - "$1" <<'PYEOF'
import csv, os, sys
path = sys.argv[1]
rows = list(csv.DictReader(open(path, newline=""))) if os.path.exists(path) else []
waiting = [r for r in rows if not r.get("sim_pnl_pct")]
graded = [r for r in rows if r.get("sim_pnl_pct")]
if not rows:
    print("  No picks yet. A stock has to pass every rule (gap, volume, price, spread...); some days none do.")
else:
    print(f"  {len(graded)} picks graded so far")
    if waiting:
        print("  bought at the open on their trade day: " + ", ".join(f"{r['symbol']} ({r['trade_date']})" for r in waiting[:8]))
    pnl = [float(r["sim_pnl_pct"]) for r in graded]
    if pnl:
        print(f"  won {sum(p > 0 for p in pnl)} of {len(pnl)} · average {sum(pnl) / len(pnl):+.1f}% a pick after costs")
    moves = [float(r["close_vs_open_pct"]) for r in graded if r.get("close_vs_open_pct")]
    if moves:
        down = sum(m < 0 for m in moves)
        print(f"  fade check: {down} of {len(moves)} closed below their 9:30 open (measured only, never bet on)")
PYEOF
}

echo "MEMECOINS"
memecoins "$DIR/night-desk/output/live/state.json"

echo
echo "WILD MEMECOINS (same coins, riskier rules, own \$100)"
memecoins "$DIR/night-desk/output/wild/live/state.json"

echo
echo "STRICT MEMECOINS (same coins, pickier rules and smaller bets, own \$100)"
memecoins "$DIR/night-desk/output/strict/live/state.json"

echo
echo "BIG COINS"
(cd "$DIR/majors-desk" && "$PY" -m majors why | sed 's/^/  /')

echo
echo "BIG COINS 4H (same rules on 4-hour candles, own \$100)"
(cd "$DIR/majors-desk" && "$PY" -m majors why --book 4h | sed 's/^/  /')

echo
echo "STOCKS"
stocks "$DIR/premarket-scanner/output/journal.csv"

echo
echo "QUICK STOCKS (the same picks, sold at +5% or -3%, own \$100)"
stocks "$DIR/premarket-scanner/output/quick/journal.csv"

echo
echo "EARLY-OUT STOCKS (the same picks, out by 10:30 New York time, own \$100)"
stocks "$DIR/premarket-scanner/output/early/journal.csv"

echo
echo "WILD STOCKS (smaller gaps, no news needed, own \$100)"
stocks "$DIR/premarket-scanner/output/wild/journal.csv"

echo
echo "FADE STOCKS (the stock picks, sold short at the open, own \$100: it wins when they fall)"
stocks "$DIR/premarket-scanner/output/fade/journal.csv"
last="$(pacific "$(systemctl show scanner-scan.service -p ExecMainExitTimestamp --value 2>/dev/null)")"
next="$(pacific "$(systemctl show scanner-scan.timer -p NextElapseUSecRealtime --value 2>/dev/null)")"
[ -n "$last" ] && echo "  last scan: $last"
[ -n "$next" ] && echo "  next scan: $next"
exit 0
