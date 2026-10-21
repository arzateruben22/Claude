"""Print probe rows for a time window (run probe.cjs first).
python3 -I scripts/probe_range.py FMT T0 T1 [STEP] [copy keys, default title,opus]"""
import json, sys
from pathlib import Path
FILM = Path(__file__).resolve().parent.parent
fmt, t0, t1 = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
step = float(sys.argv[4]) if len(sys.argv) > 4 else 0.25
keys = sys.argv[5].split(",") if len(sys.argv) > 5 else ["title", "opus"]
D = json.loads((FILM / "build" / "qa" / f"{fmt}-probe.json").read_text())
W, H = D["width"], D["height"]
t = t0
while t <= t1 + 1e-9:
    r = D["rows"][min(len(D["rows"]) - 1, round(t * 30))]
    fr = r["framing"]
    m = f"mascot c=({fr['cx']:.2f},{fr['cy']:.2f}) x[{fr['x0']:.2f},{fr['x1']:.2f}] y[{fr['y0']:.2f},{fr['y1']:.2f}]" if fr.get("visible") else "mascot -"
    cs = " | ".join(f"{k} {'IN ' if r['copy'][k]['inFrame'] else 'out'} x{r['copy'][k]['x0']:.0f}..{r['copy'][k]['x1']:.0f} y{r['copy'][k]['y0']:.0f} h{r['copy'][k]['h']:.0f} coc{r['copy'][k]['coc']:.1f}" for k in keys)
    print(f"{t:5.2f} {m} | {cs} | K{r['K']} mpx{r['motionPx']:.0f}")
    t += step
