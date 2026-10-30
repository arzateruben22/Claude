"""Compile Outer Layer No. 001, "The dead layer": script + voice timings + this direction → film.json (the
scene's clock: shots, the cell's climb, camera keys, labels, badges, counters, captions, title and end card) and
sheet.json (the studio's cue sheet). Nothing here is a hand-typed time: every moment hangs on a beat or a spoken
word (kits/cinema/script/timeline.py anchors), and every number on screen comes from claims.json.

  python3 -I films/channels/skincare/ep01/compile.py

If build/cues-outerlayer-001-9x16.json exists (render.mjs --cues), each label and counter also gets the picture's
own screen position (pan) and its measured first frame ("shown", the studio's independent sync check).

Units in the scene: 1 unit = 1 µm. The section's top surface is y = 0; depth is −y.
"""
import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[3] / "kits/cinema/script"))
from timeline import Film   # noqa: E402
sys.path.insert(0, str(HERE.parent / "set"))
from capglue import glue, hold, keep_units    # noqa: E402

FPS, BPM = 30, 64.2857                   # bible §3: F major at 64.2857 BPM (a 16th = 7 frames)
ID = "outerlayer-001"
f = Film(HERE / "script.md", HERE / "vo", fps=FPS, bpm=BPM)
plan, end_hold = f.script_plan()
BEATS = f.layout(plan, end_hold=end_hold)
A = f.at
B = {b["id"]: b for b in BEATS}

# ── the biology (claims.json) ───────────────────────────────────────────────
SC_UM = 17.0            # c12: cheek stratum corneum ≈ 16.8 µm (Egawa 2007), shown as 17
ROWS = 15               # c2: about 15 layers of corneocytes
PAPER_UM = 100.0        # c13: 80 gsm copy paper ≈ 100 µm
CLIMB_DAYS = 14.0       # c6: about two weeks, basal layer → stratum corneum
LOSS_X = 32.0 / 6.0     # c11 (computed): ≈ 32 g/m²/h under 30 weeks vs ≈ 6 near term → ≈ 5.3, said "about five times"
GRAN_UM, SPIN_UM, BASAL_UM = 10.0, 48.0, 10.0   # drawn thicknesses of the living layers (simplified, badged); epidermis ≈ 85 µm here
assert 4.8 < LOSS_X < 5.8

# ── shots ─────────────────────────────────────────────────────────────────
# hook: the payoff, the section in a light tone, its dead top rows lit · section: one continuous dive (normal,
# change, why) in a deep tone · walls: two sections side by side (whoa) in a medium tone · gauge: the to-scale
# beat over the dimmed section · close: back to the hook's composition (takeaway, tease, end card: the loop)
t_end = A("vo08:Next", -0.25)
SHOTS = [{"at": 0.0, "name": "hook"}, {"at": B["normal"]["t0"], "name": "section"}, {"at": B["whoa"]["t0"], "name": "walls"},
         {"at": B["toscale"]["t0"], "name": "gauge"}, {"at": B["takeaway"]["t0"], "name": "close"}]
TONE = {"hook": 0.15, "section": 0.85, "walls": 0.5, "gauge": 0.85, "close": 0.15}   # melanin 0–1 (bible §1: three tones)

# ── the cell's climb (change): born at the base, rises for about two weeks, takes itself apart near the top ──
t_born = A("vo03:began")
RATE = 300000.0                         # the climb runs 300,000× faster: 14 days in 4.03 s
t_rise0 = A("vo03:rose", -0.6)
t_rise1 = round(t_rise0 + CLIMB_DAYS * 86400 / RATE, 4)
t_apart0, t_apart1 = A("vo03:apart,", -0.2), A("vo03:purpose.", 0.5)
assert 2.5 < t_rise1 - t_rise0 < 6.0, (t_rise0, t_rise1)
CLK = {"climb": {"keys": [{"t": t_rise0, "rate": RATE}, {"t": t_rise1, "rate": 0.0, "badge": None}], "anchor": [t_rise0, 0.0]}}

# ── the camera (an orbit rig on the slide, as space's telescope mount: target, dist, el, az, fov, fx, fy) ──
Y_BASAL = -(SC_UM + GRAN_UM + SPIN_UM + BASAL_UM / 2)
HOOK = {"target": [0, -14, 0], "el": 26, "fov": 30, "fx": 0.5, "fy": 0.44}
CAM = {
    "hook": [{"t": 0.0, **HOOK, "dist": 780, "az": -26}, {"t": B["normal"]["t0"], **HOOK, "dist": 720, "az": -22, "ease": "sine"}],
    "section": [
        {"t": B["normal"]["t0"], "target": [0, -10, 0], "el": 14, "fov": 30, "fx": 0.5, "fy": 0.42, "dist": 540, "az": -14},
        {"t": A("vo02:empty"), "target": [0, -9, 0], "el": 10, "fov": 30, "fx": 0.5, "fy": 0.42, "dist": 300, "az": -9, "ease": "inout2"},
        {"t": A("vo02:living"), "target": [0, -30, 0], "el": 9, "fov": 30, "fx": 0.5, "fy": 0.40, "dist": 440, "az": -7, "ease": "inout2"},
        # the climb: the camera rides up with the cell (its target follows the cell's height, see scene.mjs)
        {"t": t_born, "target": [0, Y_BASAL, 0], "el": 6, "fov": 30, "fx": 0.5, "fy": 0.44, "dist": 280, "az": -4, "ease": "inout2"},
        {"t": t_rise1, "target": [0, -SC_UM - 4, 0], "el": 7, "fov": 30, "fx": 0.5, "fy": 0.44, "dist": 260, "az": -2, "ease": "inout2"},
        {"t": t_apart1, "target": [0, -10, 0], "el": 8, "fov": 30, "fx": 0.5, "fy": 0.44, "dist": 300, "az": -1, "ease": "sine"},
        # why: pull back until the wall and the water under it fill the frame
        {"t": A("vo04:But"), "target": [0, -26, 0], "el": 10, "fov": 30, "fx": 0.5, "fy": 0.42, "dist": 540, "az": 0, "ease": "inout2"},
        {"t": B["whoa"]["t0"], "target": [0, -26, 0], "el": 11, "fov": 30, "fx": 0.5, "fy": 0.42, "dist": 580, "az": 2, "ease": "sine"},
    ],
    "walls": [{"t": B["whoa"]["t0"], "target": [0, -16, 0], "el": 12, "fov": 30, "fx": 0.5, "fy": 0.40, "dist": 500, "az": 0},
              {"t": B["toscale"]["t0"], "target": [0, -18, 0], "el": 13, "fov": 30, "fx": 0.5, "fy": 0.43, "dist": 780, "az": 2, "ease": "sine"}],
    "gauge": [{"t": B["toscale"]["t0"], "target": [0, -30, 0], "el": 10, "fov": 30, "fx": 0.62, "fy": 0.40, "dist": 620, "az": -6},
              {"t": B["takeaway"]["t0"], "target": [0, -30, 0], "el": 10, "fov": 30, "fx": 0.62, "fy": 0.40, "dist": 580, "az": -8, "ease": "sine"}],
    # the close: the hook's pose, reached by the end, so the last frame hands back to frame 0
    "close": [{"t": B["takeaway"]["t0"], **HOOK, "dist": 700, "az": -18},
              {"t": B["tease"]["t1"], **HOOK, "dist": 780, "az": -26, "ease": "sine"}],
}
for shot, keys in CAM.items():           # a microscope stage: slow arcs (≤ 4° a second) and drifts
    for a, b in zip(keys, keys[1:]):
        rate = abs(b["az"] - a["az"]) / (b["t"] - a["t"])
        assert rate <= 4.0 + 1e-9, f"{shot}: az turns {rate:.2f}°/s"

# ── the overlay ─────────────────────────────────────────────────────────────
LABELS = [
    {"id": "l-dead-h", "text": "dead layer", "kind": "layer", "anchor": "sc_top", "t0": A("vo01:not", -0.1), "t1": B["normal"]["t0"], "shot": "hook", "side": 1},
    {"id": "l-sc", "text": "stratum corneum", "kind": "layer", "anchor": "sc_mid", "t0": A("vo02:surface"), "t1": A("vo02:each", -0.2), "shot": "section", "side": 1},
    {"id": "l-corneo", "text": "one dead cell", "kind": "cell", "anchor": "corneo", "t0": A("vo02:each"), "t1": A("vo02:living", -0.3), "shot": "section", "side": 1},
    {"id": "l-living", "text": "living layers", "kind": "layer", "anchor": "living", "t0": A("vo02:living"), "t1": B["change"]["t0"], "shot": "section", "side": 1},
    {"id": "l-cell", "text": "a new cell", "kind": "cell", "anchor": "climber", "t0": t_born, "t1": t_rise1, "shot": "section", "side": 1, "fixed": True},
    {"id": "l-brick", "text": "bricks: dead cells", "kind": "cell", "anchor": "brick", "t0": A("vo04:brick"), "t1": B["whoa"]["t0"], "shot": "section", "side": 1},
    {"id": "l-mortar", "text": "mortar: fats", "kind": "water", "anchor": "mortar", "t0": A("vo04:fats,"), "t1": B["whoa"]["t0"], "shot": "section", "side": 1},
    {"id": "l-term", "text": "near term", "kind": "layer", "anchor": "wall_l", "t0": A("vo05:finished", -0.3), "t1": B["toscale"]["t0"], "shot": "walls", "side": -1, "v": "above", "fixed": True},
    {"id": "l-early", "text": "before 30 weeks", "kind": "layer", "anchor": "wall_r", "t0": A("vo05:Babies"), "t1": B["toscale"]["t0"], "shot": "walls", "side": 1, "v": "above", "fixed": True},
    {"id": "l-water", "text": "water", "kind": "water", "anchor": "beads", "t0": A("vo05:Babies", 0.6), "t1": B["toscale"]["t0"], "shot": "walls", "side": 1},
]
BADGES = [
    {"id": "b-simp-h", "text": "simplified", "t0": 0.0, "t1": B["normal"]["t0"], "slot": "tr"},
    {"id": "b-simp", "text": "simplified", "t0": B["normal"]["t0"], "t1": B["whoa"]["t0"], "slot": "tr"},
    {"id": "b-time", "clock": "climb", "t0": t_rise0, "t1": round(t_rise1 + 0.4, 4), "slot": "tl"},
    {"id": "b-model", "text": "model", "t0": A("vo04:But"), "t1": B["whoa"]["t0"], "slot": "tl"},
    {"id": "b-illus", "text": "illustration", "t0": B["whoa"]["t0"], "t1": B["toscale"]["t0"], "slot": "tr"},
    {"id": "b-1979", "text": "Rutter & Hull, 1979", "t0": A("vo05:doctors"), "t1": B["toscale"]["t0"], "slot": "tl"},
    {"id": "b-cheek", "text": "cheek; varies by site", "t0": A("vo06:cheek,"), "t1": B["takeaway"]["t0"], "slot": "tr"},
    {"id": "b-simp-c", "text": "simplified", "t0": B["takeaway"]["t0"], "t1": t_end, "slot": "tr"},
]
SPINE = [0.30, 0.215]                     # top left, under the notes, clear of the section and the captions
COUNTERS = [
    {"id": "c-rows", "label": "rows of dead cells", "fmt": "text", "text": "≈15", "t0": A("vo02:dozen"), "t1": A("vo03:began", -0.4), "at": SPINE},
    {"id": "c-days", "label": "days climbing", "fmt": "days", "t0": A("vo03:began", 0.2), "t1": A("vo03:apart,", -0.3), "at": SPINE, "lit": CLIMB_DAYS},
    {"id": "c-dead", "label": "then it dies", "fmt": "text", "text": "day 14", "t0": A("vo03:apart,"), "t1": A("vo04:But", -0.4), "at": SPINE},
    {"id": "c-wall", "label": "rows in the wall", "fmt": "text", "text": "≈15", "t0": A("vo04:But"), "t1": B["whoa"]["t0"], "at": SPINE},
    {"id": "c-loss", "label": "water lost, under 30 weeks", "fmt": "text", "text": "≈5×", "t0": A("vo05:five"), "t1": B["toscale"]["t0"], "at": SPINE},
    {"id": "c-sc", "label": "dead layer · cheek", "fmt": "text", "text": "17 µm", "t0": A("vo06:thinner"), "t1": t_end, "at": SPINE},
]
CUTS = [sh["at"] for sh in SHOTS[1:]]


def before_cut(t1, lead=0.45):           # faded out before the cut, so nothing of one shot sits on the next
    return round(t1 - lead, 4) if any(abs(t1 - c) < 1e-6 for c in CUTS) else t1


for row in BADGES + COUNTERS + LABELS:
    row["t1"] = before_cut(row["t1"])
for a, b in zip(COUNTERS, COUNTERS[1:]):  # two values never share the screen
    if b["t0"] - a["t1"] < 0.4:
        a["t1"] = round(b["t0"] - 0.4, 4)

# the to-scale segment: the gauge lifts to centre; the dead layer's 17 µm fills in, then the paper's 100 µm beside it
GAUGE = {"rise": [B["toscale"]["t0"], B["toscale"]["t0"] + 0.9], "sc": A("vo06:thinner"), "paper": A("vo06:sheet"),
         "back": [B["takeaway"]["t0"] - 0.5, B["takeaway"]["t0"] + 0.4], "sc_um": SC_UM, "paper_um": PAPER_UM}

TITLE = {"series": "Outer Layer · No. 001", "title": "The *dead layer*", "t1": B["normal"]["t0"] - 0.5, "sig": A("vo01:alive?", 0.35)}
END = {"title": "Next layer: does SPF 100 block twice as much as *50*?", "follow": "Outer Layer · No. 002",
       "next": "Your outermost layer is about 15 rows of dead cells, about 17 µm on the cheek (StatPearls; Egawa et al. 2007)."}

CUE = {"born": t_born, "rise": [t_rise0, t_rise1], "apart": [t_apart0, t_apart1], "lipid": A("vo04:fats,"), "bricks": A("vo04:brick"),
       "water": A("vo04:water"), "inside": A("vo04:inside."), "early": A("vo05:Babies"), "loss": A("vo05:losing"), "five": A("vo05:five"),
       "dead_lit": A("vo01:not"), "rows": A("vo02:dozen"), "dead": A("vo02:empty"), "living": A("vo02:living"), "died": A("vo07:died")}
POSTER = A("vo04:fats,", 0.6)           # the wall, its mortar lit

# captions: number phrases and fixed phrases stay on one line
glue(f, {"vo02": ["the surface", "flattened cells,", "a dozen deep,"], "vo03": ["about two weeks,", "it took itself apart,", "on purpose."], "vo04": ["a kind of brick wall,"], "vo07": ["a layer"],
         "vo05": ["five times as fast."], "vo06": ["a fifth", "of a sheet of paper."],
         "vo08": ["SPF one hundred", "as fifty?"]})
CAPS = hold(f, keep_units(f.captions(max_chars=24)))

film = {
    "id": ID, "fps": FPS, "bpm": BPM, "dur": f.duration, "poster": POSTER,
    "shots": SHOTS, "beats": BEATS, "tone": TONE,
    "bio": {"sc_um": SC_UM, "rows": ROWS, "gran_um": GRAN_UM, "spin_um": SPIN_UM, "basal_um": BASAL_UM, "paper_um": PAPER_UM, "loss_x": LOSS_X},
    "clk": CLK, "cam": CAM, "cue": CUE, "gauge": GAUGE,
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
for d in range(2, 15, 2):                                            # the day counter ticks every two days
    ev.append({"t": round(t_rise0 + d * 86400 / RATE, 4), "kind": "counter.tick", "tag": f"c-days-{d}"})
ev += [
    {"t": t_rise1, "kind": "cell.land", "tag": "top"},
    {"t": t_apart0, "kind": "dissolve", "tag": "cornify", "t1": t_apart1},
    {"t": A("vo04:water"), "kind": "diffuse", "tag": "water-in"},
    {"t": A("vo05:losing"), "kind": "diffuse", "tag": "water-out"},
    {"t": B["whoa"]["t0"], "kind": "swell", "tag": "whoa", "t1": B["whoa"]["t1"]},
    {"t": GAUGE["sc"], "kind": "scale", "tag": "g-sc"},
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
print(f"  climb {t_rise0:.2f}–{t_rise1:.2f} s (×{RATE:,.0f}), apart {t_apart0:.2f}–{t_apart1:.2f}; loss ×{LOSS_X:.2f}")
print(f"sheet.json: {len(sheet['events'])} events" + (f", {len(shown)} shown times from the picture" if shown else ""))
for pg in CAPS:
    print(f"  {pg['t0']:6.2f}–{pg['t1']:6.2f}  " + " / ".join(" ".join(w for w, _ in r).replace(" ", " ") for r in pg["lines"]))
