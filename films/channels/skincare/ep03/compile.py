"""Compile Outer Layer No. 003 (reboot), "What's in a scar": script + voice timings + this direction →
film.json (shots, camera keys, the UV and follicle keys, labels, badges, counters, captions, title and end card) and
sheet.json (the studio's cue sheet). Every moment hangs on a beat or a spoken word; every number on screen comes from
claims.json.

  python3 -I films/channels/skincare/ep03/compile.py

Places, never in one frame: the macro terrain with the scar (x = 1000, arbitrary units), the adult weave in section
(x = 5000, µm; surface y = 0), the fetal weave (x = 7000) and the UV viewfinder (x = 0, the shader plane's units).
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
ID = "outerlayer-003"
f = Film(HERE / "script.md", HERE / "vo", fps=FPS, bpm=BPM)
plan, end_hold = f.script_plan()
BEATS = f.layout(plan, end_hold=end_hold)
A = f.at
B = {b["id"]: b for b in BEATS}

# ── the numbers (claims.json) ──────────────────────────────────────────────
STRENGTH = 80                # c5: healed wounds reach about 80 % of unwounded strength (Levenson et al. 1965, rat skin)
EPI_UM, PAPER_UM = 100.0, 100.0   # c9: epidermis ≈ 0.07–0.12 mm on most of the body; paper ≈ 100 µm
WEEKS = "≈ 22–24 weeks"      # c6, c7
TONE = 0.9                   # bible §1: one tone per episode, rotating (003 deep)
TX, WX, FX = 1000.0, 5000.0, 7000.0

# ── shots ─────────────────────────────────────────────────────────────────
t_weave, t_end = A("vo02:Under", -0.3), A("vo08:Next:", -0.25)
t_uv = A("vo07:repair:", -1.2)   # the takeaway opens on the hook's frame, then the UV camera switches on
SHOTS = [{"at": 0.0, "name": "macro"}, {"at": t_weave, "name": "weave"}, {"at": B["why"]["t0"], "name": "test"},
         {"at": B["whoa"]["t0"], "name": "fetal"}, {"at": B["toscale"]["t0"], "name": "gauge"}, {"at": B["takeaway"]["t0"], "name": "macro2"}, {"at": t_uv, "name": "uv"}]
CUE = {"skin1": A("vo01:now?"), "closer": A("vo01:Before"), "thread": A("vo01:one."), "strength": A("vo02:strength"), "collagen": A("vo02:collagen,"),
       "woven": A("vo02:woven"), "basket": A("vo02:basket,"), "gives": A("vo02:gives"), "pulled": A("vo02:pulled."), "cut": A("vo03:Cut"),
       "reweave": A("vo03:reweave."), "patches": A("vo03:patches,"), "laying": A("vo03:laying"), "side": A("vo03:side"), "leaves": A("vo03:leaves"),
       "glands": A("vo03:glands."), "healed": A("vo04:healed,"), "pulled4": A("vo04:pulled"), "tears": A("vo04:tears,"), "four": A("vo04:four-fifths"),
       "strength4": A("vo04:strength."), "until": A("vo05:until"), "sixth": A("vo05:sixth"), "regrows": A("vo05:regrows"), "follicles": A("vo05:follicles"),
       "after": A("vo05:After"), "patches5": A("vo05:patches."), "top": A("vo06:top"), "paper": A("vo06:paper's"), "seam": A("vo06:seam."),
       "repair": A("vo07:repair:"), "cut5": A("vo05:cut"), "reweave3": A("vo03:reweave."), "close": A("vo07:close,"), "never": A("vo07:never"), "weave7": A("vo07:weave.")}

# ── the camera ─────────────────────────────────────────────────────────────
MK = {"fov": 34, "fx": 0.5, "fy": 0.48}
WK = {"fov": 30, "fx": 0.5, "fy": 0.44}
CAM = {
    "macro": [{"t": 0.0, "target": [TX, 0, 1.2], "el": 36, **MK, "dist": 22, "az": -8},   # the scar across the frame from frame 0
              {"t": CUE["closer"], "target": [TX, 0, 0.5], "el": 42, **MK, "dist": 17, "az": -6, "ease": "inout2"},
              {"t": t_weave, "target": [TX, 0, 0], "el": 70, **MK, "dist": 6, "az": -3, "ease": "in2"}],   # down into the scar
    "weave": [{"t": t_weave, "target": [WX, -60, 0], "el": 55, **WK, "dist": 700, "az": -20},   # from above the surface, through it...
              {"t": CUE["collagen"], "target": [WX, -130, 0], "el": 22, **WK, "dist": 1250, "az": -26, "ease": "inout2"},   # ...to the weave
              {"t": CUE["cut"], "target": [WX, -130, 0], "el": 26, **WK, "dist": 1350, "az": -20, "ease": "sine"},
              {"t": CUE["patches"], "target": [WX, -130, 0], "el": 30, **WK, "dist": 1050, "az": -16, "ease": "inout2"},   # into the empty gap
              {"t": CUE["glands"], "target": [WX, -130, 0], "el": 28, **WK, "dist": 1250, "az": -14, "ease": "inout2"},
              {"t": B["why"]["t0"], "target": [WX, -130, 0], "el": 28, **WK, "dist": 1300, "az": -12, "ease": "sine"}],
    "test": [{"t": B["why"]["t0"], "target": [WX, -150, 0], "el": 28, **WK, "fy": 0.5, "dist": 1300, "az": -12},
             {"t": CUE["tears"] + 0.4, "target": [WX, -150, 0], "el": 22, **WK, "fy": 0.5, "dist": 1000, "az": -8, "ease": "inout2"},   # a slow push while it is pulled
             {"t": B["whoa"]["t0"], "target": [WX, -150, 0], "el": 26, **WK, "fy": 0.5, "dist": 1450, "az": -4, "ease": "inout2"}],   # back out: the whole patch
    "fetal": [{"t": B["whoa"]["t0"], "target": [FX, -110, 0], "el": 26, **WK, "dist": 1100, "az": -14},
              {"t": CUE["after"], "target": [FX, -110, 0], "el": 24, **WK, "dist": 1000, "az": -6, "ease": "inout2"},
              {"t": B["toscale"]["t0"], "target": [FX, -110, 0], "el": 22, **WK, "dist": 1050, "az": -4, "ease": "sine"}],
    "gauge": [{"t": B["toscale"]["t0"], "target": [WX, -40, 0], "el": 14, "fov": 30, "fx": 0.5, "fy": 0.6, "dist": 1300, "az": -8},   # the section low in frame, the card above it
              {"t": B["takeaway"]["t0"], "target": [WX, -40, 0], "el": 12, "fov": 30, "fx": 0.5, "fy": 0.6, "dist": 1200, "az": -6, "ease": "sine"}],
    "macro2": [{"t": B["takeaway"]["t0"], "target": [TX, 0, 1.2], "el": 36, **MK, "dist": 22, "az": -8}, {"t": t_uv, "target": [TX, 0, 0.8], "el": 40, **MK, "dist": 19, "az": -7, "ease": "sine"}],   # frame 0 again
    "uv": [{"t": t_uv, "target": [0, -0.2, 0], "el": -1, "fov": 30, "fx": 0.5, "fy": 0.5, "dist": 17, "az": 1},
           {"t": B["tease"]["t1"], "target": [0, -0.2, 0], "el": -1, "fov": 30, "fx": 0.5, "fy": 0.5, "dist": 20, "az": -3, "ease": "sine"}],
}
for shot, keys in CAM.items():
    for a, b in zip(keys, keys[1:]):
        assert b["t"] > a["t"], f"{shot}: keys out of order"
        assert abs(b["az"] - a["az"]) / (b["t"] - a["t"]) <= 4.0 + 1e-9, f"{shot}: az too fast"

# ── the overlay ─────────────────────────────────────────────────────────────
LABELS = [
    {"id": "l-scar", "text": "an old scar", "kind": "cell", "anchor": "scar", "t0": 0.0, "t1": t_weave, "shot": "macro", "side": 1, "v": "above", "fixed": True},
    {"id": "l-col", "text": "collagen", "kind": "cell", "anchor": "weave", "t0": CUE["collagen"], "t1": CUE["cut"] - 0.3, "shot": "weave", "side": -1, "v": "above", "fixed": True},
    {"id": "l-patch", "text": "the patch: all one way", "kind": "water", "anchor": "gap", "t0": CUE["side"], "t1": CUE["leaves"] - 0.1, "shot": "weave", "side": 1, "v": "above", "fixed": True},
    {"id": "l-app", "text": "follicles, glands: none inside", "kind": "cell", "anchor": "app", "t0": CUE["leaves"], "t1": B["why"]["t0"], "shot": "weave", "side": 1, "v": "below", "fixed": True},
    {"id": "l-fetal", "text": "fetal skin", "kind": "layer", "anchor": "fside", "t0": B["whoa"]["t0"] + 0.3, "t1": B["toscale"]["t0"], "shot": "fetal", "side": -1, "v": "above", "fixed": True},
    {"id": "l-fol", "text": "follicles regrow", "kind": "cell", "anchor": "fgap", "t0": CUE["follicles"] - 0.2, "t1": CUE["after"] - 0.3, "shot": "fetal", "side": 1, "v": "above", "fixed": True},
    {"id": "l-fpatch", "text": "later: a patch", "kind": "water", "anchor": "fgap", "t0": CUE["patches5"] - 0.2, "t1": B["toscale"]["t0"], "shot": "fetal", "side": 1, "v": "above", "fixed": True},
    {"id": "l-top", "text": "the top layer", "kind": "water", "anchor": "top", "t0": CUE["top"] - 0.2, "t1": B["takeaway"]["t0"], "shot": "gauge", "side": 1, "v": "below", "fixed": True},
    {"id": "l-scar2", "text": "the same old scar", "kind": "cell", "anchor": "scar", "t0": B["takeaway"]["t0"] + 0.2, "t1": t_uv, "shot": "macro2", "side": 1, "v": "above", "fixed": True},
    {"id": "l-seam", "text": "a seam: no pores", "kind": "water", "anchor": "uvscar", "t0": t_uv + 0.3, "t1": t_end, "shot": "uv", "side": 1, "v": "above", "fixed": True},
]
BADGES = [
    {"id": "b-simp", "text": "simplified", "t0": 0.0, "t1": B["change"]["t0"], "slot": "br"},
    {"id": "b-time", "text": "weeks, compressed · illustration", "t0": B["change"]["t0"], "t1": B["why"]["t0"], "slot": "tr"},
    {"id": "b-rat", "text": "model · rats · Levenson 1965", "t0": B["why"]["t0"], "t1": B["whoa"]["t0"], "slot": "br"},
    {"id": "b-fetal", "text": f"illustration · {WEEKS}", "t0": B["whoa"]["t0"], "t1": B["toscale"]["t0"], "slot": "tr"},
    {"id": "b-body", "text": "most of the body", "t0": B["toscale"]["t0"], "t1": B["takeaway"]["t0"], "slot": "tr"},
    {"id": "b-simp2", "text": "simplified", "t0": B["takeaway"]["t0"], "t1": t_uv, "slot": "br"},
    {"id": "b-model", "text": "model, not a photo", "t0": t_uv, "t1": t_end, "slot": "br"},
]
SPINE = [0.5, 0.215]
COUNTERS = [
    {"id": "c-q", "label": "before birth", "text": "no scar", "t0": CUE["closer"] + 0.15, "t1": CUE["collagen"]},
    {"id": "c-weave", "label": "the dermis", "text": "woven", "t0": CUE["collagen"], "t1": CUE["patches"]},
    {"id": "c-patch", "label": "a scar", "text": "patched", "t0": CUE["patches"], "t1": CUE["four"] - 0.3},
    {"id": "c-str", "label": "strength, at most", "text": f"≈ {STRENGTH}%", "t0": CUE["four"] - 0.3, "t1": CUE["sixth"] - 0.2},
    {"id": "c-wk", "label": "scarless before", "text": "≈ 22–24 wk", "t0": CUE["sixth"] - 0.2, "t1": CUE["after"] - 0.2},
    {"id": "c-after", "label": "after that", "text": "patched", "t0": CUE["patches5"] - 0.1, "t1": B["toscale"]["t0"]},
    {"id": "c-final", "label": "a scar", "text": "a repair", "t0": CUE["repair"] + 0.2, "t1": t_end - 0.5},
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

# the scar story's keys (scene.mjs reads them)
KEYS = {"tug1": [CUE["gives"] - 0.2, CUE["gives"] + 0.6], "tug2": [CUE["pulled"] - 0.3, CUE["pulled"] + 0.6], "cut": [CUE["cut"] - 0.1, CUE["cut"] + 0.7],
        "patch": [CUE["laying"] - 0.2, CUE["glands"] - 0.4], "glow": [CUE["side"] - 0.4, CUE["side"] + 0.4], "meter": [CUE["healed"] - 0.2, CUE["pulled4"]],
        "stretch": [CUE["pulled4"] - 0.3, CUE["tears"] + 0.3], "fcut": [CUE["cut5"] - 0.1, CUE["cut5"] + 0.5], "regrow": [CUE["regrows"] - 0.3, CUE["follicles"] + 0.6],
        "fpatch": [CUE["after"] - 0.1, CUE["patches5"] + 1.2], "tear": [CUE["tears"] - 0.2, CUE["tears"] + 0.5], "day": [B["takeaway"]["t0"] + 0.3, CUE["repair"] - 0.2], "scar": [CUE["repair"] - 0.6, CUE["repair"] + 0.4]}
GAUGE = {"rise": [B["toscale"]["t0"] + 0.3, B["toscale"]["t0"] + 1.2], "sc": CUE["top"] - 0.3, "paper": CUE["paper"] - 0.2,
         "back": [B["takeaway"]["t0"] - 0.6, B["takeaway"]["t0"] - 0.05], "epi_um": EPI_UM, "paper_um": PAPER_UM}
STR = {"pct": STRENGTH}

TITLE = {"series": "Outer Layer · No. 003", "title": "What's in a *scar*", "t1": CUE["closer"] - 0.6, "sig": A("vo01:now?", 0.35)}
END = {"title": "Next layer: a poison in a *frown*", "follow": "Outer Layer · No. 004",
       "next": "Healed wounds reach about 80% of the original strength (Levenson et al., 1965, rat skin). Narration: synthetic voice (AI)."}
POSTER = A("vo03:side", 0.4)

glue(f, {"vo01": ["Why do you", "scar now?", "Before birth,", "a cut healed", "without one."], "vo02": ["Under the surface,", "your skin's strength", "is collagen,", "over and under", "every direction", "like a basket,", "a little", "it's pulled."],
         "vo03": ["Cut through it,", "the body", "doesn't reweave.", "It patches,", "new threads", "side by side,", "one direction,", "leaves out", "the hair", "the sweat glands."],
         "vo04": ["a closed wound", "as good as new.", "until it tears,", "an old scar", "about four-fifths", "the original strength."],
         "vo05": ["about the sixth month", "of pregnancy,", "a baby's skin", "the weave,", "follicles and all.", "After that,", "it patches."],
         "vo06": ["most of your body,", "the top layer,", "this paper's thickness,", "without a seam."], "vo07": ["So, why", "the scar?", "quick repair:", "strong enough", "to close,", "the weave."],
         "vo08": ["a deadly poison,", "a frown.", "goes in?"]})
CAPS = hold(f, keep_units(f.captions(max_chars=24)))

film = {
    "id": ID, "fps": FPS, "bpm": BPM, "dur": f.duration, "poster": POSTER,
    "shots": SHOTS, "beats": BEATS, "tone": TONE, "keys": KEYS, "str": STR,
    "place": {"tx": TX, "wx": WX, "fx": FX},
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
ev += [
    {"t": t_weave, "kind": "scale.jump", "tag": "into-skin"},
    {"t": KEYS["tug1"][0], "kind": "cell.land", "tag": "tug1"},
    {"t": KEYS["tug2"][0], "kind": "cell.land", "tag": "tug2"},
    {"t": KEYS["cut"][0], "kind": "dissolve", "tag": "cut", "t1": KEYS["cut"][1]},
    {"t": KEYS["glow"][0], "kind": "reveal", "tag": "patch"},
    {"t": KEYS["meter"][1], "kind": "scale", "tag": "meter"},
    {"t": B["whoa"]["t0"], "kind": "swell", "tag": "whoa", "t1": B["whoa"]["t1"]},
    {"t": KEYS["regrow"][0], "kind": "diffuse", "tag": "regrow"},
    {"t": GAUGE["sc"], "kind": "scale", "tag": "g-epi"},
    {"t": GAUGE["paper"], "kind": "reveal", "tag": "g-paper"},
    {"t": B["takeaway"]["t0"], "kind": "cell.land", "tag": "shutter"},
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
