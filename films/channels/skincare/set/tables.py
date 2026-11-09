"""Write review/scene-table.md for a Skin Sense episode from its episode.json, film.json and word times.
  python3 -I films/channels/skincare/set/tables.py ep05"""
import json, re, sys
from pathlib import Path
d = Path(__file__).resolve().parent.parent / sys.argv[1]
EP = json.load(open(d / "episode.json")); F = json.load(open(d / "film.json")); C = F["captions"]; LN = F["lines"]
nk = lambda x: re.sub(r"[^a-z0-9-]", "", x.lower())
def R(spec):
    if isinstance(spec, (int, float)): return float(spec)
    m = re.match(r"^(?:(start|end|hold):)?(vo\d+)(?::([^#+]*))?(?:#(\d+))?(?:([+-][\d.]+))?$", spec); kind, vid, word, n, off = m.groups(); o = float(off or 0)
    if kind == "start": return LN[vid][0] + o
    if kind == "end": return LN[vid][1] + o
    if kind == "hold": return LN[vid][1] + 0.4 + o
    return [c for c in C if c["line"] == vid and nk(c["w"]) == nk(word)][int(n or 0)]["t0"] + o
ev = []
for k in EP["camera"]: ev.append((R(k["t"]), f"camera: {k['img']} art, close-up ×{k['s']}"))
for l in EP["labels"]: ev.append((R(l["t0"]), f"pill draws on: {l['text']}"))
for p in EP.get("plates", []):
    ev.append((R(p["t0"]), f"plate (art quiets): {re.sub('<br>', ' ', p['title'])}"))
    for g in p.get("lines", []): ev.append((R(g["t"]), f"plate line appears: {g['text']}"))
    for g in p.get("tags", []): ev.append((R(g["t"]), f"tag appears: {g['text']}"))
    for r in p.get("rows", []): ev.append((R(r["t"]), f"row lights: {r['text']}"))
    for b in p.get("bars", []): ev.append((R(b["t"]), f"bar grows: {b['label']}"))
    if p.get("note"): ev.append((R(p["noteT"]), f"note: {p['note']}"))
for t, h in EP["sup"]: ev.append((R(t), "supporting line: " + h.replace("<br>", " ")))
for a, z, tx in EP["badges"]: ev.append((R(a), f"badge: {tx}"))
for a, z in EP.get("scan", []): ev.append((R(a), "scan line sweeps the picture (illustration)"))
ev.append((R(EP["end"]["t"]), "end card: " + EP["end"]["e1"].replace("<br>", " ") + " · " + EP["end"]["chip"] + " · Narration: synthetic voice (AI)"))
ev.sort(key=lambda x: x[0]); groups = []
for t, txt in ev:
    if groups and t - groups[-1][0] < 0.9: groups[-1][1].append(txt)
    else: groups.append([t, [txt]])
def said(t0, t1):
    ws = [c["w"] for c in C if t0 - 0.05 <= c["t0"] < t1]; return " ".join(ws[:16]) + (" …" if len(ws) > 16 else "")
rows = []; prev = None
for i, (t, txts) in enumerate(groups):
    nxt = groups[i + 1][0] if i + 1 < len(groups) else F["dur"]
    gap = "" if prev is None else f" (+{t - prev:.1f})"; prev = t
    rows.append(f"| {t:.1f}{gap} | {said(t, nxt) or '(picture only)'} | {'; '.join(txts)} | {'voice' if said(t, nxt) else 'silence'} |")
gaps = [groups[i + 1][0] - groups[i][0] for i in range(len(groups) - 1)]
out = f"""# Scene table: Skin Sense No. {EP['num']}, {EP['title'].replace('<br>', ' ')} ({F['dur']:.1f} s)

Times are film seconds (voice `vo/lines.json`, word times `vo/words.json`, Parakeet). Each row is a visual change; the bracket is the time since the last one. The pictures are the owner's art (`art/ep0N-0M.webp`) where present, else marked procedural placeholders (`set/gen_art.py`); plates, charts, pills, the scan line, soft overlays and every caption are drawn in code. Footers on every frame: "Conceptual illustration · not to scale", "Education, not medical advice". No disease or risk line is shown over skin or a person.
Sound: voice only so far (no score or effects yet; loudness via ffmpeg loudnorm, not the studio mixer or `qa.py`). Longest gap between changes: {max(gaps):.1f} s ({sum(1 for g in gaps if g > 4)} gaps over 4 s).

| time | narration | visual change (and on-screen text) | sound |
|---|---|---|---|
""" + "\n".join(rows) + "\n"
(d / "review").mkdir(exist_ok=True); (d / "review/scene-table.md").write_text(out); print(sys.argv[1], len(groups), "changes; max gap", round(max(gaps), 1), [round(g, 1) for g in gaps if g > 4])
