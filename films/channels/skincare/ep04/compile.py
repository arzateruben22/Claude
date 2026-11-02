"""Compile Outer Layer No. 004, "What a tan is": script + voice timings + this direction → film.json (the scene's
clock: shots, the tanning clock, camera keys, labels, badges, counters, captions, title and end card) and sheet.json
(the studio's cue sheet). Nothing here is a hand-typed time: every moment hangs on a beat or a spoken word
(kits/cinema/script/timeline.py anchors), and every number on screen comes from claims.json.

  python3 -I films/channels/skincare/ep04/compile.py

If build/cues-outerlayer-004-9x16.json exists (render.mjs --cues), each label and counter also gets the picture's
own screen position (pan) and its measured first frame ("shown", the studio's independent sync check).

Units in the scene: 1 unit = 1 µm. The section's top surface is y = 0; depth is −y. The DNA ladder is its own place
(x = 3000, not to scale with the section) and never shares a frame with it.
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[3] / "kits/cinema/script"))
from timeline import Film   # noqa: E402
sys.path.insert(0, str(HERE.parent / "set"))
from capglue import glue, hold, keep_units    # noqa: E402

FPS, BPM = 30, 64.2857                   # bible §3: F major at 64.2857 BPM (a 16th = 7 frames)
ID = "outerlayer-004"
f = Film(HERE / "script.md", HERE / "vo", fps=FPS, bpm=BPM)
plan, end_hold = f.script_plan()
BEATS = f.layout(plan, end_hold=end_hold)
A = f.at
B = {b["id"]: b for b in BEATS}

# ── the biology (claims.json) ───────────────────────────────────────────────
SC_UM = 17.0            # No. 001's cheek stratum corneum (≈ 16.8 µm), the section's dead layer
NUC_UM = 8.6            # c13: a keratinocyte nucleus ≈ 8.6 µm (Gareau 2011, estimate); the cap is as wide; shown "≈ 9 µm"
PAPER_UM = 100.0        # c14: 80 gsm copy paper ≈ 100 µm
TAN_DAYS = 3.0          # c10: a delayed tan shows about 48–72 h after exposure; the clock runs to day 3
SPF_TAN = (3, 4)        # c12: a tan ≈ SPF 3–4 (estimate)
PASS = 1 / 3.5          # the share of UV dashes that still get through a full tan in the whoa (≈ 1/SPF, illustration)
ROWS, GRAN_UM, SPIN_UM, BASAL_UM = 15, 10.0, 48.0, 10.0   # the section as No. 001 draws it (simplified, badged)
assert 10 < PAPER_UM / NUC_UM < 13, "a dozen side by side"

# ── shots ─────────────────────────────────────────────────────────────────
# hook: the payoff (a tanned section, medium tone, UV falling) · section: untanned, UV rains in, push to one living
# cell and into it · dna: the scale jump into its nucleus, two bases fuse · cell: the same cell in a deep tone, pull
# back to the basal row and its pigment cell; the message goes down, melanin fills · pair: two small sections, with
# and without p53 (the mice) · dna2: back to the fused bases ("damage already done") · tan: days pass, melanin climbs
# into caps · field: a wide light-toned field of capped cells, UV mostly stopped · gauge: to scale · close: the hook
t_jump, t_dna2 = A("vo02:In", -0.12), A("vo04:It's", -0.15)
t_field, t_end = A("vo05:Together,", -0.2), A("vo08:Next:", -0.25)
SHOTS = [{"at": 0.0, "name": "hook"}, {"at": B["normal"]["t0"], "name": "section"}, {"at": t_jump, "name": "dna"},
         {"at": B["change"]["t0"], "name": "cell"}, {"at": B["why"]["t0"], "name": "pair"}, {"at": t_dna2, "name": "dna2"},
         {"at": B["whoa"]["t0"], "name": "tan"}, {"at": t_field, "name": "field"}, {"at": B["toscale"]["t0"], "name": "gauge"},
         {"at": B["takeaway"]["t0"], "name": "close"}]
TONE = {k: 0.5 for k in ("hook", "section", "dna", "cell", "pair", "dna2", "tan", "field", "gauge", "close")}   # bible §1 (30 Oct): one melanin level for the whole episode (004: medium)

# ── the tanning clock (whoa): melanin climbs the branches into caps over about three days ──
RATE = 60000.0                           # 3 days in 4.32 s
t_days0 = A("vo05:Over", -0.1)
t_days1 = round(t_days0 + TAN_DAYS * 86400 / RATE, 4)
assert t_days1 < A("vo05:Together,") - 0.2, (t_days1, A("vo05:Together,"))
CLK = {"tan": {"keys": [{"t": t_days0, "rate": RATE}, {"t": t_days1, "rate": 0.0, "badge": None}], "anchor": [t_days0, 0.0]}}

# ── the moments the picture hangs on ───────────────────────────────────────
CUE = {
    "uv": A("vo02:ultraviolet,"), "living": A("vo02:living"), "fuse": A("vo02:fuse"), "dna": A("vo02:DNA."),
    "notices": A("vo03:notices."), "guardian": A("vo03:guardian"), "message": A("vo03:message"), "down": A("vo03:down"),
    "melanin": A("vo03:melanin."), "mice": A("vo04:mice"), "lacked": A("vo04:lacked"), "never": A("vo04:never"),
    "ready": A("vo04:ready"), "answering": A("vo04:answering"),
    "days0": t_days0, "days1": t_days1, "nucleus": A("vo05:nucleus"), "parasol": A("vo05:parasol."),
    "spf": A("vo05:three"), "wide": A("vo06:wide"), "paper": A("vo06:sheet"), "remembers": A("vo07:remembers"),
    "thin": A("vo01:thin"),
}

# ── the camera (the microscope-stage rig: target, dist, el, az, fov, fx, fy) ──
DNA_X = 3000.0
HOOK = {"target": [0, -40, 0], "el": 14, "fov": 30, "fx": 0.5, "fy": 0.36}
HCELL = [0, -40, 30]                      # the followed living cell: scene.mjs snaps it to the nearest cut-face cell
MEL_X = 6.0                               # the pigment cell sits under the followed cell (x in µm)
CAM = {
    "hook": [{"t": 0.0, **HOOK, "dist": 520, "az": -24}, {"t": B["normal"]["t0"], **HOOK, "dist": 380, "az": -10, "ease": "out2"}],   # a push and an arc from frame 0: the hook moves
    "section": [
        {"t": B["normal"]["t0"], "target": [0, -36, 0], "el": 18, "fov": 30, "fx": 0.5, "fy": 0.38, "dist": 560, "az": -14},
        {"t": CUE["living"], "target": [0, -36, 10], "el": 10, "fov": 30, "fx": 0.5, "fy": 0.44, "dist": 300, "az": -8, "ease": "inout2"},
        {"t": t_jump, "target": [0, -40, 26], "el": 6, "fov": 30, "fx": 0.5, "fy": 0.44, "dist": 260, "az": -5, "ease": "in2"},
    ],
    "dna": [
        {"t": t_jump, "target": [DNA_X, 0, 0], "el": 8, "fov": 30, "fx": 0.5, "fy": 0.42, "dist": 330, "az": 18},
        {"t": CUE["fuse"], "target": [DNA_X, 0, 0], "el": 8, "fov": 30, "fx": 0.5, "fy": 0.42, "dist": 210, "az": 14, "ease": "out2"},
        {"t": B["change"]["t0"], "target": [DNA_X, 0, 0], "el": 9, "fov": 30, "fx": 0.5, "fy": 0.42, "dist": 170, "az": 11, "ease": "sine"},
    ],
    "cell": [
        {"t": B["change"]["t0"], "target": [0, -40, 26], "el": 6, "fov": 30, "fx": 0.5, "fy": 0.42, "dist": 270, "az": -4},
        {"t": CUE["notices"] + 0.4, "target": [MEL_X, -58, 10], "el": 9, "fov": 30, "fx": 0.5, "fy": 0.40, "dist": 420, "az": -2, "ease": "inout2"},
        {"t": CUE["message"], "target": [MEL_X - 2, -54, 14], "el": 8, "fov": 30, "fx": 0.5, "fy": 0.40, "dist": 360, "az": 0, "ease": "inout2"},
        {"t": CUE["melanin"], "target": [MEL_X, -70, 16], "el": 9, "fov": 30, "fx": 0.5, "fy": 0.40, "dist": 280, "az": 2, "ease": "inout2"},
        {"t": B["why"]["t0"], "target": [MEL_X, -70, 16], "el": 9, "fov": 30, "fx": 0.5, "fy": 0.40, "dist": 270, "az": 3, "ease": "sine"},
    ],
    "pair": [
        {"t": B["why"]["t0"], "target": [0, -44, 0], "el": 12, "fov": 30, "fx": 0.5, "fy": 0.42, "dist": 720, "az": 0},
        {"t": CUE["lacked"], "target": [24, -50, 0], "el": 11, "fov": 30, "fx": 0.5, "fy": 0.42, "dist": 560, "az": 3, "ease": "inout2"},
        {"t": CUE["never"] + 0.6, "target": [-6, -54, 0], "el": 11, "fov": 30, "fx": 0.5, "fy": 0.42, "dist": 640, "az": 2, "ease": "inout2"},
        {"t": t_dna2, "target": [-18, -58, 8], "el": 10, "fov": 30, "fx": 0.5, "fy": 0.42, "dist": 540, "az": 4, "ease": "inout2"},
    ],
    "dna2": [
        {"t": t_dna2, "target": [DNA_X, 0, 0], "el": 9, "fov": 30, "fx": 0.5, "fy": 0.42, "dist": 230, "az": 12},
        {"t": B["whoa"]["t0"], "target": [DNA_X, 0, 0], "el": 9, "fov": 30, "fx": 0.5, "fy": 0.42, "dist": 150, "az": 8, "ease": "sine"},
    ],
    "tan": [
        {"t": B["whoa"]["t0"], "target": [MEL_X, -62, 12], "el": 9, "fov": 30, "fx": 0.5, "fy": 0.40, "dist": 330, "az": 2},
        {"t": CUE["nucleus"], "target": [MEL_X, -48, 16], "el": 9, "fov": 30, "fx": 0.5, "fy": 0.40, "dist": 310, "az": -2, "ease": "inout2"},
        {"t": t_field, "target": [MEL_X, -46, 18], "el": 9, "fov": 30, "fx": 0.5, "fy": 0.40, "dist": 300, "az": -4, "ease": "sine"},
    ],
    "field": [
        {"t": t_field, "target": [0, -44, 10], "el": 12, "fov": 30, "fx": 0.5, "fy": 0.38, "dist": 330, "az": -10},
        {"t": B["toscale"]["t0"], "target": [0, -40, 0], "el": 15, "fov": 30, "fx": 0.5, "fy": 0.36, "dist": 520, "az": -6, "ease": "out2"},
    ],
    "gauge": [{"t": B["toscale"]["t0"], "target": [0, -30, 0], "el": 10, "fov": 30, "fx": 0.62, "fy": 0.40, "dist": 620, "az": -6},
              {"t": B["takeaway"]["t0"], "target": [0, -30, 0], "el": 10, "fov": 30, "fx": 0.62, "fy": 0.40, "dist": 580, "az": -8, "ease": "sine"}],
    # the close: the hook's pose, reached by the end, so the last frame hands back to frame 0
    "close": [{"t": B["takeaway"]["t0"], **HOOK, "dist": 410, "az": -10},
              {"t": B["tease"]["t1"], **HOOK, "dist": 470, "az": -18, "ease": "sine"}],
}
for shot, keys in CAM.items():           # a microscope stage: slow arcs (≤ 4° a second)
    for a, b in zip(keys, keys[1:]):
        rate = abs(b["az"] - a["az"]) / (b["t"] - a["t"])
        assert rate <= 4.0 + 1e-9, f"{shot}: az turns {rate:.2f}°/s"

# ── the overlay ─────────────────────────────────────────────────────────────
LABELS = [
    {"id": "l-cap-h", "text": "melanin over each nucleus", "kind": "cell", "anchor": "cap", "t0": A("vo01:built"), "t1": B["normal"]["t0"], "shot": "hook", "side": 1},
    {"id": "l-uv", "text": "ultraviolet", "kind": "uv", "anchor": "ray", "t0": CUE["uv"], "t1": CUE["living"] - 0.2, "shot": "section", "side": 1},
    {"id": "l-cell", "text": "a living cell", "kind": "cell", "anchor": "hcell", "t0": CUE["living"], "t1": t_jump, "shot": "section", "side": 1},
    {"id": "l-dimer", "text": "two bases, fused", "kind": "uv", "anchor": "dimer", "t0": CUE["fuse"] + 0.1, "t1": B["change"]["t0"], "shot": "dna", "side": 1},
    {"id": "l-p53", "text": "this cell", "kind": "cell", "anchor": "hcell", "t0": CUE["guardian"], "t1": CUE["message"] - 0.2, "shot": "cell", "side": 1},
    {"id": "l-msh", "text": "down to the pigment cell", "kind": "water", "anchor": "signal", "t0": CUE["message"], "t1": CUE["melanin"] - 0.2, "shot": "cell", "side": 1},
    {"id": "l-mel", "text": "pigment cell", "kind": "cell", "anchor": "melano", "t0": CUE["down"] + 0.3, "t1": B["why"]["t0"], "shot": "cell", "side": -1},
    {"id": "l-with", "text": "with p53", "kind": "layer", "anchor": "pair_l", "t0": CUE["mice"], "t1": t_dna2, "shot": "pair", "side": -1, "v": "above", "fixed": True},
    {"id": "l-without", "text": "without p53", "kind": "layer", "anchor": "pair_r", "t0": CUE["lacked"], "t1": t_dna2, "shot": "pair", "side": 1, "v": "above", "fixed": True},
    {"id": "l-done", "text": "the damage, already done", "kind": "uv", "anchor": "dimer", "t0": CUE["answering"], "t1": B["whoa"]["t0"], "shot": "dna2", "side": 1},
    {"id": "l-cap", "text": "a cap over the nucleus", "kind": "cell", "anchor": "cap", "t0": CUE["nucleus"], "t1": t_field, "shot": "tan", "side": 1},
    {"id": "l-pass", "text": "some UV still gets in", "kind": "uv", "anchor": "pass", "t0": CUE["spf"] - 0.3, "t1": B["toscale"]["t0"], "shot": "field", "side": 1},
]
BADGES = [
    {"id": "b-simp-h", "text": "simplified", "t0": 0.0, "t1": B["normal"]["t0"], "slot": "tr"},
    {"id": "b-simp", "text": "simplified", "t0": B["normal"]["t0"], "t1": t_jump, "slot": "tr"},
    {"id": "b-model", "text": "model · not to scale", "t0": t_jump, "t1": B["change"]["t0"], "slot": "tr"},
    {"id": "b-lab", "text": "measured in lab DNA", "t0": A("vo02:trillionth"), "t1": B["change"]["t0"], "slot": "tl"},
    {"id": "b-simp-c", "text": "simplified", "t0": B["change"]["t0"], "t1": B["why"]["t0"], "slot": "tr"},
    {"id": "b-illus", "text": "illustration", "t0": CUE["message"], "t1": B["why"]["t0"], "slot": "tl"},
    {"id": "b-mice", "text": "in mice · Cui et al., 2007", "t0": CUE["mice"], "t1": t_dna2, "slot": "tl"},
    {"id": "b-illus-p", "text": "illustration", "t0": B["why"]["t0"], "t1": t_dna2, "slot": "tr"},
    {"id": "b-model2", "text": "model · not to scale", "t0": t_dna2, "t1": B["whoa"]["t0"], "slot": "tr"},
    {"id": "b-time", "clock": "tan", "t0": t_days0, "t1": round(t_days1 + 0.4, 4), "slot": "tl"},
    {"id": "b-simp-t", "text": "illustration", "t0": B["whoa"]["t0"], "t1": t_field, "slot": "tr"},
    {"id": "b-est", "text": "estimate", "t0": t_field, "t1": B["toscale"]["t0"], "slot": "tr"},
    {"id": "b-model3", "text": "model", "t0": t_field, "t1": B["toscale"]["t0"], "slot": "tl"},
    {"id": "b-nuc", "text": "estimate", "t0": CUE["wide"], "t1": B["takeaway"]["t0"], "slot": "tr"},
    {"id": "b-simp-z", "text": "simplified", "t0": B["takeaway"]["t0"], "t1": t_end, "slot": "tr"},
]
SPINE = [0.6, 0.215]                     # top right, under the notes: the depth gauge owns the left edge in this episode's wide shots
COUNTERS = [
    {"id": "c-uvb", "label": "the shorter ultraviolet", "fmt": "text", "text": "UVB", "t0": A("vo02:shorter"), "t1": t_jump, "at": SPINE},
    {"id": "c-ps", "label": "to fuse two bases", "fmt": "text", "text": "< 1 ps", "t0": A("vo02:trillionth"), "t1": B["change"]["t0"], "at": SPINE},
    {"id": "c-p53", "label": "the guardian protein", "fmt": "text", "text": "p53", "t0": CUE["guardian"], "t1": A("vo03:chemical", -0.4), "at": SPINE},
    {"id": "c-msh", "label": "the message", "fmt": "text", "text": "α-MSH", "t0": A("vo03:chemical"), "t1": B["why"]["t0"], "at": SPINE},
    {"id": "c-days", "label": "days after the sun", "fmt": "days", "t0": t_days0 + 0.1, "t1": A("vo05:Together,", -0.6), "at": SPINE, "lit": TAN_DAYS},
    {"id": "c-spf", "label": "about, for a whole tan", "fmt": "text", "text": "SPF 3–4", "t0": A("vo05:four.", 0.5), "t1": B["toscale"]["t0"], "at": SPINE},
    {"id": "c-spf2", "label": "a whole tan, about", "fmt": "text", "text": "SPF 3–4", "t0": B["takeaway"]["t0"], "t1": t_end, "at": SPINE},
]
CUTS = [sh["at"] for sh in SHOTS[1:]]
# how each cut is made: an iris on the two scale jumps (into the nucleus and back out to its cell), a short dip to
# the slide colour on the others, so no cut jumps the picture's brightness in one frame
TRANS = [{"t": t_jump, "kind": "iris"}, {"t": B["change"]["t0"], "kind": "iris"}, {"t": B["why"]["t0"], "kind": "dip"},
         {"t": t_dna2, "kind": "dip"}, {"t": B["whoa"]["t0"], "kind": "dip"}, {"t": t_field, "kind": "dip"},
         {"t": B["toscale"]["t0"], "kind": "dip"}, {"t": B["takeaway"]["t0"], "kind": "dip"}]


def before_cut(t1, lead=0.45):           # faded out before the cut, so nothing of one shot sits on the next
    return round(t1 - lead, 4) if any(abs(t1 - c) < 1e-6 for c in CUTS) else t1


for row in BADGES + COUNTERS + LABELS:
    row["t1"] = before_cut(row["t1"])
for a, b in zip(COUNTERS, COUNTERS[1:]):  # two values never share the screen
    if b["t0"] - a["t1"] < 0.4:
        a["t1"] = round(b["t0"] - 0.4, 4)

# the to-scale segment: the gauge lifts to centre; one parasol's ≈ 9 µm fills in, then the paper's 100 µm beside it
GAUGE = {"rise": [B["toscale"]["t0"], B["toscale"]["t0"] + 0.9], "sc": CUE["wide"], "paper": CUE["paper"],
         "back": [B["takeaway"]["t0"] - 0.5, B["takeaway"]["t0"] + 0.4], "sc_um": NUC_UM, "paper_um": PAPER_UM, "bar": "parasol", "stack": [A("vo06:dozen"), A("vo06:paper.", 0.3)], "n": 12}

TITLE = {"series": "Outer Layer · No. 004", "title": "What a *tan* is", "t1": B["normal"]["t0"] - 0.5, "sig": A("vo01:shield?", 0.35)}
END = {"title": "Next layer: who has more pigment cells, the darkest skin or the *lightest*?", "follow": "Outer Layer · No. 005",
       "next": "A tan starts when UV damages DNA: the p53 protein switches on the pigment signal (Cui et al., Cell, 2007)."}

# the tan's state per shot: tan (caps) and fill/travel (the pigment cell), as functions of the cues in scene.mjs
POSTER = A("vo05:parasol.", 0.4)          # the caps over the nuclei, the melanocyte's branches full

# captions: number phrases and fixed phrases stay on one line
glue(f, {"vo02": ["In under a trillionth", "of a second,", "one can fuse", "two letters"], "vo03": ["a guardian protein", "a chemical message"],
         "vo04": ["lacked that guardian", "getting ready for", "the sun."], "vo05": ["the next few days,", "a tiny parasol.", "about SPF three or four."],
         "vo06": ["a dozen stacked", "would be as thick", "as a sheet of paper."],
         "vo08": ["the darkest skin", "the lightest?"]})
for ln in f.lines:                        # the SPF is read as a figure on screen ("SPF 3 or 4"), as the counter shows it
    for w in ln["words"]:
        if w["w"].replace("\u2007", " ") == "about SPF three or four.":
            w["w"] = "about\u2007SPF\u20073\u2007or\u20074."
CAPS = hold(f, keep_units(f.captions(max_chars=24)))

film = {
    "id": ID, "fps": FPS, "bpm": BPM, "dur": f.duration, "poster": POSTER,
    "shots": SHOTS, "beats": BEATS, "tone": TONE,
    "bio": {"sc_um": SC_UM, "rows": ROWS, "gran_um": GRAN_UM, "spin_um": SPIN_UM, "basal_um": BASAL_UM, "paper_um": PAPER_UM,
            "nuc_um": NUC_UM, "pass": PASS, "mel_x": MEL_X, "hcell": HCELL, "dna_x": DNA_X},
    "clk": CLK, "cam": CAM, "cue": CUE, "gauge": GAUGE, "trans": TRANS,
    "labels": LABELS, "badges": BADGES, "counters": COUNTERS, "pills": [],
    "title": TITLE, "endCard": t_end, "end": END,
    "captions": CAPS,
    "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines],
}

# ── the studio's cue sheet ─────────────────────────────────────────────────
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
        ev.append({"t": b["t0"], "kind": "badge", "tag": b["id"]})   # silent (the preset maps no badge sound)
for d in (1, 2, 3):                                                  # the day counter ticks each day
    ev.append({"t": round(t_days0 + d * 86400 / RATE, 4), "kind": "counter.tick", "tag": f"c-days-{d}"})
ev += [
    {"t": CUE["fuse"], "kind": "zap", "tag": "fuse"},
    {"t": t_jump, "kind": "scale.jump", "tag": "dive"},
    {"t": B["change"]["t0"], "kind": "scale.jump", "tag": "out"},
    {"t": CUE["message"], "kind": "diffuse", "tag": "message"},
    {"t": CUE["melanin"], "kind": "reveal", "tag": "melanin"},
    {"t": t_dna2, "kind": "cell.land", "tag": "done"},
    {"t": B["whoa"]["t0"], "kind": "swell", "tag": "whoa", "t1": B["whoa"]["t1"]},
    {"t": GAUGE["sc"], "kind": "scale", "tag": "g-nuc"},
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
print(f"  shots " + " · ".join(f"{s['name']} {s['at']:.2f}" for s in SHOTS))
print(f"  days {t_days0:.2f}–{t_days1:.2f} s (×{RATE:,.0f})")
print(f"sheet.json: {len(sheet['events'])} events" + (f", {len(shown)} shown times from the picture" if shown else ""))
for pg in CAPS:
    print(f"  {pg['t0']:6.2f}–{pg['t1']:6.2f}  " + " / ".join(" ".join(w for w, _ in r).replace(" ", " ") for r in pg["lines"]))
