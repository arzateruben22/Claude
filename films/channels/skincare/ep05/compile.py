"""Compile Outer Layer No. 005, "Same cells, every colour": script + voice timings + this direction → film.json (the
scene's clock: shots, camera keys, labels, badges, counters, captions, title and end card) and sheet.json (the
studio's cue sheet). Nothing here is a hand-typed time: every moment hangs on a beat or a spoken word
(kits/cinema/script/timeline.py anchors), and every number on screen comes from claims.json.

  python3 -I films/channels/skincare/ep05/compile.py

If build/cues-outerlayer-005-9x16.json exists (render.mjs --cues), each label and counter also gets the picture's
own screen position (pan) and its measured first frame ("shown", the studio's independent sync check).

Units in the scene: 1 unit = 1 µm. The sections' top surface is y = 0; depth is −y. The grains (x = −4000) and the
globe (x = 5000) are their own places, never in a frame with the sections.
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
ID = "outerlayer-005"
f = Film(HERE / "script.md", HERE / "vo", fps=FPS, bpm=BPM)
plan, end_hold = f.script_plan()
BEATS = f.layout(plan, end_hold=end_hold)
A = f.at
B = {b["id"]: b for b in BEATS}

# ── the biology (claims.json) ───────────────────────────────────────────────
PER_MM2 = 955.0         # c11: ≈ 955 melanocytes per mm² (meta-analysis mean across sites)
GAP_UM = round((1e6 / PER_MM2) ** 0.5)   # computed: ≈ 32 µm apart on a square grid
PAPER_UM = 100.0        # c12: 80 gsm copy paper ≈ 100 µm
UNIT = 36               # c2: one melanocyte supplies about 36 keratinocytes
SC_UM, ROWS, GRAN_UM, SPIN_UM, BASAL_UM = 17.0, 15, 10.0, 48.0, 10.0    # the section as No. 001 draws it
assert GAP_UM == 32 and 0.28 < GAP_UM / PAPER_UM < 0.36, "about a third"
TONES = [0.12, 0.5, 0.9]                # light, medium, deep: side by side the whole film
SEC_X = [-56.0, 0.0, 56.0]              # the three sections' centres (each 50 µm wide)

# ── shots ─────────────────────────────────────────────────────────────────
# trio: the payoff, three sections side by side, then (no cut) the push down to their basal rows and the count ·
# grains: an iris into one pigment cell opens on one cell per tone, up close · globe: an iris out to skin colour beside
# UV · skies: an iris from the globe's band back to the three sections, each under its own sky · gauge: to scale
# (the same place, the camera keeps moving) · close: back to the hook's composition. Only three cuts, all scale jumps.
t_end = A("vo08:Next:", -0.25)
SHOTS = [{"at": 0.0, "name": "trio"}, {"at": B["change"]["t0"], "name": "grains"}, {"at": B["why"]["t0"], "name": "globe"},
         {"at": B["whoa"]["t0"], "name": "skies"}, {"at": B["toscale"]["t0"], "name": "gauge"}, {"at": B["takeaway"]["t0"], "name": "close"}]

CUE = {
    "pigment": A("vo01:pigment"), "guess": A("vo02:guess"), "darkest": A("vo02:darkest."), "feeds": A("vo02:feeds"),
    "dozen": A("vo02:dozen"), "count": A("vo02:Across"), "same": A("vo02:same."), "work": A("vo03:work"), "deeper": A("vo03:deeper"),
    "larger": A("vo03:larger"), "one": A("vo03:one#2"), "why": A("vo04:why"), "nina": A("vo04:Nina"),
    "colour": A("vo04:colour"), "sunlight": A("vo04:sunlight,"), "matched": A("vo04:matched."),
    "idea": A("vo05:idea:"), "fierce": A("vo05:fierce"), "folate": A("vo05:folate."), "weak": A("vo05:weak"), "vitd": A("vo05:vitamin#2"),
    "apart": A("vo06:apart."), "third": A("vo06:third"), "paper": A("vo06:paper's"), "none": A("vo07:None"), "sky": A("vo07:sky."),
}

# ── the camera (the microscope-stage rig: target, dist, el, az, fov, fx, fy) ──
GX, WX = -4000.0, 5000.0
HOOK = {"target": [0, -44, 0], "el": 13, "fov": 30, "fx": 0.5, "fy": 0.38}
WIDE = {"target": [0, -44, 0], "el": 12, "fov": 30, "fx": 0.5, "fy": 0.36}
CAM = {
    "trio": [
        {"t": 0.0, **HOOK, "dist": 680, "az": -10},
        {"t": B["normal"]["t0"], **HOOK, "dist": 620, "az": -7, "ease": "sine"},
        {"t": CUE["feeds"], "target": [0, -66, 12], "el": 9, "fov": 30, "fx": 0.5, "fy": 0.40, "dist": 560, "az": -5, "ease": "inout2"},
        {"t": CUE["count"], "target": [0, -76, 14], "el": 7, "fov": 30, "fx": 0.5, "fy": 0.40, "dist": 520, "az": -2, "ease": "inout2"},
        {"t": B["change"]["t0"], "target": [-16, -78, 20], "el": 6, "fov": 30, "fx": 0.5, "fy": 0.42, "dist": 300, "az": 0, "ease": "in2"},
    ],
    "grains": [
        {"t": B["change"]["t0"], "target": [GX, 0, 0], "el": 6, "fov": 30, "fx": 0.5, "fy": 0.40, "dist": 560, "az": -4},
        {"t": CUE["deeper"], "target": [GX + 10, 0, 0], "el": 6, "fov": 30, "fx": 0.5, "fy": 0.40, "dist": 520, "az": -2, "ease": "inout2"},
        {"t": CUE["larger"], "target": [GX + 40, 0, 0], "el": 6, "fov": 30, "fx": 0.5, "fy": 0.40, "dist": 260, "az": -1, "ease": "inout2"},
        {"t": B["why"]["t0"], "target": [GX + 44, 0, 0], "el": 6, "fov": 30, "fx": 0.5, "fy": 0.40, "dist": 240, "az": 0, "ease": "sine"},
    ],
    "globe": [{"t": B["why"]["t0"], "target": [WX, 0, 0], "el": 8, "fov": 30, "fx": 0.5, "fy": 0.40, "dist": 560, "az": 0},
              {"t": CUE["matched"], "target": [WX, 0, 0], "el": 8, "fov": 30, "fx": 0.5, "fy": 0.40, "dist": 470, "az": 0, "ease": "inout2"},
              {"t": B["whoa"]["t0"], "target": [WX + 30, -5, 0], "el": 8, "fov": 30, "fx": 0.5, "fy": 0.40, "dist": 380, "az": 0, "ease": "in2"}],
    "skies": [{"t": B["whoa"]["t0"], **WIDE, "dist": 700, "az": -6},
              {"t": CUE["weak"], **WIDE, "dist": 660, "az": 2, "ease": "inout2"},
              {"t": B["toscale"]["t0"], **WIDE, "dist": 640, "az": 6, "ease": "sine"}],
    # to scale: the cards lift into the empty upper left; the camera drops the sections lower in frame
    "gauge": [{"t": B["toscale"]["t0"], **WIDE, "dist": 640, "az": 6},
              {"t": B["toscale"]["t0"] + 1.2, "target": [0, -56, 0], "el": 10, "fov": 30, "fx": 0.72, "fy": 0.34, "dist": 1000, "az": 3, "ease": "inout2"},
              {"t": B["takeaway"]["t0"], "target": [0, -56, 0], "el": 10, "fov": 30, "fx": 0.72, "fy": 0.34, "dist": 980, "az": 0, "ease": "sine"}],
    "close": [{"t": B["takeaway"]["t0"], "target": [0, -56, 0], "el": 10, "fov": 30, "fx": 0.72, "fy": 0.34, "dist": 980, "az": 0},
              {"t": B["takeaway"]["t0"] + 1.6, **HOOK, "dist": 640, "az": -6, "ease": "inout2"},
              {"t": B["tease"]["t1"], **HOOK, "dist": 680, "az": -10, "ease": "sine"}],
}
for shot, keys in CAM.items():           # a microscope stage: slow arcs (≤ 4° a second)
    for a, b in zip(keys, keys[1:]):
        rate = abs(b["az"] - a["az"]) / (b["t"] - a["t"])
        assert rate <= 4.0 + 1e-9, f"{shot}: az turns {rate:.2f}°/s"

# ── the overlay ─────────────────────────────────────────────────────────────
COUNT_T = [round(CUE["count"] + 0.45 * k, 4) for k in range(2)]   # the two pigment cells per section light in turn
LABELS = [
    {"id": "l-pig-h", "text": "pigment cells", "kind": "cell", "anchor": "mel1", "t0": CUE["pigment"] + 0.2, "t1": CUE["feeds"], "shot": "trio", "side": 1},
    {"id": "l-g-light", "text": "small, in clusters", "kind": "cell", "anchor": "g0", "t0": CUE["work"] + 0.3, "t1": CUE["larger"] - 0.6, "shot": "grains", "side": -1, "v": "above", "fixed": True},
    {"id": "l-g-deep", "text": "larger, one by one", "kind": "cell", "anchor": "g2", "t0": CUE["larger"], "t1": B["why"]["t0"], "shot": "grains", "side": 1, "v": "above", "fixed": True},
    {"id": "l-uv", "text": "ultraviolet, strongest here", "kind": "uv", "anchor": "band", "t0": CUE["sunlight"], "t1": B["whoa"]["t0"], "shot": "globe", "side": 1},
    {"id": "l-folate", "text": "folate, kept safe", "kind": "cell", "anchor": "folate", "t0": CUE["folate"] - 0.4, "t1": B["toscale"]["t0"], "shot": "skies", "side": 1},
    {"id": "l-vitd", "text": "vitamin D made", "kind": "cell", "anchor": "vitd", "t0": CUE["vitd"], "t1": B["toscale"]["t0"], "shot": "skies", "side": -1},
]
BADGES = [
    {"id": "b-simp-h", "text": "simplified", "t0": 0.0, "t1": B["change"]["t0"], "slot": "tr"},
    {"id": "b-site", "text": "same body site", "t0": CUE["count"], "t1": B["change"]["t0"], "slot": "tl"},
    {"id": "b-illus", "text": "illustration", "t0": B["change"]["t0"], "t1": B["why"]["t0"], "slot": "tr"},
    {"id": "b-thong", "text": "Thong et al., 2003", "t0": CUE["larger"], "t1": B["why"]["t0"], "slot": "tl"},
    {"id": "b-model", "text": "model", "t0": B["why"]["t0"], "t1": B["whoa"]["t0"], "slot": "tr"},
    {"id": "b-jc", "text": "Jablonski & Chaplin, 2000", "t0": CUE["colour"], "t1": B["toscale"]["t0"], "slot": "tl"},
    {"id": "b-hyp", "text": "hypothesis", "t0": B["whoa"]["t0"], "t1": B["toscale"]["t0"], "slot": "tr"},
    {"id": "b-est", "text": "estimate", "t0": CUE["third"], "t1": B["takeaway"]["t0"], "slot": "tr"},
    {"id": "b-simp-z", "text": "simplified", "t0": B["takeaway"]["t0"], "t1": t_end, "slot": "tr"},
]
SPINE = [0.6, 0.215]                      # top right, under the notes: the depth gauge owns the left edge
COUNTERS = [
    {"id": "c-unit", "label": "pigment cell : skin cells", "fmt": "text", "text": "≈ 1 : 36", "t0": CUE["dozen"], "t1": CUE["count"] - 0.4, "at": SPINE},
    {"id": "c-same", "label": "per mm², average", "fmt": "text", "text": "≈ 955", "t0": CUE["same"] - 0.3, "t1": B["change"]["t0"], "at": SPINE},
    {"id": "c-uv", "label": "skin colour follows", "fmt": "text", "text": "UV", "t0": CUE["matched"] - 0.4, "t1": B["toscale"]["t0"], "at": SPINE},
    {"id": "c-end", "label": "per mm², average", "fmt": "text", "text": "≈ 955", "t0": B["takeaway"]["t0"] + 1.2, "t1": t_end, "at": SPINE},
]
CUTS = [sh["at"] for sh in SHOTS[1:]]
# the three scale jumps are irises (into a pigment cell; out of the grains to the globe; from the globe's band back to
# the sections); the gauge and close shots are the same place, reached by camera moves, not cuts
TRANS = [{"t": B["change"]["t0"], "kind": "iris", "from": "mel1", "to": "g1"}, {"t": B["why"]["t0"], "kind": "iris", "from": "g1", "to": "globe"},
         {"t": B["whoa"]["t0"], "kind": "iris", "from": "band", "to": "mid"}]


def before_cut(t1, lead=0.45):           # faded out before the cut, so nothing of one shot sits on the next
    return round(t1 - lead, 4) if any(abs(t1 - c) < 1e-6 for c in CUTS[:3]) else t1


for row in BADGES + COUNTERS + LABELS:
    row["t1"] = before_cut(row["t1"])
for a, b in zip(COUNTERS, COUNTERS[1:]):  # two values never share the screen
    if b["t0"] - a["t1"] < 0.4:
        a["t1"] = round(b["t0"] - 0.4, 4)

# to scale: the gauge lifts; a bracket spans the two lit pigment cells in the middle section (drawn 32 µm apart, the
# claim's spacing), then the gap's bar fills beside the paper's
GAUGE = {"rise": [B["toscale"]["t0"] + 0.4, B["toscale"]["t0"] + 1.3], "sc": CUE["third"], "paper": CUE["paper"],
         "bracket": [CUE["third"] - 1.2, CUE["third"]], "back": [B["takeaway"]["t0"] - 0.5, B["takeaway"]["t0"] + 0.4],
         "sc_um": GAP_UM, "paper_um": PAPER_UM, "bar": "gap"}

TITLE = {"series": "Outer Layer · No. 005", "title": "Same cells, every *colour*", "t1": B["normal"]["t0"] - 0.5, "sig": A("vo01:cells?", 0.35)}
END = {"title": "Next layer: why do we still get goosebumps, with almost no *fur*?", "follow": "Outer Layer · No. 006",
       "next": "Same body site, every skin colour: about the same number of pigment cells (≈ 955 per mm², averaged across sites; JAAD meta-analysis, 2017). Narration: synthetic voice (AI)."}
POSTER = A("vo07:sky.", 0.3)

glue(f, {"vo01": ["pigment cells?", "row by row."], "vo02": ["the darkest.", "a few dozen neighbours.", "about the same."], "vo03": ["the dark melanin,", "one by one."],
         "vo04": ["Nina Jablonski", "George Chaplin", "set skin colour", "all around the world,"], "vo05": ["a vitamin called folate.", "less of it", "vitamin D."], "vo06": ["a third of a", "paper's thickness apart."],
         "vo07": ["every colour,", "its own sky."]})
CAPS = hold(f, keep_units(f.captions(max_chars=24)))

film = {
    "id": ID, "fps": FPS, "bpm": BPM, "dur": f.duration, "poster": POSTER,
    "shots": SHOTS, "beats": BEATS, "tones": TONES, "trans": TRANS,
    "bio": {"sc_um": SC_UM, "rows": ROWS, "gran_um": GRAN_UM, "spin_um": SPIN_UM, "basal_um": BASAL_UM, "paper_um": PAPER_UM,
            "gap_um": GAP_UM, "unit": UNIT, "sec_x": SEC_X, "gx": GX, "wx": WX},
    "cam": CAM, "cue": CUE, "gauge": GAUGE,
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
        ev.append({"t": b["t0"], "kind": "badge", "tag": b["id"]})
for k, tk in enumerate(COUNT_T):
    ev.append({"t": tk, "kind": "counter.tick", "tag": f"count-{k + 1}"})
ev += [
    {"t": CUE["feeds"], "kind": "diffuse", "tag": "feeds"},
    {"t": CUE["larger"], "kind": "reveal", "tag": "grains"},
    {"t": B["change"]["t0"], "kind": "scale.jump", "tag": "into-cells"},
    {"t": B["why"]["t0"], "kind": "scale.jump", "tag": "out-to-world"},
    {"t": B["whoa"]["t0"], "kind": "scale.jump", "tag": "back-to-skin"},
    {"t": CUE["matched"], "kind": "cell.land", "tag": "matched"},
    {"t": B["whoa"]["t0"], "kind": "swell", "tag": "whoa", "t1": B["whoa"]["t1"]},
    {"t": CUE["vitd"], "kind": "diffuse", "tag": "vitd"},
    {"t": CUE["folate"], "kind": "diffuse", "tag": "folate"},
    {"t": GAUGE["sc"], "kind": "scale", "tag": "g-gap"},
    {"t": GAUGE["paper"], "kind": "reveal", "tag": "g-paper"},
]
film["cue"]["count_t"] = COUNT_T
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
