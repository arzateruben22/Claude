"""Compile Meanwhile, Inside No. 01, "Single file": script + voice timings + this direction → film.json (the
scene's clock: shots, irises, the blood-flow clock, the hero's anchors, camera and focus keys, labels, badges,
scale pills, counters, title and end card, captions) and sheet.json (the studio's cue sheet). Nothing here is
a hand-typed time: every moment hangs on a beat or a spoken word.

  python3 -I films/channels/body/ep01/compile.py

Anchors: A("vo03:branches#2") is when the second "branches" starts in line vo03; ":end" its end; "beat:why" a
beat's start (kits/cinema/script/timeline.py). Cuts sit half a frame before a frame, so no frame's shutter
(the finish blurs over half a frame) straddles two places, and every cut is hidden at the closed moment of a
membrane iris (the channel's grammar: each scale is its own slide, joined by the iris).

The hero's journey is solved in the scene (scene.mjs) from the anchors in film.json "hero": where along its
vessel it must be at a given word (it reaches the first branch on "branches", the pinch on "Squeeze" ...). The
vessel's widths are then laid out so that the flow (v ∝ 1/r² in one tube, slowed ×100, ×10 for the ride)
brings it there; camera keys are offsets from the hero, so a tracking shot can't lose it.

If build/cues-meanwhile-inside-001-9x16.json exists (node kits/cinema/film/render.mjs --film . --cues), its
measured positions and first-shown times are merged into the sheet (pan, and the studio's picture-sync check).
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]                                   # films/channels/body/ep01 → repo root
sys.path.insert(0, str(ROOT / "kits/cinema/script"))
from timeline import Film   # noqa: E402

FPS, BPM = 30, 75
BEAT = 60.0 / BPM                                        # 0.8 s: a resting heart rate (theme.json motif.sound)
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
    """A cut half a frame before the frame nearest t."""
    return round(fr(t) - HALF, 6)


# ── shots and the irises that join them ─────────────────────────────────────────────────────────
CUT = {
    "meet": cut(B["normal"]["t0"]),                     # the capillary → an artery (same scale, another place)
    "tree": cut(B["change"]["t0"]),                     # the cell → the vessel tree (scale out)
    "road": cut(A("vo03:The#2", -0.05)),                # the tree → riding beside the cell (scale in)
    "net": cut(A("vo05:And", -0.12)),                   # the tightest vessel → the capillary net (the reveal pull)
    "out": cut(B["takeaway"]["t0"]),                    # the net → the cell popping out (scale in)
    "tease": cut(B["tease"]["t0"]),                     # into the cell
}
SHOTS = [{"at": 0.0, "name": "hook"}] + [{"at": t, "name": n} for n, t in CUT.items()]
IRIS = [  # cx, cy: where the hole closes and reopens (the incoming subject's place on screen)
    {"t": CUT["meet"], "cx": 0.5, "cy": 0.40}, {"t": CUT["tree"], "cx": 0.5, "cy": 0.40},
    {"t": CUT["road"], "cx": 0.5, "cy": 0.38}, {"t": CUT["net"], "cx": 0.5, "cy": 0.40, "close": 0.3, "open": 0.4},
    {"t": CUT["out"], "cx": 0.5, "cy": 0.40}, {"t": CUT["tease"], "cx": 0.5, "cy": 0.40},
]

# ── the blood-flow clock (sci/clock.js): slowed ×100, and ×10 for the ride-along (≤ 3 s, bible + cross-check) ──
RIDE0 = CUT["road"]                                      # the ride starts as the iris opens on it
RIDE_RAMP, RIDE_BACK = 0.3, 0.35
RIDE1 = round(RIDE0 + 3.0 - RIDE_BACK, 6)                # back to ×100 by RIDE0 + 3.0 s
CLOCK = [{"t": 0.0, "rate": 0.01}, {"t": RIDE0, "rate": 0.1, "ramp": RIDE_RAMP}, {"t": RIDE1, "rate": 0.01, "ramp": RIDE_BACK}]

# ── the hero: where along its vessel it must be, and when (scene.mjs lays the vessel out to match) ──
HERO = {
    # the hook (a flash-forward): folded in the narrow stretch of its capillary, the road ahead in view
    "hook": {"at": 0.0, "place": "narrow", "ahead": 52.0},
    # the meet shot: a free disc in an artery's crowd; its tumble (axis relative to the camera) and its cut
    "meet": {"turn": [[CUT["meet"], "face"], [A("vo02:dimpled", -0.35), "face"], [A("vo02:dimpled", 0.5), "edge"],
                      [A("vo02:You", 0.6), "edge"], [A("vo02:most", 0.2), "tumble"]],
             "cut": [[A("vo02:no", -0.5), 0.0], [A("vo02:no", 0.05), 1.0], [A("vo02:You", 0.35), 1.0], [A("vo02:You", 0.95), 0.0]]},
    # the journey, one continuous solve from the tree to the tightest: [film time, feature reached]
    "road": [
        [A("vo03:branches"), "bp1"],                     # the first branch point, on "branches"
        [A("vo03:branches#2"), "bp2"],                   # the second, on "branches" again
        [A("vo03:capillary"), "cap"],                    # into the capillary, on "capillary"
        [A("vo03:slimmer", -0.2), "narrow"],             # the capillary narrows below the cell's width
        [A("vo04:trick", 0.3), "wide"],                  # a wider stretch: the cell has relaxed to a disc by "here's the trick"
        [A("vo04:Squeeze"), "pinch"],                    # "Squeeze": its nose enters the pinch
        [A("vo05:tightest", 0.35), "tight"],             # the tightest, about three micrometers
    ],
    "why_cut": [[A("vo04:dimples", -0.55), 0.0], [A("vo04:dimples", -0.05), 1.0], [A("vo04:volume:end", 0.15), 1.0], [A("vo04:so", 0.45), 0.0]],
    # the takeaway: it pops out of the capillary into a venule on "dimple" and springs back to a disc
    "out": {"at": A("vo06:dimple"), "place": "exit",
            # the camera lets the cell go and looks back down the capillary it left (the smallest vessels)
            "track": [A("vo06:smallest", -1.7), A("vo06:smallest", 0.4)]},
    "tease_cut": [[A("vo08:carrying", -0.4), 0.0], [A("vo08:carrying", 0.25), 1.0]],
    "sparkle": [A("vo08:billion"), A("vo08:passengers:end", 0.3)],
}

# ── camera keys per shot: offsets from the hero (rel), so tracking shots keep it; µm, fov in degrees ──
CAM = {
    "hook": [
        {"t": 0.0, "pos": [6.0, -6.5, 19.5], "look": [0.0, -0.6, 0.0], "fov": 34},
        {"t": A("vo01:folded"), "pos": [5.2, -5.6, 17.5], "look": [0.0, -0.6, 0.0], "fov": 34, "ease": "sine"},
        {"t": A("vo01:narrower", -0.3), "pos": [5.0, -6.5, 23.0], "look": [0.0, 7.0, -0.8], "fov": 36, "ease": "p2"},   # the road ahead
        {"t": CUT["meet"], "pos": [4.0, -4.0, 25.0], "look": [0.0, 9.0, -0.8], "fov": 36, "ease": "sine"},
    ],
    "meet": [
        {"t": CUT["meet"], "pos": [1.5, 3.0, 30.0], "look": [0.0, -1.4, 0.0], "fov": 34},
        {"t": A("vo02:dimpled", -0.3), "pos": [-2.0, 2.5, 26.0], "look": [0.0, -1.2, 0.0], "fov": 34, "ease": "sine"},
        {"t": A("vo02:no", 0.1), "pos": [-1.0, -1.6, 34.0], "look": [0.0, -1.6, 0.0], "fov": 34, "ease": "p2"},   # in to the cut, level with it
        {"t": A("vo02:You", 0.5), "pos": [-0.8, -1.5, 34.5], "look": [0.0, -1.5, 0.0], "fov": 34, "ease": "sine"},
        {"t": A("vo02:trillion", 0.2), "pos": [14.0, 12.0, 74.0], "look": [0.0, 3.0, 0.0], "fov": 36, "ease": "p3"},   # crane back: the crowd
        {"t": CUT["tree"], "pos": [18.0, 16.0, 92.0], "look": [0.0, 4.0, 0.0], "fov": 36, "ease": "sine"},
    ],
    "tree": [
        {"t": CUT["tree"], "pos": [22.0, -30.0, 96.0], "look": [-2.0, 2.0, 0.0], "fov": 36},
        {"t": A("vo03:branches#2"), "pos": [18.0, -26.0, 90.0], "look": [-1.0, 2.0, 0.0], "fov": 36, "ease": "sine"},
        {"t": CUT["road"], "pos": [12.0, -20.0, 80.0], "look": [0.0, 2.0, 0.0], "fov": 36, "ease": "sine"},
    ],
    "road": [
        # the ride-along: locked beside the cell, looking up the vessel past it (walls stream; no cell within 15 µm of the lens)
        {"t": CUT["road"], "pos": [7.0, -10.0, 21.0], "look": [0.0, -0.5, -1.0], "fov": 40},
        {"t": RIDE1, "pos": [7.0, -10.0, 21.0], "look": [0.0, -0.5, -1.0], "fov": 40, "ease": "sine"},
        {"t": A("vo03:single", 0.3), "pos": [14.0, -12.0, 50.0], "look": [0.0, -15.0, 0.0], "fov": 36, "ease": "p2"},    # single file: the cells coming up behind it
        {"t": B["why"]["t0"], "pos": [13.0, -8.0, 46.0], "look": [0.0, -10.0, 0.0], "fov": 36, "ease": "sine"},
        {"t": A("vo04:dimples", -0.6), "pos": [1.5, 0.6, 27.0], "look": [0.0, -1.2, 0.0], "fov": 34, "ease": "p2"},     # face the cut
        {"t": A("vo04:volume:end", 0.3), "pos": [1.5, 0.6, 26.0], "look": [0.0, -1.2, 0.0], "fov": 34, "ease": "sine"},
        {"t": A("vo04:parachute", -0.2), "pos": [9.5, -5.0, 27.0], "look": [0.0, -1.6, 0.0], "fov": 34, "ease": "p2"},   # three-quarter: the cup
        {"t": A("vo04:Squeeze"), "pos": [8.5, -3.0, 26.0], "look": [0.0, -1.6, 0.0], "fov": 34, "ease": "sine"},
        {"t": B["why"]["t1"] - 0.2, "pos": [11.0, -6.0, 32.0], "look": [0.0, -4.0, 0.0], "fov": 34, "ease": "sine"},    # the next cell squeezes too
        {"t": A("vo05:tightest", -0.2), "pos": [3.0, -1.5, 30.0], "look": [0.0, -2.4, 0.0], "fov": 34, "ease": "p2"},     # side on: the 3 µm vessel
        {"t": CUT["net"], "pos": [3.0, -1.5, 29.0], "look": [0.0, -2.4, 0.0], "fov": 34, "ease": "sine"},
    ],
    "net": [  # the reveal pull: an even zoom out (a geometric dolly), then a slow drift
        {"t": CUT["net"], "pos": [4.0, -6.0, 60.0], "look": [0.0, 0.0, 0.0], "fov": 36},
        {"t": CUT["net"] + 1.0, "pos": [8.0, -14.0, 110.0], "look": [0.0, 6.0, 0.0], "fov": 36, "ease": "linear"},
        {"t": CUT["net"] + 2.0, "pos": [14.0, -26.0, 200.0], "look": [0.0, 12.0, 0.0], "fov": 36, "ease": "linear"},
        {"t": CUT["net"] + 3.0, "pos": [22.0, -40.0, 320.0], "look": [0.0, 20.0, 0.0], "fov": 36, "ease": "linear"},
        {"t": CUT["net"] + 4.4, "pos": [30.0, -52.0, 440.0], "look": [0.0, 28.0, 0.0], "fov": 36, "ease": "out"},
        {"t": CUT["out"], "pos": [34.0, -58.0, 470.0], "look": [0.0, 30.0, 0.0], "fov": 36, "ease": "sine"},
    ],
    "out": [
        {"t": CUT["out"], "pos": [7.0, -7.0, 28.0], "look": [0.0, -2.0, 0.0], "fov": 34},
        {"t": A("vo06:decoration:end", 0.2), "pos": [5.0, -4.0, 25.0], "look": [0.0, -1.6, 0.0], "fov": 34, "ease": "sine"},
        {"t": A("vo06:smallest", 0.4), "pos": [10.0, -8.0, 50.0], "look": [0.0, -4.0, 0.0], "fov": 36, "ease": "p2"},     # (now on the capillary)
        {"t": A("vo06:oxygen", 0.6), "pos": [10.0, -9.0, 53.0], "look": [0.0, -4.5, 0.0], "fov": 36, "ease": "sine"},
        {"t": B["meanwhile"]["t0"] + 0.6, "pos": [18.0, -16.0, 92.0], "look": [0.0, 12.0, 0.0], "fov": 36, "ease": "p2"},  # room for the tally
        {"t": CUT["tease"], "pos": [22.0, -18.0, 100.0], "look": [0.0, 12.0, 0.0], "fov": 36, "ease": "sine"},
    ],
    "tease": [
        {"t": CUT["tease"], "pos": [0.0, -2.0, 36.0], "look": [0.0, -2.0, 0.0], "fov": 34},
        {"t": A("vo08:carrying"), "pos": [0.0, -1.9, 29.0], "look": [0.0, -1.9, 0.0], "fov": 34, "ease": "sine"},
        {"t": EC, "pos": [0.0, -1.4, 19.0], "look": [0.0, -1.4, 0.0], "fov": 34, "ease": "p2"},     # push into the cell
        {"t": DUR, "pos": [0.0, -1.3, 17.5], "look": [0.0, -1.3, 0.0], "fov": 34, "ease": "sine"},
    ],
}
for keys in CAM.values():                                # every key is an offset from the hero (keys.js "rel")
    for k in keys:
        k["rel"] = True
# focus: "hero" is the cell; "cap" its cut face; "ahead" the road ahead; "below" the capillary it left. f is the f-stop.
FOC = {
    "hook": [{"t": 0.0, "at": "hero", "f": 0.55}, {"t": A("vo01:narrower", -0.2), "at": "ahead", "f": 0.5}],
    "meet": [{"t": CUT["meet"], "at": "hero", "f": 0.5}, {"t": A("vo02:no", -0.2), "at": "cap", "f": 0.5},
             {"t": A("vo02:trillion"), "at": "hero", "f": 0.3}],
    "tree": [{"t": CUT["tree"], "at": "hero", "f": 0.25}],
    "road": [{"t": CUT["road"], "at": "hero", "f": 0.45}, {"t": A("vo03:single", -0.4), "at": "hero", "f": 0.3},
             {"t": A("vo04:dimples", -0.6), "at": "cap", "f": 0.5}, {"t": A("vo04:parachute", -0.2), "at": "hero", "f": 0.5},
             {"t": A("vo05:tightest", -0.2), "at": "hero", "f": 0.5}],
    "net": [{"t": CUT["net"], "at": "hero", "f": 0.25}],
    "out": [{"t": CUT["out"], "at": "hero", "f": 0.5}, {"t": A("vo06:smallest", -0.5), "at": "below", "f": 0.4},
            {"t": B["meanwhile"]["t0"] + 0.3, "at": "below", "f": 0.75}],
    "tease": [{"t": CUT["tease"], "at": "hero", "f": 0.5}, {"t": A("vo08:carrying"), "at": "cap", "f": 0.55}],
}

# ── the overlay: labels (each names its part in words; colour on the dot and border), pills, counters ──
LABELS = [
    {"id": "rbc", "text": "red blood cell", "color": "oxy", "mark": "dot", "at": "hero", "t0": A("vo02:red"), "t1": CUT["tree"], "shot": "meet", "side": 1},
    {"id": "nonuc", "text": "no nucleus", "color": "text", "mark": "none", "at": "cap", "t0": A("vo02:no"), "t1": A("vo02:You", 0.6), "shot": "meet", "side": -1},
    {"id": "capillary", "text": "capillary", "color": "lining", "mark": "dot", "at": "capwall", "t0": A("vo03:capillary"), "t1": CUT["road"], "shot": "tree", "side": -1},
    {"id": "dimple", "text": "dimple", "color": "oxy", "mark": "dot", "at": "cap", "t0": A("vo04:dimples"), "t1": A("vo04:so", 0.3), "shot": "road", "side": 1},
    {"id": "ghostw", "text": "its width: 7.5 µm", "color": "text", "mark": "dot", "at": "ghost", "t0": A("vo05:half"), "t1": CUT["net"] - 0.3, "shot": "road", "side": 1},
    {"id": "o2", "text": "oxygen", "glyph": "O₂", "color": "o2", "mark": "ring", "at": "o2", "t0": A("vo06:oxygen"), "t1": B["meanwhile"]["t0"] + 0.4, "shot": "out", "side": 1},
]
SCALES = [
    {"id": "cell", "text": "7.5 µm", "len": 7.5, "at": "hero", "t0": A("vo02:seven"), "t1": A("vo02:no", -0.3), "shot": "meet"},
    {"id": "vessel", "text": "3 µm", "len": 3.0, "at": "hero", "t0": A("vo05:three"), "t1": CUT["net"] - 0.3, "shot": "road"},
    {"id": "net", "text": "50 µm", "len": 50.0, "at": "hero", "t0": CUT["net"] + 2.4, "t1": CUT["out"] - 0.3, "shot": "net"},
]
GHOST = [A("vo05:half", -0.1), CUT["net"]]               # the undeformed cell's outline, beside the folded one
LIFE = {"t0": A("vo05:about#2", -0.2), "keys": [[A("vo05:about#2"), 0], [A("vo05:days"), 120]], "t1": CUT["out"] - 0.3, "unit": "days", "label": "a red cell's life, about"}
TALLY = {"t0": B["meanwhile"]["t0"], "t1": CUT["tease"] - 0.25, "rate": 2_000_000, "label": "new red cells while you watched"}   # c13: 2,000,000 × t from frame 0
BADGES = [
    {"id": "nts-tree", "text": "not to scale", "t0": CUT["tree"], "t1": CUT["road"] - 0.3},
    {"id": "nts-o2", "text": "not to scale", "t0": A("vo06:oxygen", -0.3), "t1": CUT["tease"] - 0.3},
    {"id": "nts-in", "text": "not to scale", "t0": A("vo08:carrying"), "t1": EC},
]
TITLE = {"series": "Meanwhile, Inside · No. 01", "title": "Single *file*", "t1": round(A("vo01:Because") + 0.35, 4), "sig": 0.0, "y": 0.17}
END = {"t0": EC, "title": "Next, inside: *a billion passengers*", "next": "Meanwhile, Inside · No. 02", "follow": "Follow Meanwhile, Inside"}

# the lub-dub: beats on the 75 BPM grid (a beat is 0.8 s); the pulse line kicks on each lub
SEG_BEATS = [round(k * BEAT, 4) for k in range(round(B["meanwhile"]["t0"] / BEAT), int(TALLY["t1"] / BEAT) + 1)]

film = {
    "id": "meanwhile-inside-001", "fps": FPS, "bpm": BPM, "dur": DUR, "poster": 0.0,
    "_doc": "Compiled by compile.py from script.md, vo/ and the direction in compile.py. Do not edit by hand.",
    "shots": SHOTS, "beats": BEATS, "iris": IRIS, "clock": CLOCK, "ride": [RIDE0, RIDE1 + RIDE_BACK],
    "hero": HERO, "cam": CAM, "foc": FOC,
    "labels": LABELS, "scales": SCALES, "ghost": GHOST, "life": LIFE, "tally": TALLY, "badges": BADGES,
    "segBeats": SEG_BEATS, "title": TITLE, "endCard": EC, "end": END,
    "look": THEME["scene"],
    "captions": f.captions(max_chars=THEME["sizes"]["caption"]["maxChars"]),
    "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines],
}

# ── the studio's cue sheet: the same moments as sound events ─────────────────────────────────────
ev = [{"t": b["t0"], "kind": "section", "id": b["id"], "t1": b["t1"]} for b in BEATS]
ev.append({"t": TITLE["sig"], "kind": "signature", "tag": "title", "gain": -3.0})
ev.append({"t": EC, "kind": "signature", "tag": "end"})
for lb in LABELS:
    ev.append({"t": lb["t0"], "kind": "label", "tag": lb["id"]})
for sp in SCALES:
    ev.append({"t": sp["t0"], "kind": "scale", "tag": sp["id"]})
for bd in BADGES:
    ev.append({"t": bd["t0"], "kind": "badge", "tag": bd["id"], "text": bd["text"]})
ev.append({"t": LIFE["t0"], "kind": "counter.show", "tag": "life"})
ev.append({"t": LIFE["keys"][1][0], "kind": "counter.end", "tag": "life-end"})
ev.append({"t": TALLY["t0"], "kind": "counter.show", "tag": "tally"})
for k, t in enumerate(SEG_BEATS):                        # the segment's lub-dub (thump E♭2, B♭2 at +10 frames)
    ev.append({"t": t, "kind": "beat", "tag": f"beat{k}"})
# the ride: a rush of plasma as the clock runs ×10 (the preset's "breath", a whoosh from its onset)
ev.append({"t": RIDE0, "kind": "breath", "tag": "ride", "t1": RIDE1 + RIDE_BACK})
# the squeeze through the pinch (a squish over the span) and the spring back (a soft thump)
ev.append({"t": A("vo04:Squeeze"), "kind": "cell.pass", "tag": "squeeze", "t1": A("vo04:spring")})
ev.append({"t": A("vo04:spring"), "kind": "impact", "tag": "spring"})
ev.append({"t": HERO["out"]["at"], "kind": "impact", "tag": "pop", "gain": -4.0})
# the reveal pull: a low swell under the net; O₂ handed out: a sparkle of mallet grains over the diffusion
ev.append({"t": CUT["net"], "kind": "swell", "tag": "net-swell", "t1": CUT["net"] + 2.4})
ev.append({"t": A("vo06:oxygen"), "kind": "diffuse", "tag": "o2-out", "t1": A("vo06:out:end", 0.4)})
ev.append({"t": HERO["sparkle"][0], "kind": "dissolve", "tag": "passengers", "t1": HERO["sparkle"][1]})

# merge the page's own measurements, when render.mjs --cues has run
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
      f"{len(SCALES)} pills, {len(BADGES)} badges, {len(film['captions'])} caption pages, end card {EC} s, {DUR} s")
print(f"sheet.json: {len(sheet['events'])} events ({'with' if shown else 'without'} the page's cue measurements), {len(sheet['voice'])} voice lines")
for b in BEATS:
    print(f"  {b['id']:<9} {b['t0']:6.2f}–{b['t1']:6.2f}  line {b['line']}")
print("  cuts: " + ", ".join(f"{k} {v:.4f}" for k, v in CUT.items()) + f"; ride ×10 {RIDE0:.3f}–{RIDE1 + RIDE_BACK:.3f}")
