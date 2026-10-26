"""Compile Meanwhile, Inside No. 06, "The exit": script + voice timings + this direction → film.json and sheet.json.
Nothing here is a hand-typed time: every moment hangs on a beat or a spoken word (A("vo05:pours")).

  python3 -I films/channels/body/ep06/compile.py

Places (scene.mjs), joined by the membrane iris on a section's sound:
  vein    a venule under a fingertip's skin (µm; the cell, the red cells and the gap near true size): a floor of wall
          cells with a seam between two of them at x = 0, the blood streaming over it (slowed, badged), the tissue
          beneath. The hero neutrophil (set/wanderer.js) rides the stream, rolls, stops, crawls to the seam, wedges
          its nucleus in, pours through, and the seam closes behind it. In the hook and the whoa the floor is cut
          open at z = 0, so the seam and the cell's waist show in section.
  finger  a stylised fingertip with one sore spot (a swelling and a soft glow), its white cells ghosted beneath.
The change is an engraving in the overlay (one 19th-century plate, badged "illustrated"); the tease is the body
figure in the overlay, the heart's pacemaker patch flickering on each beat. The spine readout is the meanwhile's
tally itself, from frame 0, dimmed until the meanwhile. At the end card the iris returns to frame 0 (a seamless
replay; the tally starts again from 0).
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
sys.path.insert(0, str(ROOT / "kits/cinema/script"))
from timeline import Film   # noqa: E402

FPS, BPM = 30, 75
BEAT = 60.0 / BPM
f = Film(HERE / "script.md", HERE / "vo", fps=FPS, bpm=BPM)
plan, end_hold = f.script_plan()
BEATS = f.layout(plan, end_hold=end_hold)
A = f.at
B = {b["id"]: b for b in BEATS}
DUR = f.duration
EC = f.end_card
HALF = 0.5 / FPS
THEME = json.loads((HERE.parent / "theme.json").read_text())


def fr(t):
    return round(round(t * FPS) / FPS, 6)


def cut(t):
    return round(fr(t) - HALF, 6)


CUT = {"normal": cut(B["normal"]["t0"]), "why": cut(B["why"]["t0"]), "whoa": cut(B["whoa"]["t0"]),
       "finger": cut(B["takeaway"]["t0"]), "tease": cut(B["tease"]["t0"]), "loop": cut(EC)}
SHOTS = [{"at": 0.0, "name": "hook"}] + [{"at": t, "name": n} for n, t in CUT.items()]
IRIS = [{"t": t, "cx": 0.5, "cy": 0.42} for t in CUT.values()]

# ── the hero's day (µm, x along the stream; the seam at x = 0) ─────────────────────────────────────
HOOK = {"pass": [0.46, 0.54]}                                       # frame 0: halfway through, easing on a little
NORMAL = {"x": [-80.0, -18.0], "out": [A("vo02:outside", -0.2), B["normal"]["t1"]]}   # riding the stream; then down through the lining
WHY = {
    "sticky": [A("vo04:sticky", -0.2), A("vo04:rolls", 0.3)],       # threads light on the lining; it snags and rolls
    "roll": [A("vo04:sticky", 0.1), A("vo04:stops", 0.05)],          # rolling from x −62 to −24
    "stop": A("vo04:stops"),                                         # its grips light; the stream parts around it
    "crawl": [A("vo04:crawls", -0.1), A("vo04:seam", 0.2)],         # it crawls to the seam (x = 0)
    "seam": [A("vo04:seam"), A("vo04:cells", 0.4)],                  # the seam glows
    "faulty": [A("vo04:condition", -0.3), A("vo04:past", 0.6)],      # one cell, its grips dark, rolls on past
    "press": [A("vo04:past", 0.9), B["why"]["t1"]],                  # picture only: back on the hero, its nucleus at the join
}
WHOA = {
    "wedge": [A("vo05:wedges", -0.1), A("vo05:seam", 0.2)],          # the nucleus goes in first; the wall cells part
    "pour": [A("vo05:pours", -0.1), A("vo05:itself", 0.3)],           # the cell flows through, its waist pinched to the gap
    "seal": [A("vo05:Behind", 0.0), A("vo05:shut", 0.2)],            # the seam closes behind it
    "free": [A("vo05:shut", 0.4), B["whoa"]["t1"]],                  # picture only: free in the tissue
}
FINGER = {"pull": [CUT["finger"], A("vo06:blood", 0.4)]}             # the pull-out: from the sore spot to the fingertip
TEASE = {"t0": CUT["tease"], "zoom": [CUT["tease"], A("vo08:spark", 0.3)]}   # up the arm to the heart

# ── camera keys per shot (each place's own frame) ──────────────────────────────────────────────────
CAM = {
    "hook": [
        {"t": 0.0, "pos": [5.0, 6.0, 46.0], "look": [0.0, 1.5, 0.0], "fov": 34},
        {"t": CUT["normal"], "pos": [3.5, 5.5, 43.0], "look": [0.0, 1.5, 0.0], "fov": 34, "ease": "sine"},
    ],
    "normal": [
        # "rel": offsets from the riding cell (the camera travels with it)
        {"t": CUT["normal"], "pos": [14.0, 14.0, 56.0], "look": [2.0, -2.0, 0.0], "fov": 34, "rel": True},     # alongside the cell in the stream
        {"t": A("vo02:eight", -0.2), "pos": [8.0, 10.0, 40.0], "look": [1.0, -1.0, 0.0], "fov": 34, "ease": "sine", "rel": True},
        {"t": A("vo02:Yet", 0.0), "pos": [10.0, 12.0, 50.0], "look": [2.0, -2.0, 0.0], "fov": 34, "ease": "sine", "rel": True},
        # "outside": down through the lining into the tissue, where white cells have piled up
        {"t": A("vo02:outside", 0.4), "pos": [12.0, -10.0, 54.0], "look": [14.0, -14.0, 0.0], "fov": 34, "ease": "p2"},
        {"t": CUT["why"], "pos": [16.0, -12.0, 50.0], "look": [16.0, -15.0, 0.0], "fov": 34, "ease": "sine"},
    ],
    "why": [
        {"t": CUT["why"], "pos": [-46.0, 20.0, 50.0], "look": [-52.0, 2.0, 0.0], "fov": 34},
        {"t": WHY["stop"], "pos": [-22.0, 16.0, 44.0], "look": [-26.0, 2.0, 0.0], "fov": 34, "ease": "sine"},
        {"t": WHY["crawl"][1], "pos": [-2.0, 16.0, 44.0], "look": [-2.0, 1.5, 0.0], "fov": 34, "ease": "sine"},
        # the stakes: wider, so one faulty cell rolls on past the seam along the floor
        {"t": WHY["faulty"][0] + 0.3, "pos": [4.0, 26.0, 76.0], "look": [0.0, 1.0, -6.0], "fov": 34, "ease": "p2"},
        {"t": WHY["press"][0], "pos": [4.0, 24.0, 72.0], "look": [0.0, 1.0, -6.0], "fov": 34, "ease": "sine"},
        {"t": WHY["press"][1], "pos": [3.0, 9.0, 36.0], "look": [0.0, 2.0, 0.0], "fov": 34, "ease": "p2"},     # back on the hero, at the join
    ],
    "whoa": [
        {"t": CUT["whoa"], "pos": [4.0, 4.0, 40.0], "look": [0.0, 0.5, 0.0], "fov": 34},
        {"t": WHOA["pour"][0], "pos": [3.0, 2.5, 36.0], "look": [0.0, 0.0, 0.0], "fov": 34, "ease": "sine"},
        {"t": WHOA["seal"][1], "pos": [2.0, 0.0, 38.0], "look": [0.0, -2.5, 0.0], "fov": 34, "ease": "sine"},
        {"t": CUT["finger"], "pos": [1.0, -3.0, 44.0], "look": [0.0, -5.5, 0.0], "fov": 34, "ease": "sine"},
    ],
    "finger": [
        {"t": CUT["finger"], "pos": [0.0, 7.5, 6.0], "look": [0.0, 4.6, 0.0], "fov": 34},                   # the sore spot, close (mm)
        {"t": FINGER["pull"][1], "pos": [26.0, 30.0, 70.0], "look": [-6.0, 2.0, 0.0], "fov": 34, "ease": "p2"},   # the fingertip
        {"t": CUT["tease"], "pos": [28.0, 32.0, 76.0], "look": [-6.0, 2.0, 0.0], "fov": 34, "ease": "sine"},
    ],
    "tease": [
        {"t": CUT["tease"], "pos": [28.0, 32.0, 76.0], "look": [-6.0, 2.0, 0.0], "fov": 34},
        {"t": DUR, "pos": [30.0, 34.0, 82.0], "look": [-6.0, 2.0, 0.0], "fov": 34, "ease": "sine"},
    ],
}
CAM["loop"] = [dict(CAM["hook"][0], t=CUT["loop"])]
FOC = {
    "hook": [{"t": 0.0, "at": "hero", "f": 0.5}],
    "normal": [{"t": CUT["normal"], "at": "hero", "f": 0.45}, {"t": A("vo02:outside", 0.0), "at": "piled", "f": 0.4}],
    "why": [{"t": CUT["why"], "at": "hero", "f": 0.45}, {"t": WHY["faulty"][0], "at": "seam", "f": 0.25}, {"t": WHY["press"][0] + 0.4, "at": "hero", "f": 0.5}],
    "whoa": [{"t": CUT["whoa"], "at": "hero", "f": 0.5}],
    "finger": [{"t": CUT["finger"], "at": "spot", "f": 0.4}],
    "tease": [{"t": CUT["tease"], "at": "spot", "f": 0.2}],
    "loop": [{"t": CUT["loop"], "at": "hero", "f": 0.5}],
}

# ── the overlay ──────────────────────────────────────────────────────────────────────────────────
LABELS = [
    {"id": "neut", "text": "neutrophil", "color": "immune", "mark": "dot", "at": "hero", "t0": A("vo02:neutrophil", 0.0), "t1": A("vo02:about", -0.2), "shot": "normal", "side": 1},
    {"id": "piled", "text": "white cells, outside the wall", "color": "immune", "mark": "dot", "at": "piled", "t0": A("vo02:outside", 0.3), "t1": B["normal"]["t1"] - 0.3, "shot": "normal", "side": -1},
    {"id": "grips", "text": "grips", "color": "signal", "mark": "dot", "at": "grips", "t0": A("vo04:grips"), "t1": A("vo04:It", -0.2), "shot": "why", "side": 1},
    {"id": "seam", "text": "a seam between two wall cells", "color": "lining", "mark": "dot", "at": "seam", "t0": A("vo04:seam"), "t1": A("vo04:In", -0.2), "shot": "why", "side": -1},
]
SCALE = {"t0": A("vo02:eight", -0.1), "t1": A("vo02:Yet", -0.2), "text": "about 8 µm · round, in blood"}   # c3
TALLY = {"t0": 0.0, "t1": B["tease"]["t0"] - 0.2, "lit": [B["meanwhile"]["t0"], B["tease"]["t0"] - 0.2], "rate": 1.5e10 / 86400.0,
         "label": "while you watched: new neutrophils"}   # c23: 1.5 × 10¹⁰ a day ÷ 86,400 s (computed), a low estimate
BADGES = [
    {"id": "slow0", "text": "slowed", "slot": "tl", "t0": 0.0, "t1": B["change"]["t0"] - 0.3},
    {"id": "ill-plate", "text": "illustrated", "t0": B["change"]["t0"] + 0.2, "t1": CUT["why"] - 0.3},
    {"id": "slow1", "text": "slowed", "slot": "tl", "t0": CUT["why"], "t1": CUT["whoa"] - 0.3},
    {"id": "lad", "text": "illustration: a rare inherited condition", "t0": WHY["faulty"][0] - 0.2, "t1": WHY["faulty"][1] + 0.3},
    {"id": "fast", "text": "sped up", "slot": "tl", "t0": CUT["whoa"], "t1": CUT["finger"] - 0.3},
    {"id": "ill-finger", "text": "illustration", "t0": CUT["finger"], "t1": DUR},
    {"id": "low", "text": "low estimate", "slot": "tl", "t0": B["meanwhile"]["t0"], "t1": B["tease"]["t0"] - 0.3},
]
PANEL = {"t0": B["change"]["t0"] + 0.1, "t1": CUT["why"] - 0.1, "tissue": A("vo03:tissue", -0.1), "alive": A("vo03:Julius", -0.1), "out": [A("vo03:climbed", -0.2), A("vo03:out", 0.6)]}
FIG = {"t0": CUT["tease"], "t1": DUR}
TITLE = {"series": "Meanwhile, Inside · No. 06", "title": "The *exit*", "t1": round(A("vo01:This", 0.3), 4), "sig": 0.0, "y": 0.17}
END = {"t0": EC, "y": 0.258, "title": "Next, inside: *the spark*", "next": "Meanwhile, Inside · No. 07", "follow": "Follow Meanwhile, Inside",
       "fact": "Augustus Waller saw blood cells cross capillary walls in 1846, 21 years before Cohnheim."}
LOC = {"t0": B["meanwhile"]["t0"] + 0.4, "t1": B["tease"]["t0"] - 0.3, "region": [0.42, 0.52]}   # the bone marrow (the pelvis and thigh bones)
SEG_BEATS = [round(k * BEAT, 4) for k in range(round(B["meanwhile"]["t0"] / BEAT), int(DUR / BEAT) + 1)]

# caption pages: the balanced pager (no one-word tails), never splitting these phrases across rows or pages
CAPTION_KEEP = [
    "this cell",
    "your blood",
    "no open door",
    "white cell",
    "white cells",
    "eight micrometres",
    "sore fingertip",
    "Rudolf Virchow",
    "Julius Cohnheim",
    "eighteen sixty-seven",
    "his assistant",
    "living frog's vessels",
    "inflamed tissue",
    "switch on",
    "two wall cells",
    "rare inherited condition",
    "its nucleus",
    "own door",
    "narrower than itself",
    "seals shut",
    "bone marrow",
    "new neutrophils",
    "ten million",
    "nearly every heartbeat",   # 26 Oct audit: was "every heartbeat"; the hedge stays with its noun
    "the spark",
    "pile up",
    "as you watched",
]

film = {
    "id": "meanwhile-inside-006", "fps": FPS, "bpm": BPM, "dur": DUR, "poster": 0.0,
    "_doc": "Compiled by compile.py from script.md, vo/ and the direction in compile.py. Do not edit by hand.",
    "shots": SHOTS, "beats": BEATS, "iris": IRIS, "hookSt": HOOK, "normal": NORMAL, "why": WHY, "whoa": WHOA, "finger": FINGER, "tease": TEASE,
    "panel": PANEL, "fig": FIG, "loc": LOC, "scale": SCALE,
    "cam": CAM, "foc": FOC, "labels": LABELS, "badges": BADGES, "tally": TALLY,
    "segBeats": SEG_BEATS, "title": TITLE, "endCard": EC, "end": END,
    "look": THEME["scene"],
    "captions": f.captions(max_chars=THEME["sizes"]["caption"]["maxChars"], balance=True, keep=CAPTION_KEEP),
    "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines],
}

# ── the cue sheet ────────────────────────────────────────────────────────────────────────────────
ev = [{"t": b["t0"], "kind": "section", "id": b["id"], "t1": b["t1"]} for b in BEATS]
ev.append({"t": TITLE["sig"], "kind": "signature", "tag": "title", "gain": -3.0})
ev.append({"t": EC, "kind": "signature", "tag": "end"})
for lb in LABELS:
    ev.append({"t": lb["t0"], "kind": "label", "tag": lb["id"]})
for bd in BADGES:
    if bd["t0"] > 0:
        ev.append({"t": bd["t0"], "kind": "badge", "tag": bd["id"], "text": bd["text"]})
ev.append({"t": SCALE["t0"], "kind": "scale", "tag": "size"})
ev.append({"t": TALLY["lit"][0], "kind": "counter.show", "tag": "tally"})
for k, t in enumerate(SEG_BEATS):
    if t < EC:
        ev.append({"t": t, "kind": "beat", "tag": f"beat{k}"})
ev.append({"t": WHY["sticky"][0], "kind": "dissolve", "tag": "sticky", "t1": WHY["sticky"][1]})
ev.append({"t": WHY["stop"], "kind": "impact", "tag": "stop", "gain": -6.0})
ev.append({"t": WHY["seam"][0], "kind": "bind", "tag": "seam"})
ev.append({"t": WHOA["wedge"][0], "kind": "swell", "tag": "wedge", "t1": WHOA["wedge"][1] + 0.6})
ev.append({"t": WHOA["pour"][0], "kind": "cell.pass", "tag": "pour", "t1": WHOA["pour"][1]})
ev.append({"t": WHOA["seal"][1], "kind": "impact", "tag": "shut", "gain": -4.0})
ev.append({"t": PANEL["out"][0], "kind": "diffuse", "tag": "climb", "t1": PANEL["out"][1]})
ev.append({"t": FINGER["pull"][0], "kind": "breath", "tag": "pull", "t1": FINGER["pull"][0] + 1.8})

cues_file = HERE / "build" / f"cues-{film['id']}-9x16.json"
shown = {}
if cues_file.exists():
    cues = json.loads(cues_file.read_text())
    by_tag = {c.get("tag"): c for c in cues.get("events", [])}
    for e in ev:
        c = by_tag.get(e.get("tag"))
        if c and e["kind"] in ("label", "counter.show", "scale", "badge") and c.get("pos"):
            e["pos"] = c["pos"]
        if c and e["kind"] in ("label", "counter.show") and cues.get("shown", {}).get(e["tag"]) is not None:
            shown[e["tag"]] = cues["shown"][e["tag"]]

sheet = {"duration": DUR, "fps": FPS, "preset": "meanwhile-pulse", "duck_db": -9.0,
         "sections": [{"id": b["id"], "t0": b["t0"], "t1": b["t1"], "energy": b["energy"]} for b in BEATS],
         "events": sorted(ev, key=lambda e: (e["t"], e["kind"])),
         "voice": [{"id": v["id"], "t": v["t"], "file": v["file"]} for v in film["voice"]]}
if shown:
    sheet["shown"] = shown

(HERE / "film.json").write_text(json.dumps(film, indent=1, ensure_ascii=False))
(HERE / "sheet.json").write_text(json.dumps(sheet, indent=1, ensure_ascii=False))
print(f"film.json: {len(SHOTS)} shots, {len(IRIS)} irises, {sum(len(v) for v in CAM.values())} camera keys, {len(LABELS)} labels, "
      f"{len(BADGES)} badges, {len(film['captions'])} caption pages, end card {EC} s, {DUR} s")
print(f"sheet.json: {len(sheet['events'])} events ({'with' if shown else 'without'} the page's cue measurements), {len(sheet['voice'])} voice lines")
for b in BEATS:
    print(f"  {b['id']:<9} {b['t0']:6.2f}–{b['t1']:6.2f}  line {b['line']}")
print("  cuts: " + ", ".join(f"{k} {v:.4f}" for k, v in CUT.items()))
