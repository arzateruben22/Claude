"""Compile Outer Layer No. 006, "Goosebumps": script + voice timings + this direction → film.json (the
scene's clock: shots, camera keys, labels, badges, counters, captions, title and end card) and sheet.json (the
studio's cue sheet). Nothing here is a hand-typed time: every moment hangs on a beat or a spoken word
(kits/cinema/script/timeline.py anchors), and every number on screen comes from claims.json.

  python3 -I films/channels/skincare/ep06/compile.py

If build/cues-outerlayer-006-9x16.json exists (render.mjs --cues), each label and counter also gets the picture's
own screen position (pan) and its measured first frame ("shown", the studio's independent sync check).

Units in the scene: 1 unit = 1 µm. The skin's surface is y = 0; depth is −y. The patch of skin (x = 0, about 3 mm
across), the follicle cut open (x = 6000) and the furred coat (x = −6000) are separate places, never in one frame.
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
ID = "outerlayer-006"
f = Film(HERE / "script.md", HERE / "vo", fps=FPS, bpm=BPM)
plan, end_hold = f.script_plan()
BEATS = f.layout(plan, end_hold=end_hold)
A = f.at
B = {b["id"]: b for b in BEATS}

# ── the biology (claims.json) ───────────────────────────────────────────────
VELLUS_UM = 30.0        # c12: vellus hairs are by definition < 30 µm across
PAPER_UM = 100.0        # c13: 80 gsm copy paper ≈ 100 µm
assert VELLUS_UM / PAPER_UM < 1 / 3 + 1e-9, "thinner than a third"
FX, PX = 6000.0, -6000.0                 # the follicle's place and the fur's place

# ── shots ─────────────────────────────────────────────────────────────────
# hook: the payoff, skin at the mm rung (deep tone), bumps up round fine hairs · follicle: one bump cut open (light
# tone): the muscle, the nerve, the hair standing · fur: a furred coat lifting, air trapped · ours: our skin, the same
# follicles, fine hairs (medium tone) · bulge: down the follicle to its stem cells, the nerve reaching them · cold:
# frost, the nerve fires, the stem cells wake, a new hair grows · nomuscle: the muscle taken away, the wiring fades ·
# gauge: to scale · close: the hook
t_ours, t_nom, t_end = A("vo03:We", -0.2), A("vo05:Take", -0.2), A("vo08:That's", -0.25)
SHOTS = [{"at": 0.0, "name": "hook"}, {"at": B["normal"]["t0"], "name": "follicle"}, {"at": B["change"]["t0"], "name": "fur"},
         {"at": t_ours, "name": "ours"}, {"at": B["why"]["t0"], "name": "bulge"}, {"at": B["whoa"]["t0"], "name": "cold"},
         {"at": t_nom, "name": "nomuscle"}, {"at": B["toscale"]["t0"], "name": "gauge"}, {"at": B["takeaway"]["t0"], "name": "close"}]
TONE = {k: 0.18 for k in ("hook", "follicle", "fur", "ours", "bulge", "cold", "nomuscle", "gauge", "close")}   # bible §1 (owner-approved 2 Nov): one melanin level for the whole episode, rotating (004 medium, 006 light)

CUE = {
    "goose": A("vo01:goosebumps?"), "fur": A("vo01:fur."), "muscle": A("vo02:muscle,"), "cold": A("vo02:cold"),
    "tugs": A("vo02:tugs"), "upright": A("vo02:upright"), "bump": A("vo02:bump."), "fluffs": A("vo03:fluffs"),
    "air": A("vo03:air."), "chimp": A("vo03:chimpanzee,"), "fine": A("vo03:fine,"), "leftover": A("vo04:leftover."),
    "harvard": A("vo04:Harvard"), "reaches": A("vo04:reaches"), "stem": A("vo04:stem"), "holds": A("vo04:holds"),
    "wakes": A("vo05:wakes"), "sooner": A("vo05:sooner."), "take": A("vo05:Take"), "fades": A("vo05:fades."),
    "thinner": A("vo06:thinner"), "paper": A("vo06:sheet"), "raises": A("vo07:raises"), "looks": A("vo07:looks"),
}

# ── the camera (the microscope-stage rig: target, dist, el, az, fov, fx, fy) ──
HOOK = {"target": [0, 60, 0], "el": 34, "fov": 30, "fx": 0.5, "fy": 0.42}
FOL = {"fov": 30, "fx": 0.5, "fy": 0.36}   # the section sits high: its bulb clear of the captions
CAM = {
    "hook": [{"t": 0.0, **HOOK, "dist": 3600, "az": -14}, {"t": B["normal"]["t0"], **HOOK, "dist": 3200, "az": -10, "ease": "sine"}],
    "follicle": [{"t": B["normal"]["t0"], "target": [FX + 130, -200, 0], "el": 6, **FOL, "dist": 3000, "az": -4},
                 {"t": CUE["tugs"], "target": [FX + 130, -220, 0], "el": 5, **FOL, "dist": 2700, "az": -2, "ease": "inout2"},
                 {"t": B["change"]["t0"], "target": [FX + 100, -120, 0], "el": 6, **FOL, "dist": 2500, "az": 0, "ease": "sine"}],
    "fur": [{"t": B["change"]["t0"], "target": [PX, 200, 0], "el": 5, **FOL, "dist": 3400, "az": -8},
            {"t": t_ours, "target": [PX, 240, 0], "el": 5, **FOL, "dist": 3000, "az": -4, "ease": "sine"}],
    "ours": [{"t": t_ours, **HOOK, "dist": 3800, "az": 6},
             {"t": B["why"]["t0"], **HOOK, "dist": 3300, "az": 4, "ease": "sine"}],
    "bulge": [{"t": B["why"]["t0"], "target": [FX + 130, -220, 0], "el": 6, **FOL, "dist": 2700, "az": 0},
              {"t": CUE["reaches"], "target": [FX + 170, -300, 0], "el": 5, **FOL, "dist": 1500, "az": 2, "ease": "inout2"},
              {"t": B["whoa"]["t0"], "target": [FX + 170, -300, 0], "el": 5, **FOL, "dist": 1400, "az": 3, "ease": "sine"}],
    "cold": [{"t": B["whoa"]["t0"], "target": [FX + 140, -260, 0], "el": 6, **FOL, "dist": 2600, "az": 0},
             {"t": t_nom, "target": [FX + 140, -280, 0], "el": 6, **FOL, "dist": 2400, "az": -2, "ease": "sine"}],
    "nomuscle": [{"t": t_nom, "target": [FX + 1300 + 140, -280, 0], "el": 6, **FOL, "dist": 2400, "az": 2},
                 {"t": B["toscale"]["t0"], "target": [FX + 1300 + 150, -300, 0], "el": 6, **FOL, "dist": 2200, "az": 3, "ease": "sine"}],
    "gauge": [{"t": B["toscale"]["t0"], "target": [FX - 100, -60, 0], "el": 6, "fov": 30, "fx": 0.62, "fy": 0.40, "dist": 900, "az": -2},
              {"t": B["takeaway"]["t0"], "target": [FX - 100, -60, 0], "el": 6, "fov": 30, "fx": 0.62, "fy": 0.40, "dist": 860, "az": -3, "ease": "sine"}],
    "close": [{"t": B["takeaway"]["t0"], **HOOK, "dist": 3000, "az": -6},
              {"t": B["tease"]["t1"], **HOOK, "dist": 3600, "az": -14, "ease": "sine"}],
}
for shot, keys in CAM.items():           # a microscope stage: slow arcs (≤ 4° a second)
    for a, b in zip(keys, keys[1:]):
        rate = abs(b["az"] - a["az"]) / (b["t"] - a["t"])
        assert rate <= 4.0 + 1e-9, f"{shot}: az turns {rate:.2f}°/s"

# ── the overlay ─────────────────────────────────────────────────────────────
LABELS = [
    {"id": "l-muscle", "text": "a tiny muscle", "kind": "cell", "anchor": "muscle", "t0": CUE["muscle"], "t1": CUE["tugs"] - 0.2, "shot": "follicle", "side": 1},
    {"id": "l-nerve", "text": "a nerve", "kind": "layer", "anchor": "nerve", "t0": CUE["tugs"], "t1": B["change"]["t0"], "shot": "follicle", "side": 1},
    {"id": "l-hair", "text": "the hair stands", "kind": "cell", "anchor": "hair", "t0": CUE["upright"], "t1": B["change"]["t0"], "shot": "follicle", "side": -1},
    {"id": "l-air", "text": "trapped air", "kind": "water", "anchor": "air", "t0": CUE["air"] - 0.2, "t1": t_ours, "shot": "fur", "side": 1},
    {"id": "l-fine", "text": "fine hairs", "kind": "cell", "anchor": "finehair", "t0": CUE["fine"], "t1": B["why"]["t0"], "shot": "ours", "side": 1},
    {"id": "l-stem", "text": "stem cells", "kind": "water", "anchor": "stem", "t0": CUE["stem"], "t1": B["whoa"]["t0"], "shot": "bulge", "side": 1},
    {"id": "l-hold", "text": "the muscle holds the nerve", "kind": "cell", "anchor": "muscle", "t0": CUE["holds"], "t1": B["whoa"]["t0"], "shot": "bulge", "side": -1},
    {"id": "l-new", "text": "a new hair", "kind": "cell", "anchor": "bulb", "t0": CUE["sooner"] - 0.3, "t1": t_nom, "shot": "cold", "side": 1},
    {"id": "l-nomus", "text": "no muscle", "kind": "cell", "anchor": "nomus", "t0": CUE["take"] + 0.3, "t1": B["toscale"]["t0"], "shot": "nomuscle", "side": 1},
]
BADGES = [
    {"id": "b-simp-h", "text": "simplified", "t0": 0.0, "t1": B["normal"]["t0"], "slot": "tr"},
    {"id": "b-simp", "text": "simplified", "t0": B["normal"]["t0"], "t1": B["change"]["t0"], "slot": "tr"},
    {"id": "b-illus", "text": "illustration", "t0": B["change"]["t0"], "t1": t_ours, "slot": "tr"},
    {"id": "b-simp-o", "text": "simplified", "t0": t_ours, "t1": B["why"]["t0"], "slot": "tr"},
    {"id": "b-mice", "text": "in mice · Shwartz et al., 2020", "t0": CUE["harvard"], "t1": B["toscale"]["t0"], "slot": "bl"},
    {"id": "b-simp-b", "text": "simplified", "t0": B["why"]["t0"], "t1": B["whoa"]["t0"], "slot": "tr"},
    {"id": "b-time", "text": "weeks, compressed", "t0": B["whoa"]["t0"], "t1": B["toscale"]["t0"], "slot": "br"},
    {"id": "b-vel", "text": "vellus: < 30 µm by definition", "t0": CUE["thinner"], "t1": B["takeaway"]["t0"], "slot": "tr"},
    {"id": "b-simp-z", "text": "simplified", "t0": B["takeaway"]["t0"], "t1": t_end, "slot": "tr"},
]
SPINE = [0.5, 0.215]                      # top right, under the notes: the depth gauge owns the left edge
COUNTERS = [
    {"id": "c-q", "label": "goosebumps, with no fur", "fmt": "text", "text": "why?", "t0": CUE["fur"] + 0.1, "t1": CUE["muscle"] - 0.2, "at": SPINE},
    {"id": "c-apm", "label": "the muscle", "fmt": "text", "text": "arrector pili", "t0": CUE["muscle"] + 0.5, "t1": B["change"]["t0"], "at": SPINE},
    {"id": "c-chimp", "label": "hair follicles", "fmt": "text", "text": "≈ chimp", "t0": CUE["chimp"], "t1": B["why"]["t0"], "at": SPINE},
    {"id": "c-ne", "label": "the nerve's signal", "fmt": "text", "text": "noradrenaline", "t0": CUE["reaches"] + 0.45, "t1": t_nom, "at": SPINE},
    {"id": "c-hair", "label": "our fine hairs, across", "fmt": "text", "text": "< 30 µm", "t0": CUE["thinner"], "t1": B["takeaway"]["t0"], "at": [0.7, 0.215]},   # right of the lifted gauge card
    {"id": "c-final", "label": "the little muscle", "fmt": "text", "text": "tends hair", "t0": B["takeaway"]["t0"] + 0.2, "t1": t_end - 0.5, "at": SPINE},
]
CUTS = [sh["at"] for sh in SHOTS[1:]]
# every cut is a short dip to the slide colour (as No. 004), so no cut jumps the picture's brightness in one frame
TRANS = []   # no dips: every shot keeps pushing in, so each cut is a match on the move (the close pulls out for the loop)


def before_cut(t1, lead=0.45):           # faded out before the cut, so nothing of one shot sits on the next
    return round(t1 - lead, 4) if any(abs(t1 - c) < 1e-6 for c in CUTS) else t1


for row in BADGES + COUNTERS + LABELS:
    row["t1"] = before_cut(row["t1"])
for a, b in zip(COUNTERS, COUNTERS[1:]):  # two values never share the screen
    if b["t0"] - a["t1"] < 0.4:
        a["t1"] = round(b["t0"] - 0.4, 4)

GAUGE = {"rise": [B["toscale"]["t0"], B["toscale"]["t0"] + 0.9], "sc": CUE["thinner"], "paper": CUE["paper"],
         "back": [B["takeaway"]["t0"] - 0.5, B["takeaway"]["t0"] + 0.4], "sc_um": VELLUS_UM, "paper_um": PAPER_UM, "bar": "hair"}

TITLE = {"series": "Outer Layer · No. 006", "title": "*Goosebumps*", "t1": CUE["fur"] - 0.3, "sig": A("vo01:goosebumps?", 0.35)}
END = {"title": "Next season: *deeper*", "follow": "Outer Layer · Season 1",
       "next": "In mice, the nerve that raises a hair also wakes the stem cells that regrow it (Shwartz et al., Cell, 2020). Narration: synthetic voice (AI)."}
POSTER = A("vo04:holds", 0.4)

glue(f, {"vo02": ["tiny muscle,", "into a bump."], "vo03": ["trapped air.", "hair follicles", "a chimpanzee,"], "vo04": ["stem cells", "in place."],
         "vo05": ["stem cells,", "new hair sooner."], "vo06": ["a third", "a sheet of paper."], "vo07": ["looks after it."]})
CAPS = hold(f, keep_units(f.captions(max_chars=24)))

film = {
    "id": ID, "fps": FPS, "bpm": BPM, "dur": f.duration, "poster": POSTER,
    "shots": SHOTS, "beats": BEATS, "tone": TONE,
    "bio": {"vellus_um": VELLUS_UM, "paper_um": PAPER_UM, "fx": FX, "px": PX},
    "cam": CAM, "cue": CUE, "gauge": GAUGE, "trans": TRANS,
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
ev += [
    {"t": CUE["tugs"], "kind": "cell.land", "tag": "tug"},
    {"t": B["normal"]["t0"], "kind": "scale.jump", "tag": "into-follicle"},
    {"t": CUE["fluffs"], "kind": "reveal", "tag": "fluff"},
    {"t": CUE["reaches"], "kind": "diffuse", "tag": "reach"},
    {"t": B["whoa"]["t0"], "kind": "swell", "tag": "whoa", "t1": B["whoa"]["t1"]},
    {"t": CUE["wakes"], "kind": "diffuse", "tag": "wake"},
    {"t": CUE["fades"], "kind": "dissolve", "tag": "fade", "t1": round(CUE["fades"] + 0.8, 4)},
    {"t": GAUGE["sc"], "kind": "scale", "tag": "g-hair"},
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
