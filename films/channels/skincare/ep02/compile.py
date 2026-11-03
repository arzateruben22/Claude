"""Compile Skin Sense No. 002 (reboot), "Where a glow comes from": script + voice timings + this direction →
film.json (shots, camera keys, the UV and follicle keys, labels, badges, counters, captions, title and end card) and
sheet.json (the studio's cue sheet). Every moment hangs on a beat or a spoken word; every number on screen comes from
claims.json.

  python3 -I films/channels/skincare/ep02/compile.py

Places, never in one frame: the macro terrain (x = 1000, arbitrary units: a pore every 3.2), the section (x = 5000,
µm; surface y = 0) and the viewfinder cheek (x = 0, the shader plane's units). The depth chart is drawn in the HUD.
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
ID = "skin-sense-002"
f = Film(HERE / "script.md", HERE / "vo", fps=FPS, bpm=BPM)
plan, end_hold = f.script_plan()
BEATS = f.layout(plan, end_hold=end_hold)
CAM_END = f.duration   # the camera's last key stays where the untrimmed film ended, so the motion before the cut is unchanged
MAXDUR = 75.0   # the delivery window is 60–75 s: trim the end card's tail (the card keeps its start)
if f.duration > MAXDUR:
    cut = f.duration - MAXDUR
    BEATS = f.layout(plan, end_hold=end_hold - cut, total=MAXDUR)
A = f.at
B = {b["id"]: b for b in BEATS}

# ── the numbers (claims.json) ──────────────────────────────────────────────
REFL = "≈ 4–7 %"               # c3: 4–7 % reflected at the surface near head-on
BACK = "≈ 40 %"              # c8: one worked example, about 40 % of incident light back out
BLUE_MM, RED_MM, PAPER_UM = 1.0, (4, 5), 100.0   # c12, c13: blue ≈ 1 mm, red 4–5 mm; paper ≈ 100 µm
assert abs(BLUE_MM * 1000 / PAPER_UM - 10) < 1e-9, "about ten sheets of paper"
TONE = 0.5                   # bible §1: one tone per episode, rotating (002 medium)
TX, SX = 1000.0, 5000.0

# ── shots ─────────────────────────────────────────────────────────────────
t_split, t_in, t_face, t_end = A("vo02:Smooth,", -0.35), A("vo03:rest", -0.3), A("vo05:Blood", -0.25), A("vo08:Next:", -0.25)
t_rise = t_face; t_face = t_face + 1.4   # out of the section, up over the glowing skin, then the face
SHOTS = [{"at": 0.0, "name": "macro"}, {"at": t_split, "name": "split"}, {"at": t_in, "name": "inside"},
         {"at": t_rise, "name": "rise"}, {"at": t_face, "name": "face"}, {"at": B["toscale"]["t0"], "name": "depth"}, {"at": B["takeaway"]["t0"], "name": "cg"}, {"at": A("vo07:Yours", -0.3), "name": "macro2"}]
CUE = {"glow": A("vo01:glow"), "inside": A("vo01:inside"), "glint": A("vo02:glint."), "smooth": A("vo02:Smooth,"), "direction": A("vo02:way;"),
       "dry": A("vo02:dry"), "haze": A("vo02:haze."), "isnt": A("vo03:isn't"), "slips": A("vo03:slips"), "bounces": A("vo03:bounces"), "out": A("vo03:out."),
       "picture": A("vo04:picture"), "travelled": A("vo04:travelled"), "melanin": A("vo04:melanin"), "rush": A("vo04:blood."), "redder": A("vo04:blood."),
       "healthy": A("vo05:heart,"), "turned": A("vo05:beat:"), "colour": A("vo05:colour"), "shining": A("vo05:camera"),
       "blue": A("vo06:blue"), "millimetre": A("vo06:millimetre,"), "ten": A("vo06:ten"), "red": A("vo06:red"), "deeper": A("vo06:further,"),
       "isnt2": A("vo07:Film"), "met": A("vo07:plastic:"), "back": A("vo07:glow."), "sitting": A("vo04:sitting"), "but4": A("vo04:But"), "skin5": A("vo05:it.")}

# ── the camera ─────────────────────────────────────────────────────────────
MK = {"fov": 34, "fx": 0.5, "fy": 0.48}
CAM = {
    "macro": [{"t": 0.0, "target": [TX, 0, 4], "el": 22, **MK, "dist": 42, "az": -14},   # frame 0 mid-glide
              {"t": CUE["inside"] + 0.4, "target": [TX, 0, 2], "el": 30, **MK, "dist": 25, "az": -7, "ease": "out3"},
              {"t": B["normal"]["t0"], "target": [TX, 0, 2], "el": 31, **MK, "dist": 23, "az": -6, "ease": "sine"},
              {"t": CUE["glint"], "target": [TX, 0.2, 0], "el": 34, **MK, "dist": 13, "az": -3, "ease": "inout2"},   # down the beam to the glint
              {"t": t_split, "target": [TX, 0.2, 0], "el": 30, **MK, "dist": 15, "az": -2, "ease": "sine"}],
    "split": [{"t": t_split, "target": [TX, 1.4, 0], "el": 22, **MK, "fy": 0.46, "dist": 26, "az": 0},   # back and low: both halves and both glints inside the frame
              {"t": B["change"]["t0"], "target": [TX, 1.3, 0], "el": 25, **MK, "fy": 0.46, "dist": 23, "az": 0, "ease": "sine"},
              {"t": CUE["slips"] - 0.3, "target": [TX, -0.4, 0], "el": 50, **MK, "dist": 9, "az": 0, "ease": "in2"}],   # down into the surface
    "inside": [{"t": t_in, "target": [SX, -40, 0], "el": 14, "fov": 30, "fx": 0.5, "fy": 0.42, "dist": 260, "az": -3},
               {"t": CUE["out"], "target": [SX, -50, 0], "el": 8, "fov": 30, "fx": 0.5, "fy": 0.5, "dist": 300, "az": -1, "ease": "inout2"},   # the surface in frame: where the light leaves
               {"t": CUE["sitting"], "target": [SX, -15, 0], "el": 14, "fov": 30, "fx": 0.5, "fy": 0.46, "dist": 230, "az": 0, "ease": "inout2"},   # up to the surface: the glow "sitting on the skin"
               {"t": CUE["melanin"] - 0.3, "target": [SX - 10, -75, 0], "el": 6, "fov": 30, "fx": 0.5, "fy": 0.42, "dist": 280, "az": 0, "ease": "inout2"},   # back down through it
               {"t": CUE["rush"], "target": [SX + 10, -100, 0], "el": 6, "fov": 30, "fx": 0.5, "fy": 0.42, "dist": 280, "az": 1, "ease": "inout2"},   # to the capillary
               {"t": t_rise, "target": [SX + 10, -60, 0], "el": 10, "fov": 30, "fx": 0.5, "fy": 0.46, "dist": 280, "az": 2, "ease": "sine"}],
    "rise": [{"t": t_rise, "target": [TX + 0.5, -0.2, 0.3], "el": 70, **MK, "dist": 6, "az": -1}, {"t": t_face, "target": [TX, 0, 2], "el": 30, **MK, "dist": 26, "az": -5, "ease": "out3"}],
    "face": [{"t": t_face, "target": [0, -1.35, 0], "el": -1, "fov": 30, "fx": 0.5, "fy": 0.5, "dist": 28, "az": -2},
             {"t": B["toscale"]["t0"], "target": [0, -1.35, 0], "el": -1, "fov": 30, "fx": 0.5, "fy": 0.5, "dist": 25, "az": 0, "ease": "sine"}],
    "depth": [{"t": B["toscale"]["t0"], "target": [SX, -90, 0], "el": 6, "fov": 30, "fx": 0.5, "fy": 0.42, "dist": 420, "az": 2},
              {"t": B["takeaway"]["t0"], "target": [SX, -90, 0], "el": 6, "fov": 30, "fx": 0.5, "fy": 0.42, "dist": 380, "az": 3, "ease": "sine"}],
    "cg": [{"t": B["takeaway"]["t0"], "target": [0, -1.35, 0], "el": -1, "fov": 30, "fx": 0.5, "fy": 0.5, "dist": 28, "az": 0}, {"t": A("vo07:Yours", -0.3), "target": [0, -1.35, 0], "el": -1, "fov": 30, "fx": 0.5, "fy": 0.5, "dist": 27, "az": 0, "ease": "sine"}],
    "macro2": [{"t": A("vo07:Yours", -0.3), "target": [TX + 0.5, -0.2, 0.3], "el": 70, **MK, "dist": 6, "az": -2},   # up out of the skin
               {"t": A("vo07:Yours", 1.2), "target": [TX, 0, 2], "el": 28, **MK, "dist": 22, "az": -4, "ease": "out3"},
               {"t": CAM_END, "target": [TX, 0, 4], "el": 24, **MK, "dist": 34, "az": -10, "ease": "sine"}],
}
for shot, keys in CAM.items():
    for a, b in zip(keys, keys[1:]):
        assert b["t"] > a["t"], f"{shot}: keys out of order"
        assert abs(b["az"] - a["az"]) / (b["t"] - a["t"]) <= 4.0 + 1e-9, f"{shot}: az too fast"

# ── the overlay ─────────────────────────────────────────────────────────────
LABELS = [
    {"id": "l-glint", "text": "the glint", "kind": "cell", "anchor": "glint", "t0": CUE["glint"] - 0.6, "t1": t_split, "shot": "macro", "side": 1, "v": "above", "fixed": True},
    {"id": "l-hyd", "text": "hydrated: one ray", "kind": "water", "anchor": "glintL", "t0": CUE["smooth"] + 0.2, "t1": CUE["isnt"], "shot": "split", "side": 1, "v": "above", "fixed": True},
    {"id": "l-dry", "text": "dry: a haze", "kind": "cell", "anchor": "glintR", "t0": CUE["dry"], "t1": CUE["isnt"], "shot": "split", "side": -1, "v": "below", "fixed": True},
    {"id": "l-sheen", "text": "a glow on the skin?", "kind": "uv", "anchor": "sheen", "t0": CUE["sitting"] - 0.2, "t1": CUE["but4"] - 0.1, "shot": "inside", "side": 1, "v": "below", "fixed": True},
    {"id": "l-mel", "text": "melanin", "kind": "uv", "anchor": "melanin", "t0": CUE["melanin"] - 0.2, "t1": CUE["rush"], "shot": "inside", "side": -1, "fixed": True},
    {"id": "l-cap", "text": "a capillary", "kind": "cell", "anchor": "cap", "t0": CUE["rush"] - 0.2, "t1": t_face, "shot": "inside", "side": 1, "fixed": True},
]
BADGES = [
    {"id": "b-illus", "text": "illustration", "t0": 0.0, "t1": B["normal"]["t0"], "slot": "br"},
    {"id": "b-head", "text": "near head-on light", "t0": B["normal"]["t0"] + 0.3, "t1": t_split, "slot": "tr"},   # with ≈ 4–7 %, which leaves at the same cut
    {"id": "b-one", "text": "one study · illustration", "t0": t_split, "t1": t_in, "slot": "tr"},
    {"id": "b-simp", "text": "simplified · one example (model)", "t0": t_in, "t1": t_face, "slot": "tl"},
    {"id": "b-face", "text": "model face, not a photo", "t0": t_face, "t1": B["toscale"]["t0"], "slot": "tl"},
    {"id": "b-step", "text": "Verkruysse et al., 2008", "t0": t_face, "t1": B["toscale"]["t0"], "slot": "bl"},
    {"id": "b-cg", "text": "Jensen et al., 2001", "t0": B["takeaway"]["t0"] + 0.2, "t1": A("vo07:Yours", -0.3), "slot": "tr"},
    {"id": "b-cgm", "text": "model faces, not photos", "t0": B["takeaway"]["t0"] + 0.2, "t1": A("vo07:Yours", -0.3), "slot": "tl"},
    {"id": "b-est", "text": "estimate · varies by skin and site", "t0": B["toscale"]["t0"], "t1": B["takeaway"]["t0"], "slot": "tr"},
    {"id": "b-illus2", "text": "illustration", "t0": A("vo07:Yours", -0.3), "t1": t_end, "slot": "tr"},
]
SPINE = [0.5, 0.215]
COUNTERS = [
    {"id": "c-refl", "label": "bounces off the top", "text": REFL, "t0": B["normal"]["t0"] + 1.4, "t1": t_split},
    {"id": "c-back", "label": "comes back out", "text": BACK, "t0": CUE["out"] - 0.4, "t1": CUE["sitting"] - 0.5},
    {"id": "c-red", "label": "on its way back out", "text": "past blood", "t0": CUE["redder"] - 0.2, "t1": t_rise},
    {"id": "c-final", "label": "the glow comes", "text": "from within", "t0": A("vo07:Yours", 0.2), "t1": t_end - 0.5},
    {"id": "c-pulse", "label": "your face's colour", "text": "beats", "t0": A("vo05:beat:", -0.1), "t1": B["toscale"]["t0"]},
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

# the light story's keys (scene.mjs reads them)
KEYS = {"beam": [-1.0, 0.0],   # the beam already falling at frame 0
        "glint": [CUE["glint"] - 0.5, CUE["glint"] + 0.2], "spread": [CUE["dry"] - 0.3, CUE["haze"] + 0.3],
        "paths": [t_in + 0.2, CUE["bounces"] + 1.0], "out": [CUE["out"] - 0.8, CUE["out"] + 0.6], "warm": [CUE["melanin"] - 0.3, CUE["redder"] - 0.5],
        "widen": [CUE["rush"] - 0.1, CUE["redder"] + 0.3], "flush": [CUE["turned"] - 0.3, CUE["colour"] + 0.6], "pulse": [A("vo05:beat:", -0.2), B["toscale"]["t0"] - 0.3], "cam": [A("vo05:camera", -0.2), A("vo05:it.", 0.4)], "cg": [B["takeaway"]["t0"], A("vo07:Yours", -0.3)], "inside": [A("vo07:inside.", -0.5), A("vo07:inside.", 0.3)], "sheen": [CUE["sitting"] - 0.4, CUE["sitting"] + 0.3, CUE["but4"] - 0.1, CUE["but4"] + 0.5], "bloom": [CUE["inside"] - 0.2, CUE["inside"] + 0.6], "blue": [CUE["blue"] - 0.1, CUE["millimetre"] + 0.5],
        "sheets": [CUE["ten"] - 0.2, CUE["ten"] + 1.0], "redbar": [CUE["red"] - 0.1, CUE["deeper"] + 0.4], "glowout": [CUE["met"] - 0.6, CUE["back"] + 0.4]}
DEPTH = {"blue_mm": BLUE_MM, "red_mm": list(RED_MM), "paper_um": PAPER_UM}

TITLE = {"series": "Skin Sense · No. 002", "title": "Where a glow *comes from*", "t1": CUE["inside"] - 0.8, "sig": A("vo01:from?", 0.35)}
END = {"title": "Next: why do you *scar*?", "follow": "Skin Sense · No. 003",
       "next": "Only about 4–7% of light bounces off skin's surface; most goes inside and much comes back out. Narration: synthetic voice (AI)."}
POSTER = A("vo04:blood.", 0.2)

glue(f, {"vo01": ["your glow", "on your face", "inside you."], "vo02": ["one ray in twenty", "as a glint.", "Smooth, hydrated skin", "back one way;", "dry skin", "into a haze."],
         "vo03": ["the glint", "the glow.", "slips in,", "cells and fibres,", "several times more", "back out."], "vo04": ["a glow as shine", "the skin.", "travelled through you,", "your melanin", "your blood."],
         "vo05": ["Blood moves", "with your heart,", "every beat:", "too faint to see,", "an ordinary camera", "your pulse in it."],
         "vo06": ["it goes deep:", "blue light", "a millimetre,", "ten sheets of paper;", "several times further,", "through the skin."], "vo07": ["Film faces", "by computer", "like plastic:", "never went inside.", "Yours does;", "your glow."],
         "vo08": ["before birth,", "a cut healed", "without a trace.", "why do you scar?"]})
CAPS = hold(f, keep_units(f.captions(max_chars=24)))

film = {
    "id": ID, "fps": FPS, "bpm": BPM, "dur": f.duration, "poster": POSTER,
    "shots": SHOTS, "beats": BEATS, "tone": TONE, "keys": KEYS, "depth": DEPTH,
    "place": {"tx": TX, "sx": SX},
    "cam": CAM, "cue": CUE,
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
ev += [
    {"t": KEYS["glint"][1], "kind": "cell.land", "tag": "glint"},
    {"t": KEYS["spread"][0], "kind": "diffuse", "tag": "haze"},
    {"t": t_in, "kind": "scale.jump", "tag": "into-skin"},
    {"t": KEYS["out"][0], "kind": "reveal", "tag": "back-out"},
    {"t": B["whoa"]["t0"], "kind": "swell", "tag": "whoa", "t1": B["whoa"]["t1"]},
    {"t": t_face, "kind": "cell.land", "tag": "shutter"},
    {"t": KEYS["blue"][0], "kind": "scale", "tag": "d-blue"},
    {"t": KEYS["redbar"][0], "kind": "reveal", "tag": "d-red"},
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
