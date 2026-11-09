"""Writes the English .srt for a finished episode from its film.json captions (one cue per caption page, word-timed pages).

    python3 -I films/channels/whatif/srt.py films/channels/whatif/ep09 possibility-lab-s2e03

Writes <episode>/out/<name>-9x16.srt.
"""
import json
import sys
from pathlib import Path

ep, name = Path(sys.argv[1]), sys.argv[2]
film = json.loads((ep / "film.json").read_text())
ts = lambda t: f"{int(t // 3600):02d}:{int(t % 3600 // 60):02d}:{int(t % 60):02d},{int(round((t % 1) * 1000)):03d}".replace(",1000", ",999")
rows, n = [], 0
for pg in film["captions"]:
    text = "\n".join(" ".join(w for w, _ in ln) for ln in pg["lines"])
    n += 1
    rows.append(f"{n}\n{ts(pg['t0'])} --> {ts(pg['t1'])}\n{text}\n")
out = ep / "out"; out.mkdir(exist_ok=True)
(out / f"{name}-9x16.srt").write_text("\n".join(rows), encoding="utf-8")
print("wrote", out / f"{name}-9x16.srt", n, "cues")
