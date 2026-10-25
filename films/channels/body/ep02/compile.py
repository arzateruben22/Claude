"""Compile Meanwhile, Inside No. 02, "A billion passengers": script + voice timings + this direction → film.json
(the scene's clock: shots, irises, the lung clock, the boarding and flush keys, camera and focus keys, labels,
badges, counters, title and end card, captions) and sheet.json (the studio's cue sheet). Nothing here is a
hand-typed time: every moment hangs on a beat or a spoken word.

  python3 -I films/channels/body/ep02/compile.py

Anchors as in episode 1: A("vo03:board") is when "board" starts in line vo03; ":end" its end; B["why"]["t0"] a
beat's start. Cuts sit half a frame before a frame and are hidden at the closed moment of the membrane iris.

The slides (each its own place and scale, joined by the iris; scene.mjs builds them):
  cell   the hero red cell cut open, its cut face packed with hemoglobin (µm; hemoglobin oversized)
  hb     one hemoglobin, four O₂ boarding (1 unit = 0.5 nm; an illustration)
  skin   a block of skin over a vein, light going in (1 unit = 50 µm; an illustration, not to scale)
  lung   an air sac with a capillary on it: dark cells arrive, flush bright, leave (µm; slowed)
  nerve  a myelinated fibre; the signal jumps node to node (the tease)

If build/cues-meanwhile-inside-002-9x16.json exists (render.mjs --cues), its measured positions and first-shown
times are merged into the sheet (pan, and the studio's picture-sync check).
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


# ── shots and irises ─────────────────────────────────────────────────────────────────────────────
CUT = {
    "hb": cut(A("vo02:Each", -0.18)),                    # the cut face → one hemoglobin (scale in)
    "skin": cut(B["why"]["t0"]),                         # → a block of skin over a vein (scale out)
    "lung": cut(B["whoa"]["t0"]),                        # → an air sac and its capillary
    "nerve": cut(B["tease"]["t0"]),                      # → a nerve fibre (the next episode)
}
SHOTS = [{"at": 0.0, "name": "cell"}] + [{"at": t, "name": n} for n, t in CUT.items()]
IRIS = [{"t": CUT["hb"], "cx": 0.5, "cy": 0.40}, {"t": CUT["skin"], "cx": 0.5, "cy": 0.40},
        {"t": CUT["lung"], "cx": 0.5, "cy": 0.40}, {"t": CUT["nerve"], "cx": 0.5, "cy": 0.40}]

# ── the cell: the hook's boarding O₂ at the cut, the sparkle on "billion", the push into the crowd ──
CELL = {
    "o2": [[0.0, 0.62], [A("vo01:Room"), 1.0]],              # one O₂ on its way to a seat: 62% there on frame 0
    "sparkle": [A("vo01:billion"), A("vo01:passengers:end", 0.2)],
    "hbLit": A("vo02:hemoglobin", -0.1),                    # the labelled hemoglobin brightens
}

# ── one hemoglobin: four O₂ board, each sooner than the last (c5: easier, drawn as sooner) ──────────
BOARD = [A("vo03:board", 0.1), A("vo03:makes", 0.05), A("vo03:next", 0.05), A("vo03:easier", 0.1)]
APPROACH = [2.6, 1.0, 0.75, 0.6]                         # seconds from setting off to the seat
HB = {
    "board": BOARD, "approach": APPROACH,
    "glint": [A("vo02:four"), A("vo02:atoms:end", 0.2)],   # the four irons glint on "four … iron atoms"
    "free": A("vo02:oxygen", -0.4),                        # free O₂ drift in on "oxygen"
    # each unit takes 40% of its colour as its O₂ boards; the whole molecule flushes on "full, it's bright"
    "flush": [A("vo03:full", -0.1), A("vo03:bright", 0.35)],
    "shift": [BOARD[0], BOARD[0] + 0.9],                   # the T → R turn after the first boarding
}

# ── skin: rays of light in; red sinks to the vein and is swallowed; red beside it comes back ──────
SKIN = {
    "blue": [A("vo04:red#2", 0.0), A("vo04:in", 0.25)],        # blue light scatters back near the surface
    "red": [A("vo04:red#2", 0.0), A("vo04:swallows", 0.15)],   # the ray over the vein: down to the vein, swallowed
    "swallow": A("vo04:swallows", 0.15),
    "back": [A("vo04:so#2", 0.0), A("vo04:back", 0.3)],        # the ray beside the vein: down and back up
    "section": [A("vo04:It", -0.2), A("vo04:Returning", -0.1)],   # the crane from the surface to the cut face
}

# ── the lung, shown 12× slower: the hero's seats fill over 0.25 s of lung time (3 s of film), ending on "second" ──
SLOW0 = A("vo05:There", -0.3)                            # the camera has moved in beside the hero
RATE = 1.0 / 12.0
FLUSH1 = A("vo05:second:end", 0.1)
FLUSH0 = round(FLUSH1 - 0.25 / RATE, 6)                  # ≈ "fill": the hero meets the air sac's face
CLOCK = [{"t": 0.0, "rate": 1.0}, {"t": CUT["lung"], "rate": RATE}, {"t": CUT["nerve"], "rate": 1.0}]
LUNG = {"flush": [FLUSH0, FLUSH1], "o2": [FLUSH0 - 0.6, FLUSH1 + 0.4]}
QUARTER = {"t0": A("vo05:In", -0.3), "keys": [[FLUSH0, 0.0], [FLUSH1, 0.25]], "t1": B["takeaway"]["t0"] - 0.3,
           "unit": "s", "label": "seats filling, in lung time"}

# ── the nerve: the signal jumps node to node, landing on "jumps" ───────────────────────────────────
NERVE = {"t0": A("vo08:in#2", 0.0), "jump": A("vo08:jumps")}
NERVE["hop"] = round((NERVE["jump"] - NERVE["t0"]) / 3, 6)   # three hops to the gap that lands on "jumps", then on

# ── camera keys per shot (absolute, in each slide's own units; "rel" ones follow the lung's hero) ──
CAM = {
    "cell": [
        {"t": 0.0, "pos": [2.0, 1.2, 21.0], "look": [0.0, -0.4, 0.0], "fov": 34},
        {"t": A("vo01:billion"), "pos": [1.6, 1.0, 18.5], "look": [0.0, -0.3, 0.0], "fov": 34, "ease": "sine"},
        {"t": A("vo02:hemoglobin", -0.3), "pos": [0.9, 0.6, 13.0], "look": [0.2, -0.2, 0.0], "fov": 33, "ease": "p2"},
        {"t": CUT["hb"], "pos": [0.5, 0.3, 7.5], "look": [0.3, -0.1, 0.0], "fov": 32, "ease": "p2"},     # into the crowd
    ],
    "hb": [
        {"t": CUT["hb"], "pos": [14.0, 10.0, 62.0], "look": [0.0, 0.0, 0.0], "fov": 34},
        {"t": A("vo02:oxygen"), "pos": [8.0, 9.0, 58.0], "look": [0.0, 0.5, 0.0], "fov": 34, "ease": "sine"},
        {"t": BOARD[0], "pos": [-3.0, 7.0, 52.0], "look": [0.5, 0.8, 0.0], "fov": 34, "ease": "sine"},
        {"t": BOARD[3] + 0.4, "pos": [-12.0, 5.0, 54.0], "look": [0.0, 0.0, 0.0], "fov": 34, "ease": "sine"},
        {"t": HB["flush"][1], "pos": [-15.0, 3.0, 58.0], "look": [0.0, 0.0, 0.0], "fov": 34, "ease": "sine"},
        {"t": CUT["skin"], "pos": [-16.0, 2.5, 61.0], "look": [0.0, 0.0, 0.0], "fov": 34, "ease": "sine"},
    ],
    "skin": [
        {"t": CUT["skin"], "pos": [58.0, 52.0, 128.0], "look": [0.0, -10.0, 22.0], "fov": 34},                # the block's corner: the bluish band on top, the vein in the cut face
        {"t": SKIN["section"][0], "pos": [48.0, 44.0, 140.0], "look": [0.0, -10.0, 26.0], "fov": 34, "ease": "sine"},
        {"t": SKIN["section"][1], "pos": [8.0, -2.0, 176.0], "look": [-1.0, -13.0, 40.0], "fov": 34, "ease": "p2"},  # square to the cut face
        {"t": SKIN["red"][1], "pos": [5.0, -4.0, 168.0], "look": [-1.0, -14.0, 40.0], "fov": 34, "ease": "sine"},
        {"t": CUT["lung"], "pos": [3.0, -5.0, 172.0], "look": [-1.0, -14.0, 40.0], "fov": 34, "ease": "sine"},
    ],
    "lung": [
        {"t": CUT["lung"], "pos": [40.0, 30.0, 260.0], "look": [0.0, 0.0, 0.0], "fov": 34},                # the air sac and its capillary
        {"t": A("vo05:lungs", 0.3), "pos": [30.0, 20.0, 220.0], "look": [0.0, 0.0, 0.0], "fov": 34, "ease": "sine"},
        {"t": SLOW0 + 0.2, "pos": [6.0, 10.0, 34.0], "look": [0.0, 0.0, 0.0], "fov": 34, "ease": "p2", "rel": True},   # beside the hero
        {"t": FLUSH1 + 0.5, "pos": [4.0, 9.0, 30.0], "look": [0.0, 0.0, 0.0], "fov": 34, "ease": "sine", "rel": True},
        {"t": B["takeaway"]["t0"] + 0.2, "pos": [5.0, 10.0, 40.0], "look": [0.0, 0.0, 0.0], "fov": 34, "ease": "sine", "rel": True},
    ],
    "lungwide": [
        {"t": B["takeaway"]["t0"] + 0.2, "pos": [0.0, 0.0, 0.0], "look": [0.0, 0.0, 0.0], "fov": 34},
    ],
    "nerve": [
        {"t": CUT["nerve"], "pos": [60.0, 16.0, 66.0], "look": [76.0, -4.0, 0.0], "fov": 34},
        {"t": NERVE["jump"], "pos": [118.0, 14.0, 62.0], "look": [134.0, -4.0, 0.0], "fov": 34, "ease": "sine"},
        {"t": DUR, "pos": [150.0, 13.0, 60.0], "look": [166.0, -4.0, 0.0], "fov": 34, "ease": "sine"},
    ],
}
# the takeaway and the tally pull back from the hero to the whole air sac (absolute keys, appended to "lung")
CAM["lung"] += [
    {"t": A("vo06:red", 0.0), "pos": [-4.0, -10.0, 118.0], "look": [-14.0, -12.0, 0.0], "fov": 34, "ease": "p2"},   # the flush zone: dark in, bright out
    {"t": CUT["nerve"], "pos": [2.0, -4.0, 140.0], "look": [-12.0, -9.0, 0.0], "fov": 34, "ease": "sine"},
]
del CAM["lungwide"]

FOC = {
    "cell": [{"t": 0.0, "at": "cap", "f": 0.5}, {"t": A("vo02:hemoglobin", -0.3), "at": "hblit", "f": 0.5}],
    "hb": [{"t": CUT["hb"], "at": "hb", "f": 0.45}, {"t": BOARD[0] - 0.8, "at": "seat0", "f": 0.5}, {"t": BOARD[3] + 0.3, "at": "hb", "f": 0.45}],
    "skin": [{"t": CUT["skin"], "at": "surface", "f": 0.3}, {"t": SKIN["section"][1] - 0.4, "at": "vein", "f": 0.3}],
    "lung": [{"t": CUT["lung"], "at": "sac", "f": 0.25}, {"t": SLOW0, "at": "hero", "f": 0.5}, {"t": A("vo06:red"), "at": "sac", "f": 0.25}],
    "nerve": [{"t": CUT["nerve"], "at": "front", "f": 0.35}],
}

# ── the overlay ──────────────────────────────────────────────────────────────────────────────────
LABELS = [
    {"id": "o2hook", "text": "oxygen", "glyph": "O₂", "color": "o2", "mark": "ring", "at": "o2hook", "t0": 0.0, "t1": A("vo02:It's", 0.4), "shot": "cell", "side": 1},
    {"id": "hb", "text": "hemoglobin", "color": "oxy", "mark": "dot", "at": "hblit", "t0": A("vo02:hemoglobin"), "t1": CUT["hb"] - 0.3, "shot": "cell", "side": -1},
    {"id": "iron", "text": "iron", "color": "bone", "mark": "dot", "at": "iron0", "t0": A("vo02:iron"), "t1": A("vo03:Watch", 0.2), "shot": "hb", "side": 1},
    {"id": "o2", "text": "oxygen", "glyph": "O₂", "color": "o2", "mark": "ring", "at": "o2first", "t0": A("vo02:oxygen"), "t1": BOARD[0] + 0.4, "shot": "hb", "side": -1},
    {"id": "vein", "text": "vein", "color": "deoxy", "mark": "dot", "at": "veintop", "t0": A("vo04:veins"), "t1": SKIN["section"][0], "shot": "skin", "side": 1},
    {"id": "venous", "text": "returning blood", "color": "deoxy", "mark": "dot", "at": "vein", "t0": A("vo04:Returning"), "t1": SKIN["red"][0] - 0.1, "shot": "skin", "side": 1},
    {"id": "redlight", "text": "red light", "color": "pulse", "mark": "bar", "at": "redray", "t0": A("vo04:red#2", 0.15), "t1": CUT["lung"] - 0.3, "shot": "skin", "side": -1},
    {"id": "bluelight", "text": "blue light", "color": "#8EB8FF", "mark": "bar", "at": "blueray", "t0": A("vo04:light", 0.2), "t1": CUT["lung"] - 0.3, "shot": "skin", "side": 1},
    {"id": "sac", "text": "air sac", "color": "lining", "mark": "dot", "at": "sac", "t0": A("vo05:lungs"), "t1": SLOW0, "shot": "lung", "side": -1},
    {"id": "back", "text": "back from the body", "color": "deoxy", "mark": "dot", "at": "incoming", "t0": A("vo05:back"), "t1": SLOW0, "shot": "lung", "side": 1},
    {"id": "arrive", "text": "arriving: darker", "color": "deoxy", "mark": "dot", "at": "incoming", "t0": A("vo06:The", 0.0), "t1": B["meanwhile"]["t0"] + 0.4, "shot": "lung", "side": 1},
    {"id": "leave", "text": "leaving: brighter", "color": "oxy", "mark": "dot", "at": "outgoing", "t0": A("vo06:count"), "t1": B["meanwhile"]["t0"] + 0.4, "shot": "lung", "side": -1},
    {"id": "node", "text": "gap in the insulation", "color": "nerve", "mark": "dot", "at": "node", "t0": A("vo08:fastest"), "t1": EC, "shot": "nerve", "side": 1},
]
BADGES = [
    {"id": "nts-cell", "text": "not to scale", "t0": 0.0, "t1": CUT["hb"] - 0.3},
    {"id": "ill-hb", "text": "illustration", "t0": CUT["hb"], "t1": CUT["skin"] - 0.3},
    {"id": "ill-skin", "text": "illustration · not to scale", "t0": CUT["skin"], "t1": CUT["lung"] - 0.3},
    {"id": "nts-lung", "text": "not to scale", "t0": CUT["lung"], "t1": CUT["nerve"] - 0.3},
    {"id": "nts-nerve", "text": "not to scale", "t0": CUT["nerve"], "t1": EC},
]
TALLY = {"t0": B["meanwhile"]["t0"] + 0.3, "t1": CUT["nerve"] - 0.25, "rate": 250.0 / 60.0, "unit": "mL", "label": "oxygen your blood handed out while you watched"}   # c15
TITLE = {"series": "Meanwhile, Inside · No. 02", "title": "A billion *passengers*", "t1": round(A("vo01:Room") + 0.35, 4), "sig": 0.0, "y": 0.17}
END = {"t0": EC, "title": "Next, inside: *the jump*", "next": "Meanwhile, Inside · No. 03", "follow": "Follow Meanwhile, Inside"}
SEG_BEATS = [round(k * BEAT, 4) for k in range(round(B["meanwhile"]["t0"] / BEAT), int(TALLY["t1"] / BEAT) + 1)]

film = {
    "id": "meanwhile-inside-002", "fps": FPS, "bpm": BPM, "dur": DUR, "poster": 0.0,
    "_doc": "Compiled by compile.py from script.md, vo/ and the direction in compile.py. Do not edit by hand.",
    "shots": SHOTS, "beats": BEATS, "iris": IRIS, "clock": CLOCK,
    "cell": CELL, "hb": HB, "skin": SKIN, "lung": LUNG, "nerve": NERVE, "quarter": QUARTER,
    "cam": CAM, "foc": FOC, "labels": LABELS, "badges": BADGES, "tally": TALLY,
    "segBeats": SEG_BEATS, "title": TITLE, "endCard": EC, "end": END,
    "look": THEME["scene"],
    "captions": f.captions(max_chars=THEME["sizes"]["caption"]["maxChars"]),
    "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines],
}

# ── the cue sheet ────────────────────────────────────────────────────────────────────────────────
ev = [{"t": b["t0"], "kind": "section", "id": b["id"], "t1": b["t1"]} for b in BEATS]
ev.append({"t": TITLE["sig"], "kind": "signature", "tag": "title", "gain": -3.0})
ev.append({"t": EC, "kind": "signature", "tag": "end"})
for lb in LABELS:
    ev.append({"t": max(0.0, lb["t0"]), "kind": "label", "tag": lb["id"]})
for bd in BADGES:
    ev.append({"t": bd["t0"], "kind": "badge", "tag": bd["id"], "text": bd["text"]})
ev.append({"t": QUARTER["t0"], "kind": "counter.show", "tag": "quarter"})
ev.append({"t": QUARTER["keys"][1][0], "kind": "counter.end", "tag": "quarter-end"})
ev.append({"t": TALLY["t0"], "kind": "counter.show", "tag": "tally"})
for k, t in enumerate(SEG_BEATS):
    ev.append({"t": t, "kind": "beat", "tag": f"beat{k}"})
ev.append({"t": CELL["sparkle"][0], "kind": "dissolve", "tag": "billion", "t1": CELL["sparkle"][1]})
ev.append({"t": HB["glint"][0], "kind": "diffuse", "tag": "irons", "t1": HB["glint"][1]})
for i, t in enumerate(BOARD):                             # each O₂ boards: a bell grain, rising
    ev.append({"t": t, "kind": "bind", "tag": f"board{i}"})
ev.append({"t": HB["flush"][0], "kind": "swell", "tag": "flush", "t1": HB["flush"][1] + 1.2})
ev.append({"t": SKIN["swallow"], "kind": "impact", "tag": "swallow", "gain": -6.0})
ev.append({"t": FLUSH0, "kind": "breath", "tag": "fill", "t1": FLUSH1})
ev.append({"t": LUNG["o2"][0], "kind": "diffuse", "tag": "o2-in", "t1": LUNG["o2"][1]})
ev.append({"t": CUT["lung"], "kind": "swell", "tag": "lung-swell", "t1": CUT["lung"] + 2.4})
k = 0                                                     # the tease: the signal leaps gap to gap, the fourth on "jumps"
while NERVE["t0"] + k * NERVE["hop"] < EC:
    ev.append({"t": round(NERVE["t0"] + k * NERVE["hop"], 4), "kind": "spike", "tag": f"jump{k}"})
    k += 1

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
print("  cuts: " + ", ".join(f"{k} {v:.4f}" for k, v in CUT.items()) + f"; lung ×1/12, flush {FLUSH0:.3f}–{FLUSH1:.3f}; nerve hop {NERVE['hop']:.3f}")
