"""Compile Meanwhile, Inside No. 04, "The gap": script + voice timings + this direction → film.json and sheet.json.
Nothing here is a hand-typed time: every moment hangs on a beat or a spoken word (A("vo04:gap")).

  python3 -I films/channels/body/ep04/compile.py

One world (scene.mjs; units arbitrary, the junction hugely enlarged, badged "not to scale"):
  the hero junction at the origin: a terminal cut open (its vesicles inside), the gap, the next cell's surface
  and its receptors; around it a small network of nerve cells the camera pulls back to (normal, whoa).
The change is two illustrated panels in the overlay (the same stained tissue read two ways: Golgi's continuous web,
Cajal's separate cells). The tease cuts to an air sac in the dark. At the end card the iris returns to frame 0's
blurred contact (a seamless replay).
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


CUT = {"sac": cut(B["tease"]["t0"]), "loop": cut(EC)}
SHOTS = [{"at": 0.0, "name": "syn"}, {"at": CUT["sac"], "name": "sac"}, {"at": CUT["loop"], "name": "loop"}]
IRIS = [{"t": t, "cx": 0.5, "cy": 0.42} for t in CUT.values()]

# the electron-microscope moment: the blur snaps sharp on "gap"
SHARP = [A("vo04:finally", 0.0), A("vo04:gap", 0.05)]
# the release, one handoff: the signal runs down the axon, stops at the tip; calcium in; vesicles spill; messengers drift; receptors light
REL = {
    "sig": [A("vo04:At", -0.2), A("vo04:jump", 0.1)],          # the glow arrives at the terminal and stops there
    "ca": [A("vo04:Calcium"), A("vo04:tip", 0.2)],
    "spill": [A("vo04:spill", -0.25), A("vo04:messenger", 0.2)],
    "drift": [A("vo04:drifts", -0.35), A("vo04:across", 0.35)],
    "post": A("vo04:across", 0.3),                              # the next cell lights: a new signal (in the hold)
}
# the whoa: the handoff replayed slowed, its readout 0 → 0.001 s; then the pull back, one junction used again and again
REPLAY = [A("vo05:The", -0.1), A("vo05:second", 0.3)]
USE = {"t0": A("vo05:Use", 0.0), "beats": [], "grow": [A("vo05:junction", 0.0), A("vo05:learn", 0.2)]}
TALK = A("vo06:talk", -0.6)                                 # the takeaway's line gets its own handoff: spill on "across gaps", lit on "chemicals"
MEET = [A("vo02:meeting"), A("vo02:joined", -0.3)]           # the network's junctions light as "meeting points" is said
k, t = 0, A("vo05:Use", 0.0)
while t < B["whoa"]["t1"] - 0.3:
    USE["beats"].append(round(t, 4)); k += 1; t = A("vo05:Use", 0.0) + k * 0.62
# the tally: a breath every 4 s (15 a minute, c14); on each, the hero junction hands off again
BREATHS = [round(4.0 * n, 4) for n in range(int(B["meanwhile"]["t0"] / 4.0) + 1, int((CUT["sac"] - 0.2) / 4.0) + 1)]

CAM = {
    "syn": [
        # the contact, blurred, seen obliquely: the terminal's disc covers the next cell's edge, so they look joined;
        # on "gap" the view swings side-on and the gap opens with the focus snap
        {"t": 0.0, "pos": [-36.0, 7.0, 70.0], "look": [9.0, 0.0, 0.0], "fov": 34},
        {"t": A("vo01:show"), "pos": [-34.0, 5.2, 66.0], "look": [9.0, 0.0, 0.0], "fov": 34, "ease": "sine"},
        {"t": A("vo02:reaches", 0.2), "pos": [-70.0, -140.0, 1200.0], "look": [-100.0, -200.0, -80.0], "fov": 34, "ease": "p2"},   # one cell's reach
        {"t": A("vo02:trillion", 0.2), "pos": [-60.0, -160.0, 1700.0], "look": [-90.0, -200.0, -100.0], "fov": 34, "ease": "p2"},   # the network
        {"t": A("vo02:Up", 0.0), "pos": [-55.0, -150.0, 1640.0], "look": [-90.0, -200.0, -100.0], "fov": 34, "ease": "sine"},
        {"t": A("vo02:joined", 0.1), "pos": [-36.0, 7.0, 76.0], "look": [9.0, 0.0, 0.0], "fov": 34, "ease": "p3"},           # back to the contact
        {"t": SHARP[0], "pos": [-30.0, 5.2, 72.0], "look": [9.0, 0.0, 0.0], "fov": 34, "ease": "sine"},
        {"t": SHARP[1] + 0.4, "pos": [1.0, 3.5, 63.0], "look": [8.0, 0.0, 0.0], "fov": 34, "ease": "p2"},
        # a motivated pull-out over "electricity can't jump it": the axon, the terminal and the gap in one frame
        {"t": A("vo04:electricity"), "pos": [-10.0, 1.0, 110.0], "look": [0.0, -3.5, 0.0], "fov": 34, "ease": "sine"},
        # the tip, close, a little lower and wider so the receptors and the drift clear the caption plate
        {"t": REL["ca"][0], "pos": [2.5, 5.2, 66.0], "look": [6.0, -2.4, 0.0], "fov": 34, "ease": "p2"},
        {"t": REL["drift"][1], "pos": [5.5, 3.5, 62.0], "look": [9.0, -2.6, 0.0], "fov": 34, "ease": "sine"},
        {"t": B["whoa"]["t0"], "pos": [6.5, 2.6, 70.0], "look": [10.0, -2.3, 0.0], "fov": 34, "ease": "sine"},
        {"t": A("vo05:Use", -0.2), "pos": [6.5, 2.6, 72.0], "look": [10.0, -2.3, 0.0], "fov": 34, "ease": "sine"},
        # the field: a cell with five junctions on it; the one used again and again pulses and grows
        {"t": A("vo05:stronger", 0.0), "pos": [150.0, -205.0, 260.0], "look": [90.0, -290.0, -232.0], "fov": 34, "ease": "p2"},
        {"t": B["takeaway"]["t0"], "pos": [140.0, -200.0, 240.0], "look": [88.0, -288.0, -232.0], "fov": 34, "ease": "sine"},
        {"t": A("vo06:touch", 0.0), "pos": [-2.5, 5.2, 70.0], "look": [8.0, -1.0, 0.0], "fov": 34, "ease": "p3"},             # back to the gap, lit
        {"t": B["meanwhile"]["t0"], "pos": [-1.0, 12.0, 125.0], "look": [8.0, -0.5, 0.0], "fov": 34, "ease": "sine"},        # under the tally
        {"t": CUT["sac"], "pos": [1.0, 15.0, 138.0], "look": [8.0, -0.5, 0.0], "fov": 34, "ease": "sine"},
    ],
    "sac": [
        {"t": CUT["sac"], "pos": [3010.0, 40.0, 420.0], "look": [3000.0, -40.0, 0.0], "fov": 34},
        {"t": CUT["loop"], "pos": [3006.0, 30.0, 360.0], "look": [3000.0, -40.0, 0.0], "fov": 34, "ease": "sine"},
    ],
}
CAM["loop"] = [dict(CAM["syn"][0], t=CUT["loop"])]
FOC = {
    # frame 0 and the hook: focus far behind the contact (a soft light-microscope blur); it snaps sharp on "gap"
    "syn": [{"t": 0.0, "at": "behind", "f": 0.9}, {"t": A("vo02:reaches", 0.0), "at": "net", "f": 0.25}, {"t": A("vo02:joined", -0.3), "at": "behind", "f": 0.9},
            {"t": SHARP[0], "at": "behind", "f": 0.9}, {"t": SHARP[1], "at": "gap", "f": 0.45}, {"t": A("vo05:Use", 0.2), "at": "cell2", "f": 0.3},
            {"t": A("vo06:touch", -0.4), "at": "gap", "f": 0.45}],
    "sac": [{"t": CUT["sac"], "at": "sac", "f": 0.35}],
    "loop": [{"t": CUT["loop"], "at": "behind", "f": 0.9}],
}

LABELS = [
    {"id": "gap", "text": "the gap", "color": "nerve", "mark": "dot", "at": "gap", "t0": A("vo04:gap"), "t1": A("vo04:electricity", -0.1), "shot": "syn", "side": 1},
    {"id": "tip", "text": "nerve ending", "color": "text", "mark": "dot", "at": "tip", "t0": A("vo04:electricity"), "t1": A("vo04:tip", 0.4), "shot": "syn", "side": -1},
    {"id": "ca", "text": "calcium", "glyph": "Ca²⁺", "color": "bone", "mark": "dot", "at": "ca", "t0": A("vo04:Calcium", 0.1), "t1": A("vo04:sacs", -0.5), "shot": "syn", "side": -1},
    {"id": "ves", "text": "sacs of messenger", "color": "lining", "mark": "dot", "at": "ves", "t0": A("vo04:sacs"), "t1": REL["drift"][0], "shot": "syn", "side": -1},
    {"id": "rec", "text": "receptors on the next cell", "color": "nerve", "mark": "dot", "at": "rec", "t0": A("vo04:across", 0.0), "t1": B["whoa"]["t0"] - 0.2, "shot": "syn", "side": 1},
    {"id": "used", "text": "used often: can strengthen", "color": "nerve", "mark": "dot", "at": "used", "t0": A("vo05:stronger", 0.3), "t1": B["takeaway"]["t0"] - 0.2, "shot": "syn", "side": 1},
    {"id": "gap2", "text": "the gap", "color": "nerve", "mark": "dot", "at": "gap", "t0": A("vo06:talk"), "t1": B["meanwhile"]["t0"] - 0.3, "shot": "syn", "side": 1},
]
# the handoff readout counts from the signal's arrival at the terminal to the receptors lighting, in the replay's time
_k = (REPLAY[1] - REPLAY[0]) / (REL["post"] + 0.4 - REL["sig"][0])
SPINE = [
    {"id": "q", "t0": 0.0, "t1": A("vo02:Your", -0.3), "text": "?", "unit": "", "label": "touching?"},
    {"id": "count", "t0": A("vo02:hundred", -0.1), "t1": A("vo02:Up", 0.0), "text": "100+ trillion", "unit": "", "label": "junctions in your brain, estimated"},   # c3
    {"id": "width", "t0": A("vo04:gap", 0.15), "t1": A("vo04:jump", 0.2), "text": "20–50", "unit": "nm", "label": "the gap, about"},   # c10
    {"id": "hand", "t0": REPLAY[0], "t1": A("vo05:Use", -0.3), "keys": [[round(REPLAY[0] + (REL["sig"][1] - REL["sig"][0]) * _k, 4), 0.0], [round(REPLAY[0] + (REL["post"] - REL["sig"][0]) * _k, 4), 0.001]],
     "unit": "s", "label": "the handoff, about", "fmt": 4},   # c11
]
PANELS = {"t0": B["change"]["t0"] + 0.15, "golgi": A("vo03:Golgi", -0.2), "cajal": A("vo03:Santiago", -0.1), "t1": B["why"]["t0"] - 0.1, "nobel": A("vo03:nineteen", 0.0)}
TALLY = {"t0": B["meanwhile"]["t0"] + 0.3, "t1": CUT["sac"] - 0.25, "rate": 15.0 / 60.0, "unit": "breaths", "label": "while you watched, at rest, about", "beats": BREATHS}   # c14
BADGES = [
    {"id": "nts", "text": "not to scale", "t0": 0.0, "t1": CUT["sac"]},
    {"id": "few", "text": "simplified: a few of thousands drawn", "t0": A("vo02:reaches", 0.0), "t1": A("vo02:Up", -0.2)},
    {"id": "ill", "text": "illustration: one stained tissue, two readings", "t0": PANELS["golgi"] - 0.4, "t1": PANELS["t1"] - 0.35},
    {"id": "slow-why", "text": "slowed", "slot": "tl", "t0": REL["sig"][0], "t1": REL["post"] + 1.6},
    {"id": "slow", "text": "slowed", "slot": "tl", "t0": REPLAY[0], "t1": A("vo05:Use", -0.3)},
    {"id": "fast", "text": "sped up", "slot": "tl", "t0": A("vo05:Use", 0.0), "t1": B["whoa"]["t1"]},
    {"id": "slow-talk", "text": "slowed", "slot": "tl", "t0": TALK, "t1": TALK + 2.4},
    *[{"id": f"slow-b{i}", "text": "slowed", "slot": "tl", "t0": round(b - 0.4, 4), "t1": round(b + 2.0, 4)} for i, b in enumerate(BREATHS)],
    {"id": "nts-sac", "text": "illustration, not to scale", "t0": CUT["sac"], "t1": DUR},
]
TITLE = {"series": "Meanwhile, Inside · No. 04", "title": "Do they *touch*?", "t1": round(A("vo01:For", 0.3), 4), "sig": 0.0, "y": 0.17}
END = {"t0": EC, "title": "Next, inside: *where breath goes*", "next": "Meanwhile, Inside · No. 05", "follow": "Follow Meanwhile, Inside",
       "fact": "Golgi and Cajal shared the 1906 Nobel Prize, and argued in their lectures."}   # c6
LOC = {"t0": B["meanwhile"]["t0"] + 0.4, "t1": CUT["sac"] - 0.3, "region": [0.5, 0.16]}   # the brainstem, where each breath begins
SEG_BEATS = [round(k * BEAT, 4) for k in range(round(B["meanwhile"]["t0"] / BEAT), int(TALLY["t1"] / BEAT) + 1)]

film = {
    "id": "meanwhile-inside-004", "fps": FPS, "bpm": BPM, "dur": DUR, "poster": 0.0,
    "_doc": "Compiled by compile.py from script.md, vo/ and the direction in compile.py. Do not edit by hand.",
    "shots": SHOTS, "beats": BEATS, "iris": IRIS, "sharp": SHARP, "rel": REL, "replay": REPLAY, "use": USE, "breaths": BREATHS, "talk": TALK, "meet": MEET,
    "panels": PANELS, "loc": LOC,
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
ev.append({"t": next(sp for sp in SPINE if sp["id"] == "hand")["keys"][1][0], "kind": "counter.end", "tag": "hand-end"})
ev.append({"t": TALLY["t0"], "kind": "counter.show", "tag": "tally"})
for k, t in enumerate(SEG_BEATS):
    ev.append({"t": t, "kind": "beat", "tag": f"beat{k}"})
ev.append({"t": SHARP[1], "kind": "impact", "tag": "sharp", "gain": -4.0})
ev.append({"t": REL["sig"][1], "kind": "spike", "tag": "arrive"})
ev.append({"t": REL["ca"][0], "kind": "diffuse", "tag": "calcium", "t1": REL["ca"][1]})
ev.append({"t": REL["spill"][0], "kind": "bind", "tag": "spill"})
ev.append({"t": REL["drift"][0], "kind": "dissolve", "tag": "drift", "t1": REL["drift"][1]})
ev.append({"t": REL["post"], "kind": "spike", "tag": "post"})
ev.append({"t": round(TALK + (REL["post"] - REL["sig"][0]) * 2.2 / (REL["post"] + 0.4 - REL["sig"][0]), 4), "kind": "spike", "tag": "talk", "gain": -4.0})
ev.append({"t": PANELS["t0"], "kind": "swell", "tag": "panels", "t1": PANELS["t0"] + 2.0})
for i, t in enumerate(USE["beats"]):
    ev.append({"t": t, "kind": "spike", "tag": f"use{i}", "gain": -6.0 + min(4.0, i * 0.8)})
ev.append({"t": CUT["sac"], "kind": "breath", "tag": "sac", "t1": CUT["sac"] + 1.8})

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
