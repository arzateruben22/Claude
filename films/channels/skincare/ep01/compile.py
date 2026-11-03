"""Compile Skin Sense No. 001 (reboot), "The fight you never saw": script + voice timings + this direction →
film.json (shots, camera keys, the UV and follicle keys, labels, badges, counters, captions, title and end card) and
sheet.json (the studio's cue sheet). Every moment hangs on a beat or a spoken word; every number on screen comes from
claims.json.

  python3 -I films/channels/skincare/ep01/compile.py

Three places, never in one frame: the UV cheek (x = 0, units of the shader plane), the macro terrain (x = 1000,
arbitrary units: a pore every 3.2), and the follicles in section (x = 5000 and 6150, µm; surface y = 0).
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[3] / "kits/cinema/script"))
from timeline import Film   # noqa: E402
sys.path.insert(0, str(HERE.parent / "set"))
from capglue import glue, hold, keep_units    # noqa: E402

FPS, BPM = 30, 64.2857
ID = "skin-sense-001"
f = Film(HERE / "script.md", HERE / "vo", fps=FPS, bpm=BPM)
plan, end_hold = f.script_plan()
BEATS = f.layout(plan, end_hold=end_hold)
MAXDUR = 75.0   # the delivery window is 60–75 s: trim the end card's tail (the card keeps its start; the voice ends ≈ 74.6 s)
CAM_END = f.duration   # the camera's last key stays where the untrimmed film ended, so the motion (and every frame before the cut) is unchanged
if f.duration > MAXDUR:
    cut = f.duration - MAXDUR
    BEATS = f.layout(plan, end_hold=end_hold - cut, total=MAXDUR)
A = f.at
B = {b["id"]: b for b in BEATS}

# ── the numbers (claims.json) ──────────────────────────────────────────────
NEW_FROM_CLEAR = 28          # c2: 28% of inflammatory lesions preceded by normal-looking skin (Do et al. 2008)
CELL_UM, CELL_SPREAD_UM, PAPER_UM = 8.0, 15.0, 100.0   # c11: resting neutrophil ≈ 8 µm, spread 12–15 µm; paper ≈ 100 µm
assert 6 <= PAPER_UM / CELL_SPREAD_UM and PAPER_UM / CELL_UM <= 13, "ten in a row would barely span the paper"
TONE = 0.18                  # bible §1: one tone per episode, rotating (001 light)
FX, GX, TX = 5000.0, 5700.0, 1000.0
SX = 9000.0   # the marrow stream   # the two follicle blocks (1000 µm wide each) touch: one strip of skin

# ── shots ─────────────────────────────────────────────────────────────────
t_flight, t_fol = B["change"]["t0"], A("vo03:defence", -0.35)
t_end = A("vo08:Next:", -0.25)
t_uv2 = A("vo07:No:", -0.75)
t_stream = A("vo05:Each", -0.3)   # the marrow: a river of new white cells   # the takeaway rises out of the pore over the terrain, then the viewfinder again
SHOTS = [{"at": 0.0, "name": "uv"}, {"at": t_flight, "name": "flight"}, {"at": t_fol, "name": "follicle"},
         {"at": B["why"]["t0"], "name": "pair"}, {"at": B["whoa"]["t0"], "name": "rupture"}, {"at": t_stream, "name": "stream"},
         {"at": B["toscale"]["t0"], "name": "gauge"}, {"at": B["takeaway"]["t0"], "name": "rise"}, {"at": t_uv2, "name": "uv2"}]

CUE = {"new": A("vo01:new?"), "clear1": A("vo01:clear."), "photo": A("vo02:photo"), "quarter": A("vo02:four"), "clear2": A("vo02:clear."),
       "underneath": A("vo02:underneath?"), "beneath": A("vo03:Beneath"), "defence": A("vo03:defence"), "already": A("vo03:already"), "immune": A("vo03:immune"),
       "crowding": A("vo03:crowding"), "thickly": A("vo03:thickly"), "spot3": A("vo03:spot."), "infection": A("vo04:infection."),
       "bacterium": A("vo04:bacterium"), "without": A("vo04:more."), "answers": A("vo04:answer."), "flood": A("vo05:flood"),
       "wall": A("vo05:wall"), "give": A("vo05:give"), "deeper": A("vo05:deeper."), "squeeze": A("vo05:Each"), "further": A("vo05:marrow"),
       "mark": A("vo05:several"), "pus": A("vo06:pus"), "small": A("vo06:small"), "ten": A("vo06:ten"), "paper": A("vo06:paper's"),
       "no": A("vo07:No:"), "end": A("vo07:fight"), "sight": A("vo07:sight,"), "spots4": A("vo04:acne"), "oily": A("vo04:oily"), "barrier": A("vo07:barrier."), "likely": A("vo05:Earth.")}
# the photo stack: one flip back every ~0.9 s from "photo" to "clear", six photos (−2 … −12 weeks)
FLIPS = [round(CUE["photo"] + k * (CUE["clear2"] - CUE["photo"]) / 6, 3) for k in range(1, 7)]

# ── the camera (orbit keys: target, dist, el, az, fov, fx, fy) ──────────────
UVK = {"target": [0, -0.2, 0], "el": -1, "fov": 30, "fx": 0.5, "fy": 0.5}
SPOTK = {**UVK, "target": [0.72, -0.45, 0]}   # the spot (u .60, v .45) on the cheek
CAM = {
    "uv": [{"t": 0.0, **UVK, "dist": 30, "az": -7}, {"t": CUE["new"] + 0.3, **UVK, "dist": 19, "az": -3, "ease": "out3"},   # frame 0 mid-push
           {"t": B["normal"]["t0"], **UVK, "dist": 18, "az": -1, "ease": "sine"},
           {"t": CUE["clear2"], **UVK, "dist": 17, "az": 0, "ease": "inout2"},
           {"t": t_flight, **SPOTK, "dist": 6, "az": 0, "ease": "in2"}],   # a push into the spot's pore: a dip, and the flight takes over
    "flight": [{"t": t_flight, "target": [TX, 0, 6], "el": 26, "fov": 34, "fx": 0.5, "fy": 0.48, "dist": 34, "az": -6},
               {"t": CUE["beneath"] + 0.6, "target": [TX + 1.2, 0, 1.5], "el": 34, "fov": 34, "fx": 0.5, "fy": 0.48, "dist": 20, "az": -3, "ease": "inout2"},
               {"t": t_fol, "target": [TX + 1.5, -0.3, 0.4], "el": 58, "fov": 34, "fx": 0.5, "fy": 0.5, "dist": 7, "az": -1, "ease": "in2"}],   # down into one pore
    "follicle": [{"t": t_fol, "target": [FX, -120, 0], "el": 14, "fov": 30, "fx": 0.5, "fy": 0.52, "dist": 1500, "az": -2},   # out of the pore's mouth...
                 {"t": CUE["immune"], "target": [FX, -260, 0], "el": 10, "fov": 30, "fx": 0.5, "fy": 0.52, "dist": 2000, "az": -4, "ease": "inout2"},   # ...down the canal, the ring around it
                 {"t": CUE["thickly"], "target": [FX + 130, -260, 0], "el": 10, "fov": 30, "fx": 0.5, "fy": 0.52, "dist": 1700, "az": -3, "ease": "inout2"},   # the right cluster, centred   # in on one cluster: "as thickly"
                 {"t": B["why"]["t0"], "target": [FX, -270, 0], "el": 10, "fov": 30, "fx": 0.5, "fy": 0.52, "dist": 2200, "az": -2, "ease": "inout2"}],
    "pair": [{"t": B["why"]["t0"], "target": [FX, -270, 0], "el": 10, "fov": 30, "fx": 0.5, "fy": 0.42, "dist": 2200, "az": -2},   # the pull-back: one follicle...
             {"t": CUE["bacterium"], "target": [(FX + GX) / 2, -280, 0], "el": 10, "fov": 30, "fx": 0.5, "fy": 0.4, "dist": 4000, "az": -1, "ease": "inout2"},   # ...to both, side by side
             {"t": CUE["without"] + 0.4, "target": [(FX + GX) / 2 - 20, -280, 0], "el": 10, "fov": 30, "fx": 0.5, "fy": 0.4, "dist": 3900, "az": 0, "ease": "sine"},
             {"t": CUE["answers"], "target": [FX + 120, -290, 0], "el": 10, "fov": 30, "fx": 0.5, "fy": 0.4, "dist": 3100, "az": 1, "ease": "inout2"},   # toward the ringed one already
             {"t": B["whoa"]["t0"], "target": [FX, -300, 0], "el": 10, "fov": 30, "fx": 0.5, "fy": 0.42, "dist": 2250, "az": 1, "ease": "in2"}],   # the push into the ringed one
    "rupture": [{"t": B["whoa"]["t0"], "target": [FX, -300, 0], "el": 10, "fov": 30, "fx": 0.5, "fy": 0.42, "dist": 2250, "az": 1},
                {"t": CUE["flood"], "target": [FX, -320, 0], "el": 10, "fov": 30, "fx": 0.5, "fy": 0.27, "dist": 2350, "az": 1, "ease": "inout2"},
                {"t": CUE["give"], "target": [FX, -380, 0], "el": 10, "fov": 30, "fx": 0.5, "fy": 0.3, "dist": 2000, "az": 0, "ease": "inout2"},
                {"t": t_stream, "target": [FX, -360, 0], "el": 10, "fov": 30, "fx": 0.5, "fy": 0.32, "dist": 1900, "az": -1, "ease": "inout2"}],
    "stream": [{"t": t_stream, "target": [SX, 0, 0], "el": 4, "fov": 32, "fx": 0.5, "fy": 0.5, "dist": 26, "az": -14}, {"t": B["toscale"]["t0"], "target": [SX + 6, 0, 0], "el": 6, "fov": 32, "fx": 0.5, "fy": 0.5, "dist": 21, "az": -6, "ease": "sine"}],   # alongside the river
    "gauge": [{"t": B["toscale"]["t0"], "target": [FX, -380, 0], "el": 6, "fov": 30, "fx": 0.66, "fy": 0.46, "dist": 2600, "az": -2},
              {"t": B["takeaway"]["t0"], "target": [FX + 100, -520, 0], "el": 6, "fov": 30, "fx": 0.7, "fy": 0.46, "dist": 1500, "az": -3, "ease": "inout2"}],
    "rise": [{"t": B["takeaway"]["t0"], "target": [TX + 1.5, -0.3, 0.4], "el": 60, "fov": 34, "fx": 0.5, "fy": 0.5, "dist": 6, "az": -1},   # up out of the pore...
             {"t": t_uv2, "target": [TX + 0.5, 0, 2], "el": 30, "fov": 34, "fx": 0.5, "fy": 0.48, "dist": 24, "az": -6, "ease": "out3"}],   # ...over the clear skin
    "uv2": [{"t": t_uv2, **SPOTK, "dist": 9, "az": 1}, {"t": CUE["no"] + 0.4, **UVK, "dist": 18, "az": 0, "ease": "out3"}, {"t": CAM_END, **UVK, "dist": 20, "az": -2, "ease": "sine"}],   # out of the spot, back to the cheek
}
for shot, keys in CAM.items():
    for a, b in zip(keys, keys[1:]):
        assert b["t"] > a["t"], f"{shot}: keys out of order"
        lim = 4.0 * (b["t"] - a["t"])   # an orbit no faster than 4°/s: a key that asks for more is eased back toward its neighbour
        if abs(b["az"] - a["az"]) > lim: b["az"] = round(a["az"] + (lim if b["az"] > a["az"] else -lim), 3)

# ── the overlay ─────────────────────────────────────────────────────────────
LABELS = [
    {"id": "l-spot", "text": "the spot", "kind": "cell", "anchor": "spot", "t0": 2.0, "t1": CUE["photo"], "shot": "uv", "side": 1, "v": "above", "fixed": True},
    {"id": "l-ring", "text": "white cells (immune)", "kind": "water", "anchor": "ring", "t0": CUE["already"], "t1": B["why"]["t0"], "shot": "follicle", "side": 1, "fixed": True},
    {"id": "l-bact", "text": "the same bacterium in both", "kind": "uv", "anchor": "bactMid", "t0": CUE["bacterium"], "t1": CUE["spots4"] - 0.1, "shot": "pair", "side": 1, "v": "below", "fixed": True},
    {"id": "l-with", "text": "skin with acne", "kind": "cell", "anchor": "fWith", "t0": CUE["spots4"], "t1": CUE["without"] + 0.6, "shot": "pair", "side": -1, "v": "above", "fixed": True},
    {"id": "l-wo", "text": "clear, oily skin", "kind": "cell", "anchor": "fWo", "t0": CUE["oily"] - 0.3, "t1": CUE["spots4"] - 0.35, "shot": "pair", "side": 1, "v": "above", "fixed": True},
    {"id": "l-white", "text": "more white cells", "kind": "cell", "anchor": "cell", "t0": CUE["flood"], "t1": CUE["give"], "shot": "rupture", "side": 1, "v": "below", "fixed": True},
    {"id": "l-spill", "text": "the spill", "kind": "cell", "anchor": "spill", "t0": CUE["deeper"] - 0.5, "t1": t_stream, "shot": "rupture", "side": -1, "fixed": True},
    {"id": "l-barrier", "text": "it helps build the barrier", "kind": "uv", "anchor": "spot", "t0": CUE["barrier"] - 0.4, "t1": t_end - 0.45, "shot": "uv2", "side": 1, "v": "above", "fixed": True},
    {"id": "l-rings", "text": "follicles already ringed", "kind": "water", "anchor": "rings", "t0": CUE["no"] + 0.8, "t1": CUE["barrier"] - 0.6, "shot": "uv2", "side": -1, "v": "below", "fixed": True},
]
BADGES = [
    {"id": "b-model", "text": "model, not a photo", "t0": 2.0, "t1": t_fol, "slot": "br"},
    {"id": "b-uv", "text": "UV: porphyrins glow orange-red", "t0": CUE["clear1"] - 0.6, "t1": B["normal"]["t0"] + 1.2, "slot": "bl"},
    {"id": "b-do", "text": "one study of 25 · Do et al., 2008", "t0": CUE["quarter"] - 0.3, "t1": t_flight, "slot": "tr"},
    {"id": "b-illus", "text": "illustration", "t0": max(FLIPS[0] - 0.1, B["normal"]["t0"] + 1.5), "t1": t_flight, "slot": "bl"},
    {"id": "b-jer", "text": "biopsy study · Jeremy et al., 2003", "t0": CUE["immune"], "t1": B["why"]["t0"], "slot": "tl"},
    {"id": "b-back", "text": "acne patients' back skin", "t0": CUE["immune"], "t1": B["why"]["t0"], "slot": "tr"},
    {"id": "b-simp", "text": "simplified", "t0": t_fol, "t1": B["toscale"]["t0"], "slot": "br"},
    {"id": "b-modp", "text": "model on a tissue photo", "t0": B["why"]["t0"], "t1": CUE["answers"] - 0.4, "slot": "tl"},
    {"id": "b-deb", "text": "debated", "t0": CUE["answers"] - 0.2, "t1": B["whoa"]["t0"], "slot": "tl"},
    {"id": "b-model2", "text": "model on a tissue photo", "t0": B["whoa"]["t0"], "t1": t_stream, "slot": "tl"},
    {"id": "b-model2s", "text": "model, not a photo", "t0": t_stream, "t1": B["toscale"]["t0"] - 0.45, "slot": "tl"},
    {"id": "b-model2b", "text": "model on a tissue photo", "t0": B["toscale"]["t0"] - 0.15, "t1": B["toscale"]["t0"] + 0.7, "slot": "tl"},
    {"id": "b-photo", "text": "tissue photo (normal skin)", "t0": t_fol, "t1": B["why"]["t0"], "slot": "bl"},
    {"id": "b-alm", "text": "lab + mouse study · Almoughrabie 2023", "t0": CUE["barrier"] - 2.8, "t1": t_end - 0.45, "slot": "tl"},
    {"id": "b-sum", "text": "neutrophils · Summers et al., 2010", "t0": t_stream + 0.3, "t1": B["toscale"]["t0"], "slot": "bl"},
    {"id": "b-scale", "text": "to scale · Ting-Beall, 1993", "t0": B["toscale"]["t0"] + 0.3, "t1": B["takeaway"]["t0"], "slot": "tr"},
    {"id": "b-model3", "text": "model, not a photo", "t0": B["takeaway"]["t0"], "t1": t_end - 0.45, "slot": "br"},
]
SPINE = [0.5, 0.215]
COUNTERS = [
    {"id": "c-28", "label": "of new red spots, from clear skin", "text": f"{NEW_FROM_CLEAR}%", "t0": CUE["quarter"], "t1": t_flight},
    {"id": "c-ans", "label": "the spot is largely", "text": "the body's answer", "t0": CUE["answers"] + 0.3, "t1": B["whoa"]["t0"]},   # debated: ends with its badge
    {"id": "c-day", "label": "new white cells, each day", "text": "≈ 50–100 billion", "t0": CUE["mark"] - 0.2, "t1": B["toscale"]["t0"]},
    {"id": "c-final", "label": "the spot", "text": "not new", "t0": CUE["no"] + 0.2, "t1": t_end - 0.5},
]
for c in COUNTERS:
    c.update({"fmt": "text", "at": SPINE})
CUTS = [sh["at"] for sh in SHOTS[1:]]


def before_cut(t1, lead=0.45):
    return round(t1 - lead, 4) if any(abs(t1 - c) < 1e-6 for c in CUTS) else t1


for row in BADGES + COUNTERS + LABELS:
    row["t1"] = before_cut(row["t1"])
for a, b in zip(COUNTERS, COUNTERS[1:]):
    if b["t0"] - a["t1"] < 0.4:
        a["t1"] = round(b["t0"] - 0.4, 4)

# the follicle story's keys (scene.mjs reads them)
KEYS = {"porph": [-1.0, 0.0], "spotGone": [FLIPS[3], FLIPS[5]], "ring": [CUE["crowding"] - 0.3, CUE["thickly"] + 0.4],
        "ringLit": [CUE["already"] - 0.2, CUE["already"] + 0.5], "bact": [CUE["bacterium"] - 0.4, CUE["bacterium"] + 0.4],
        "answer": [CUE["answers"] - 0.2, CUE["answers"] + 0.6], "flood": [CUE["flood"] - 0.3, CUE["wall"] + 0.3], "rupt": [CUE["give"] - 0.2, CUE["deeper"] + 0.5],
        "rings": [CUE["no"] + 0.2, CUE["no"] + 1.0], "stream": [t_stream, B["toscale"]["t0"]], "barrier": [CUE["barrier"] - 0.6, CUE["barrier"] + 0.6], "wipe1": [CUE["clear2"] - 0.1, CUE["clear2"] + 0.6], "wipe2": [CUE["no"] - 0.1, CUE["no"] + 0.6], "dayOn": FLIPS[0] - 0.35}
# the gauge (scene.mjs): a centred card; one white cell drops in on "pus", is named on "small", ten stack on "ten" (10 × 8 = 80 µm),
# the paper's 100 µm draws beside them on "paper's"
GAUGE = {"rise": [B["toscale"]["t0"] + 0.1, B["toscale"]["t0"] + 0.7], "pus": CUE["pus"] - 0.1, "sc": CUE["pus"] + 1.1, "ten": [CUE["small"], CUE["ten"] + 1.0],
         "paper": CUE["paper"] - 0.2, "back": [B["takeaway"]["t0"] - 0.3, B["takeaway"]["t0"] - 0.02], "cell_um": CELL_UM, "paper_um": PAPER_UM, "n": 10}
assert GAUGE["n"] * CELL_UM <= PAPER_UM

TITLE = {"series": "Skin Sense · No. 001", "title": "The fight you *never saw*", "t0": 0.6, "t1": CUE["clear1"] - 0.5, "sig": A("vo01:new?", 0.35)}
END = {"title": "Next: where the light on your face *goes*", "follow": "Skin Sense · No. 002",
       "next": "In one study, 28% of new inflamed spots rose from skin that looked clear (Do et al., 2008). Narration: synthetic voice (AI)."}
POSTER = A("vo05:deeper.", 0.2)

glue(f, {"vo01": ["this spot", "Its fight", "perfectly clear."], "vo02": ["photo by photo,", "one new red spot", "in four", "looked clear.", "what was happening"],
         "vo03": ["clear skin,", "the defence", "already gathered,", "immune cells", "the follicle,", "a red spot."],
         "vo04": ["an infection.", "the most common", "clear, oily skin,", "skin with acne", "no more.", "your body's answer."],
         "vo05": ["White cells", "flood in", "give way,", "the fight deeper.", "Each day,", "your marrow", "every person", "on Earth."],
         "vo06": ["pus", "fight's fallen:", "white cells", "ten in a row", "this paper's thickness."], "vo07": ["Is it new?", "out of sight,", "a germ", "your skin's barrier."],
         "vo08": ["on your face,", "really goes."]})
CAPS = hold(f, keep_units(f.captions(max_chars=24)))

film = {
    "id": ID, "fps": FPS, "bpm": BPM, "dur": f.duration, "poster": POSTER,
    "shots": SHOTS, "beats": BEATS, "tone": TONE, "flips": FLIPS, "keys": KEYS,
    "place": {"fx": FX, "gx": GX, "tx": TX, "sx": SX},
    "cam": CAM, "cue": CUE, "gauge": GAUGE,
    "labels": LABELS, "badges": BADGES, "counters": COUNTERS, "pills": [],
    "title": TITLE, "endCard": t_end, "end": END,
    "captions": CAPS,
    "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines],
}

ev = [{"t": b["t0"], "kind": "section", "id": b["id"], "t1": b["t1"]} for b in BEATS]
ev.append({"t": TITLE["sig"], "kind": "signature", "tag": "title"})
ev.append({"t": t_end, "kind": "signature", "tag": "end"})
for L in LABELS:
    if L["t0"] > 0:
        ev.append({"t": L["t0"], "kind": "label", "tag": L["id"]})
for c in COUNTERS:
    ev.append({"t": c["t0"], "kind": "counter.show", "tag": c["id"]})
for b in BADGES:
    if b["t0"] > 0:
        ev.append({"t": b["t0"], "kind": "badge", "tag": b["id"]})
ev += [{"t": t, "kind": "cell.land", "tag": f"flip{i + 1}"} for i, t in enumerate(FLIPS)]   # the shutter of each photo
ev += [
    {"t": t_flight, "kind": "scale.jump", "tag": "into-skin"},
    {"t": CUE["clear2"], "kind": "reveal", "tag": "uv-switch"},
    {"t": CUE["no"], "kind": "reveal", "tag": "uv-switch2"},
    {"t": B["takeaway"]["t0"], "kind": "scale.jump", "tag": "out-of-spot"},
    {"t": KEYS["ring"][0], "kind": "diffuse", "tag": "ring"},
    {"t": KEYS["answer"][0], "kind": "reveal", "tag": "answer"},
    {"t": B["whoa"]["t0"], "kind": "swell", "tag": "whoa", "t1": B["whoa"]["t1"]},
    {"t": KEYS["rupt"][0], "kind": "dissolve", "tag": "rupture", "t1": KEYS["rupt"][1]},
    {"t": GAUGE["sc"], "kind": "scale", "tag": "g-cell"},
    {"t": GAUGE["ten"][0], "kind": "scale", "tag": "g-ten"},
    {"t": GAUGE["paper"], "kind": "reveal", "tag": "g-paper"},
]
cues_file = HERE / "build" / f"cues-{ID}-9x16.json"
shown = {}
if cues_file.exists():
    cj = json.loads(cues_file.read_text())
    pic = {e.get("tag"): e for e in cj.get("events", [])}
    for e in ev:
        p = pic.get(e.get("tag"))
        if p and p.get("pos") and e["kind"] in ("label", "counter.show"):
            e["pos"] = p["pos"]
    shown = {k: v for k, v in (cj.get("shown") or {}).items() if k.startswith("l-") and v > 0}
sheet = {"duration": f.duration, "fps": FPS, "preset": "outerlayer-slide",
         "sections": [{"id": b["id"], "t0": b["t0"], "t1": b["t1"], "energy": b["energy"]} for b in BEATS],
         "events": sorted(ev, key=lambda e: e["t"]),
         "voice": [{"id": v["id"], "t": v["t"], "file": v["file"]} for v in film["voice"]]}
if shown:
    sheet["shown"] = shown

(HERE / "film.json").write_text(json.dumps(film, indent=1, ensure_ascii=False))
(HERE / "sheet.json").write_text(json.dumps(sheet, indent=1, ensure_ascii=False))
print(f"film.json: {f.duration:.2f} s, {len(SHOTS)} shots, {sum(len(k) for k in CAM.values())} camera keys, {len(LABELS)} labels, "
      f"{len(BADGES)} badges, {len(COUNTERS)} counters, {len(CAPS)} caption pages, end card {t_end:.2f} s")
print("  shots " + " · ".join(f"{s['name']} {s['at']:.2f}" for s in SHOTS))
print(f"sheet.json: {len(sheet['events'])} events" + (f", {len(shown)} shown times from the picture" if shown else ""))
for pg in CAPS:
    print(f"  {pg['t0']:6.2f}–{pg['t1']:6.2f}  " + " / ".join(" ".join(w for w, _ in r).replace(" ", " ") for r in pg["lines"]))
