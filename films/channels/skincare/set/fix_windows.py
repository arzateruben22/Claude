"""Rewrite a script's planned windows (a-b s) from the voiced line lengths and the directions' holds (so lint paces measure the real thing)."""
import json, re, sys
from pathlib import Path
d = Path(__file__).resolve().parent.parent / sys.argv[1]; s = (d / "script.md").read_text()
dur = {l["beat"]: l["dur"] for l in json.load(open(d / "vo/lines.json"))["lines"]}
t, out = 0.0, s
for m in re.finditer(r"^(## (\w+) \{(.*?)\}) \(([\d.]+)[–-]([\d.]+) s\)$", s, re.M):
    beat, dr = m.group(2), m.group(3); pre = 0.05 if "pre: 0.05" in dr else 0.3
    mh, me = re.search(r"picture-only ([\d.]+) s", dr), re.search(r"end card held ≥ ([\d.]+) s", dr)
    hold = float(mh.group(1)) if mh else float(me.group(1)) if me else 0.4
    b = t + pre + dur[beat] + hold; out = out.replace(m.group(0), f"{m.group(1)} ({t:.1f}–{b:.1f} s)"); t = b
(d / "script.md").write_text(out)
