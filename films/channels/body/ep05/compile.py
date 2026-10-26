"""Compile Meanwhile, Inside No. 05, "Where breath goes": script + voice timings + this direction → film.json, sheet.json.
Nothing here is a hand-typed time: every moment hangs on a beat or a spoken word (A("vo05:metres")).

  python3 -I films/channels/body/ep05/compile.py

Places (scene.mjs), joined by the membrane iris on a section's sound:
  lung   an airway tree (generations compressed, badged) whose chosen tip, a cluster of air sacs, sits at the origin;
         the hero sac cut open (hollow), a net of capillaries over it. The change draws the old idea over the same
         cluster (an "airy flesh" envelope, an illustration) and dissolves it on "bubbles".
  wall   the air–blood wall at true scale (µm): air, a 0.5 µm wall, a capillary with a red cell; O₂ slipping across;
         then the wall thickens and the O₂ slows (the stakes).
  room   metres: a person, the sacs unfolding from their chest into a 70 m² floor, a tennis court's lines around it;
         they fold back for the takeaway; the person breathes through the tally.
  exit   a white blood cell pressed into a seam in a vessel wall (the tease); at the end card the iris returns to
         frame 0's cluster (a seamless replay).
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


CUT = {"wall": cut(A("vo04:At", -0.2)), "room": cut(B["whoa"]["t0"]), "exit": cut(B["tease"]["t0"]), "loop": cut(EC)}
SHOTS = [{"at": 0.0, "name": "lung"}] + [{"at": t, "name": n} for n, t in CUT.items()]
IRIS = [{"t": t, "cx": 0.5, "cy": 0.42} for t in CUT.values()]

FLESH = [A("vo03:airy", -0.2), A("vo03:bubbles", -0.15), A("vo03:bubbles", 0.45)]    # the old idea drawn over the cluster; dissolves on "bubbles"
WALL = {"slip": [A("vo04:Oxygen", -0.1), A("vo04:needed", 0.3)], "thick": [A("vo04:Thicken", -0.05), A("vo04:wall#2", 0.3)], "slow": A("vo04:harder")}
ROOM = {"unfold": [A("vo05:Unfold"), A("vo05:metres", 0.2)], "court": A("vo05:tennis", -0.1), "chest": A("vo05:chest"),
        "fold": [A("vo06:So", 0.0), A("vo06:bag", 0.3)], "breath0": B["meanwhile"]["t0"] - 3.2}
EXIT = {"t0": B["tease"]["t0"], "push": [A("vo08:squeezes", -0.3), A("vo08:wall", 0.4)]}

# camera keys; the lung's are offsets from the hero cluster at the origin (the tree's root is far above it)
CAM = {
    "lung": [
        {"t": 0.0, "pos": [4.0, 3.0, 15.0], "look": [0.0, 0.2, 0.0], "fov": 34},                       # the cluster, the hero sac open
        {"t": A("vo01:these"), "pos": [3.2, 2.4, 12.5], "look": [0.0, 0.2, 0.0], "fov": 34, "ease": "sine"},
        {"t": B["normal"]["t0"] + 0.1, "pos": [60.0, 330.0, 330.0], "look": [0.0, 170.0, 0.0], "fov": 34, "ease": "p3"},   # the whole tree from the windpipe
        {"t": A("vo02:times"), "pos": [40.0, 140.0, 170.0], "look": [0.0, 60.0, 0.0], "fov": 34, "ease": "p2"},            # down the forks
        {"t": A("vo02:sacs"), "pos": [8.0, 14.0, 34.0], "look": [0.0, 2.0, 0.0], "fov": 34, "ease": "p2"},                 # the tips: clusters
        {"t": A("vo02:millimetre"), "pos": [4.2, 3.0, 15.5], "look": [0.0, 0.2, 0.0], "fov": 34, "ease": "p2"},
        {"t": B["change"]["t0"], "pos": [6.0, 4.0, 22.0], "look": [0.0, 0.2, 0.0], "fov": 34, "ease": "sine"},
        {"t": FLESH[1], "pos": [5.0, 3.4, 18.5], "look": [0.0, 0.2, 0.0], "fov": 34, "ease": "sine"},
        {"t": B["why"]["t0"] + 0.2, "pos": [2.6, 1.8, 9.0], "look": "HERO", "fov": 34, "ease": "p2"},           # the open sac, its capillaries
        {"t": CUT["wall"], "pos": [2.2, 1.5, 7.8], "look": "HERO", "fov": 34, "ease": "sine"},
    ],
    "wall": [
        {"t": CUT["wall"], "pos": [2.6, 2.0, 30.0], "look": [2.0, 0.0, 0.0], "fov": 34},
        {"t": WALL["slip"][0], "pos": [2.0, 1.5, 27.0], "look": [2.0, 0.0, 0.0], "fov": 34, "ease": "sine"},
        {"t": WALL["thick"][0], "pos": [2.2, 1.2, 26.0], "look": [2.4, 0.0, 0.0], "fov": 34, "ease": "sine"},
        {"t": CUT["room"], "pos": [2.0, 1.0, 25.0], "look": [2.4, 0.0, 0.0], "fov": 34, "ease": "sine"},
    ],
    "room": [
        {"t": CUT["room"], "pos": [3.0, 2.2, 5.0], "look": [0.0, 1.2, 0.0], "fov": 34},                  # the person, close
        {"t": A("vo05:metres", -0.4), "pos": [7.0, 9.0, 16.0], "look": [0.0, 0.0, 0.0], "fov": 34, "ease": "p2"},   # the floor spreads
        {"t": A("vo05:tennis", 0.2), "pos": [9.0, 22.0, 26.0], "look": [0.0, 0.0, -1.0], "fov": 34, "ease": "p2"},  # the court's lines around it
        {"t": B["takeaway"]["t0"], "pos": [8.0, 20.0, 24.0], "look": [0.0, 0.0, -1.0], "fov": 34, "ease": "sine"},
        {"t": A("vo06:They're"), "pos": [3.4, 2.6, 6.0], "look": [0.0, 1.25, 0.0], "fov": 34, "ease": "p2"},         # back to the person: it's in there
        {"t": CUT["exit"], "pos": [3.0, 2.2, 5.4], "look": [0.0, 1.25, 0.0], "fov": 34, "ease": "sine"},
    ],
    "exit": [
        {"t": CUT["exit"], "pos": [0.0, 6.0, 40.0], "look": [0.0, 0.0, 0.0], "fov": 34},
        {"t": CUT["loop"], "pos": [0.0, 5.0, 33.0], "look": [0.0, 0.0, 0.0], "fov": 34, "ease": "sine"},
    ],
}
CAM["loop"] = [dict(CAM["lung"][0], t=CUT["loop"])]
FOC = {
    "lung": [{"t": 0.0, "at": "sac", "f": 0.55}, {"t": B["normal"]["t0"], "at": "tree", "f": 0.15}, {"t": A("vo02:sacs", -0.5), "at": "sac", "f": 0.45}],
    "wall": [{"t": CUT["wall"], "at": "wall", "f": 0.4}],
    "room": [{"t": CUT["room"], "at": "chest", "f": 0.4}, {"t": A("vo05:metres", -0.6), "at": "floor", "f": 0.15}, {"t": A("vo06:They're", -0.3), "at": "chest", "f": 0.4}],
    "exit": [{"t": CUT["exit"], "at": "wbc", "f": 0.45}],
    "loop": [{"t": CUT["loop"], "at": "sac", "f": 0.55}],
}

LABELS = [
    {"id": "sac", "text": "air sac", "color": "lining", "mark": "dot", "at": "sac", "t0": A("vo02:sacs"), "t1": A("vo02:millimetre", 0.6), "shot": "lung", "side": 1},
    {"id": "flesh", "text": "the old idea: airy flesh", "color": "text", "mark": "dashed", "at": "flesh", "t0": A("vo03:flesh", -0.1), "t1": FLESH[1], "shot": "lung", "side": 1},
    {"id": "cap", "text": "capillaries", "color": "oxy", "mark": "dot", "at": "cap", "t0": A("vo04:capillaries"), "t1": CUT["wall"] - 0.25, "shot": "lung", "side": -1},
    {"id": "air", "text": "air", "color": "o2", "mark": "ring", "glyph": "O₂", "at": "air", "t0": A("vo04:air", 0.0), "t1": CUT["room"] - 0.3, "shot": "wall", "side": -1},
    {"id": "rbc", "text": "red blood cell", "color": "oxy", "mark": "dot", "at": "rbc", "t0": A("vo04:red", 0.0), "t1": CUT["room"] - 0.3, "shot": "wall", "side": 1},
    {"id": "person", "text": "you, to scale", "color": "text", "mark": "dot", "at": "head", "t0": A("vo05:metres", 0.1), "t1": B["takeaway"]["t0"], "shot": "room", "side": 1},
    {"id": "court", "text": "a singles tennis court", "color": "lining", "mark": "bar", "at": "court", "t0": A("vo05:tennis"), "t1": B["takeaway"]["t0"], "shot": "room", "side": -1},
    {"id": "wbc", "text": "white blood cell", "color": "immune", "mark": "dashed", "at": "wbc", "t0": A("vo08:cell", 0.0), "t1": EC, "shot": "exit", "side": 1},
]
SPINE = [
    {"id": "q", "t0": 0.0, "t1": A("vo02:Below", -0.3), "text": "?", "unit": "", "label": "air sacs in your lungs"},
    {"id": "forks", "t0": A("vo02:fork", -0.2), "t1": A("vo02:At", -0.2), "keys": [[A("vo02:fork"), 1], [A("vo02:twenty-three", 0.3), 23]], "unit": "", "label": "forks, up to about"},   # c2
    {"id": "sacs", "t0": A("vo02:half", -0.2), "t1": A("vo02:Each", -0.2), "text": "480,000,000", "unit": "", "label": "air sacs, about"},   # c1
    {"id": "size", "t0": A("vo02:Each"), "t1": B["change"]["t0"] - 0.2, "text": "0.2", "unit": "mm", "label": "each, about"},   # c3
    {"id": "year", "t0": A("vo03:sixteen", -0.1), "t1": CUT["wall"] - 0.3, "text": "1661", "unit": "", "label": "Malpighi's microscope, a frog's lung"},   # c5
    {"id": "wallt", "t0": A("vo04:half", -0.2), "t1": WALL["thick"][0] - 0.2, "text": "0.5", "unit": "µm", "label": "the wall at its thinnest, about"},   # c7
    {"id": "area", "t0": A("vo05:Unfold"), "t1": B["takeaway"]["t0"] - 0.2, "keys": [[ROOM["unfold"][0], 0], [ROOM["unfold"][1], 70]], "unit": "m²", "label": "unfolded, at least"},   # c9
]
TALLY = {"t0": B["meanwhile"]["t0"] + 0.3, "t1": CUT["exit"] - 0.25, "rate": 6.0 / 60.0, "unit": "L", "label": "air in and out while you watched", "fmt": 1}   # c13
BADGES = [
    {"id": "nts", "text": "not to scale", "t0": 0.0, "t1": CUT["wall"] - 0.3},
    {"id": "ill", "text": "illustration: the old idea", "t0": FLESH[0], "t1": FLESH[2]},
    {"id": "scale", "text": "drawn to scale", "t0": CUT["wall"], "t1": CUT["room"] - 0.3},
    {"id": "ill2", "text": "illustration · area to scale", "t0": CUT["room"], "t1": CUT["exit"] - 0.3},
    {"id": "nts2", "text": "not to scale", "t0": CUT["exit"], "t1": EC},
]
TITLE = {"series": "Meanwhile, Inside · No. 05", "title": "Where breath *goes*", "t1": round(A("vo01:Not", 0.3), 4), "sig": 0.0, "y": 0.17}
END = {"t0": EC, "title": "Next, inside: *the exit*", "next": "Meanwhile, Inside · No. 06", "follow": "Follow Meanwhile, Inside",
       "fact": "Your lungs hold about 480 million air sacs (Ochs and colleagues, 2004)."}   # c1
LOC = {"t0": B["meanwhile"]["t0"] + 0.4, "t1": CUT["exit"] - 0.3, "region": [0.47, 0.3]}
BREATHS = [round(ROOM["breath0"] + 4.0 * n, 4) for n in range(0, 6) if ROOM["breath0"] + 4.0 * n < CUT["exit"]]
SEG_BEATS = [round(k * BEAT, 4) for k in range(round(B["meanwhile"]["t0"] / BEAT), int(TALLY["t1"] / BEAT) + 1)]

film = {
    "id": "meanwhile-inside-005", "fps": FPS, "bpm": BPM, "dur": DUR, "poster": 0.0,
    "_doc": "Compiled by compile.py from script.md, vo/ and the direction in compile.py. Do not edit by hand.",
    "shots": SHOTS, "beats": BEATS, "iris": IRIS, "flesh": FLESH, "wall": WALL, "room": ROOM, "exit": EXIT, "breaths": BREATHS, "loc": LOC,
    "cam": CAM, "foc": FOC, "labels": LABELS, "spine": SPINE, "badges": BADGES, "tally": TALLY,
    "segBeats": SEG_BEATS, "title": TITLE, "endCard": EC, "end": END,
    "look": THEME["scene"],
    "captions": f.captions(max_chars=THEME["sizes"]["caption"]["maxChars"]),
    "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines],
}

ev = [{"t": b["t0"], "kind": "section", "id": b["id"], "t1": b["t1"]} for b in BEATS]
ev.append({"t": TITLE["sig"], "kind": "signature", "tag": "title", "gain": -3.0})
ev.append({"t": EC, "kind": "signature", "tag": "end"})
for lb in LABELS:
    ev.append({"t": lb["t0"], "kind": "label", "tag": lb["id"]})
for bd in BADGES:
    if bd["t0"] > 0:
        ev.append({"t": bd["t0"], "kind": "badge", "tag": bd["id"], "text": bd["text"]})
for sp in SPINE:
    if sp["t0"] > 0:
        ev.append({"t": sp["t0"], "kind": "counter.show", "tag": sp["id"]})
ev.append({"t": SPINE[1]["keys"][1][0], "kind": "counter.end", "tag": "forks-end"})
ev.append({"t": SPINE[6]["keys"][1][0], "kind": "counter.end", "tag": "area-end"})
ev.append({"t": TALLY["t0"], "kind": "counter.show", "tag": "tally"})
for k, t in enumerate(SEG_BEATS):
    ev.append({"t": t, "kind": "beat", "tag": f"beat{k}"})
ev.append({"t": 0.0, "kind": "breath", "tag": "hook-breath", "t1": 1.6})
ev.append({"t": FLESH[1], "kind": "dissolve", "tag": "bubbles", "t1": FLESH[2]})
ev.append({"t": WALL["slip"][0], "kind": "diffuse", "tag": "slip", "t1": WALL["slip"][1]})
ev.append({"t": WALL["thick"][0], "kind": "swell", "tag": "thicken", "t1": WALL["thick"][1] + 0.8})
ev.append({"t": ROOM["unfold"][0], "kind": "dissolve", "tag": "unfold", "t1": ROOM["unfold"][1]})
ev.append({"t": ROOM["court"], "kind": "impact", "tag": "court", "gain": -6.0})
ev.append({"t": ROOM["fold"][0], "kind": "swell", "tag": "fold", "t1": ROOM["fold"][1] + 0.5})
for i, t in enumerate(BREATHS):
    if t >= B["meanwhile"]["t0"] - 0.5:
        ev.append({"t": t, "kind": "breath", "tag": f"br{i}", "t1": t + 1.6})
ev.append({"t": EXIT["push"][0], "kind": "cell.pass", "tag": "squeeze", "t1": EXIT["push"][1]})

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
print(f"film.json: {len(SHOTS)} shots, {sum(len(v) for v in CAM.values())} camera keys, {len(LABELS)} labels, {len(SPINE)} readouts, "
      f"{len(BADGES)} badges, {len(film['captions'])} caption pages, end card {EC} s, {DUR} s")
print(f"sheet.json: {len(sheet['events'])} events ({'with' if shown else 'without'} the page's cue measurements)")
print("  cuts: " + ", ".join(f"{k} {v:.4f}" for k, v in CUT.items()) + f"; breaths {BREATHS}")
