"""Write sheet.json (the studio's cue sheet) for a Skin Sense episode in the new look, from film.json, episode.json and the script's energies.
  python3 -I films/channels/skincare/set/make_sheet.py ep05   then   python3 -I kits/cinema/studio/render.py --root films/channels/skincare/ep05 films/channels/skincare/ep05/sheet.json films/channels/skincare/ep05/audio"""
import json, re, sys
from pathlib import Path
d = Path(__file__).resolve().parent.parent / sys.argv[1]
F = json.load(open(d / "film.json")); EP = json.load(open(d / "episode.json")); C = F["captions"]; LN = F["lines"]
lines = json.load(open(d / "vo/lines.json"))["lines"]
nk = lambda x: re.sub(r"[^a-z0-9-]", "", x.lower())
def R(spec):
    if isinstance(spec, (int, float)): return float(spec)
    m = re.match(r"^(?:(start|end|hold):)?(vo\d+)(?::([^#+]*))?(?:#(\d+))?(?:([+-][\d.]+))?$", spec); kind, vid, word, n, off = m.groups(); o = float(off or 0)
    if kind == "start": return LN[vid][0] + o
    if kind == "end": return LN[vid][1] + o
    if kind == "hold": return LN[vid][1] + 0.4 + o
    return [c for c in C if c["line"] == vid and nk(c["w"]) == nk(word)][int(n or 0)]["t0"] + o
heads = {m.group(1): m.group(2) for m in re.finditer(r"^## (\w+) \{(.*?)\} \(", (d / "script.md").read_text(), re.M)}
energy = lambda b: float((re.search(r"energy: ([\d.]+)", heads.get(b, "")) or [0, 0.4])[1])
ids = [l["id"] for l in lines]; sections = []
for i, l in enumerate(lines):
    t0 = 0.0 if i == 0 else LN[l["id"]][0] - 0.3
    t1 = F["dur"] if i == len(lines) - 1 else LN[ids[i + 1]][0] - 0.3
    sections.append({"id": l["beat"], "t0": round(t0, 3), "t1": round(t1, 3), "energy": energy(l["beat"])})
ev = [{"t": s["t0"], "kind": "section", "id": s["id"], "t1": s["t1"]} for s in sections]
ev.append({"t": 0.9, "kind": "signature", "tag": "title"}); ev.append({"t": round(R(EP["end"]["t"]) + 0.3, 3), "kind": "signature", "tag": "end"})
for i, l in enumerate(EP["labels"]): ev.append({"t": round(R(l["t0"]) + 0.1, 3), "kind": "label", "tag": f"l{i}"})
for i, p in enumerate(EP.get("plates", [])): ev.append({"t": round(R(p["t0"]) + 0.5, 3), "kind": "reveal", "tag": f"p{i}"})
prev = None
for i, k in enumerate(EP["camera"]):
    if prev and prev != k["img"]: ev.append({"t": round(R(k["t"]), 3), "kind": "scale.jump", "tag": f"c{i}"})
    prev = k["img"]
for i, (a, z, tx) in enumerate(EP["badges"]): ev.append({"t": round(R(a) + 0.15, 3), "kind": "badge", "tag": f"b{i}"})
whoa = [l for l in lines if l["beat"] == "whoa"]
if whoa: ev.append({"t": round(LN[whoa[0]["id"]][0], 3), "kind": "swell", "tag": "whoa", "t1": round(LN[whoa[0]["id"]][1] + 1.5, 3)})
ev.sort(key=lambda e: e["t"])
sheet = {"duration": F["dur"], "fps": 30, "preset": "outerlayer-slide", "sections": sections, "events": ev, "voice": [{"id": l["id"], "t": LN[l["id"]][0], "file": f"vo/{l['file']}"} for l in lines]}
json.dump(sheet, open(d / "sheet.json", "w"), indent=1)
print(sys.argv[1], len(ev), "events,", len(sections), "sections")
