"""Compile Outer Layer No. 003, "Bath fingers": script + voice timings + this direction → film.json (shots, the
wrinkle and vessel keys, camera keys, labels, badges, counters, captions, title and end card) and sheet.json (the
studio's cue sheet). Every moment hangs on a beat or a spoken word; every number on screen comes from claims.json.

  python3 -I films/channels/skincare/ep03/compile.py

Units in the scene: 1 unit = 1 µm; the skin's surface is y = 0; bath water fills 0 … +40 over a block.
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
PALM_UM, CHEEK_UM, PAPER_UM = 173.0, 17.0, 100.0     # c9: palm 173 µm, cheek 16.8 µm (Egawa 2007); paper ≈ 100 µm
WRINKLE = 8.0                                        # drawn fold amplitude, µm (an illustration: badged "simplified")
NARROW = 0.42                                        # the vessels narrow to this fraction of their width (illustration)
assert 1.6 < PALM_UM / PAPER_UM < 1.9                # "nearly two sheets of paper"

# ── shots: one world of two pads in a bath, one push inside, few cuts, each one matched ──────────────────────────────
# pads (hook and the sponge): a fingertip pad, furrowed, beside a smooth forearm patch; a push to the fingertip for the
# wrong idea · nerves: a match cut on "Almost" to the same framing, now two fingertips, one nerve cut · inside: a push
# into the fingertip's cut face (the vessels narrow, the pad sinks, the skin buckles) · reflex: back out to the furrowed
# pad in its bath, marbles for the grip study, then a pull-back that lifts the gauge card (to scale) · close: the hook
t_end = A("vo08:Next", -0.25)
SHOTS = [{"at": 0.0, "name": "pads"}, {"at": A("vo03:Almost", -0.15), "name": "nerves"},
         {"at": B["why"]["t0"], "name": "inside"}, {"at": B["whoa"]["t0"], "name": "reflex"}, {"at": B["takeaway"]["t0"], "name": "close"}]
TONE = {"pads": 0.9, "nerves": 0.9, "inside": 0.9, "reflex": 0.9, "close": 0.9}   # one tone for the whole world (bible §1): deep

CUE = {"swell": [A("vo02:swelling,", -0.3), A("vo02:sponge.", 0.2)], "wrong": A("vo02:wrong."),
       "cut": A("vo03:cut"), "smooth": A("vo03:smooth"), "nerves": A("vo04:nerves."), "narrow": [A("vo04:narrow"), A("vo04:narrow", 2.0)],
       "shrink": [A("vo04:shrinks"), A("vo04:little,", 0.3)], "buckle": [A("vo04:buckles.", -0.6), A("vo04:buckles.", 0.5)],
       "reflex": A("vo05:reflex,"), "argued": A("vo05:argued:"), "grip": A("vo05:grip,"), "none": A("vo05:none."),
       "hairless": A("vo06:hairless"), "thickest": A("vo06:thickest"), "paper": A("vo06:paper."), "soaked": A("vo07:soaked."),
       "decide": A("vo07:decide"), "found": A("vo05:found")}

# ── the camera (the microscope stage) ──────────────────────────────────────────────────────────────────────────────
PADS = {"target": [0, -20, 0], "el": 20, "fov": 30, "fx": 0.5, "fy": 0.44, "dist": 520, "az": -4}
TIP = {"target": [-40, -16, 0], "el": 18, "fov": 30, "fx": 0.5, "fy": 0.44}
CAM = {
    "pads": [{"t": 0.0, **PADS, "dist": 560, "az": -8}, {"t": B["normal"]["t0"], **PADS, "dist": 520, "az": -4, "ease": "sine"},
             # the wrong idea: a push to the fingertip as it "swells", then back out to the same framing for the match cut
             {"t": CUE["swell"][1], **TIP, "dist": 300, "az": -6, "ease": "inout2"},
             {"t": CUE["wrong"] + 0.2, **TIP, "dist": 300, "az": -5, "ease": "sine"},
             {"t": A("vo03:Almost", -0.15), **PADS, "ease": "inout2"}],
    # the nerves: the same framing (a match), then a push into the fingertip's cut face, where the inside shot begins
    "nerves": [{"t": A("vo03:Almost", -0.15), **PADS}, {"t": CUE["smooth"] + 0.3, **PADS, "dist": 500, "az": -2, "ease": "sine"},
               {"t": B["why"]["t0"], "target": [-40, -18, 23], "el": 6, "fov": 30, "fx": 0.5, "fy": 0.46, "dist": 240, "az": -2, "ease": "inout2"}],
    # inside: close on the section's cut face (from the push), down to the vessels, up to the surface as it buckles,
    # then out again on "reflex" (the reflex shot opens on the pad at that distance)
    "inside": [{"t": B["why"]["t0"], "target": [0, -60, 0], "el": 6, "fov": 30, "fx": 0.5, "fy": 0.46, "dist": 260, "az": -2},
               {"t": CUE["narrow"][0], "target": [0, -96, 0], "el": 5, "fov": 30, "fx": 0.5, "fy": 0.46, "dist": 250, "az": -1, "ease": "inout2"},
               {"t": CUE["shrink"][0], "target": [0, -40, 0], "el": 7, "fov": 30, "fx": 0.5, "fy": 0.46, "dist": 300, "az": 0, "ease": "inout2"},
               {"t": CUE["buckle"][1], "target": [0, -10, 0], "el": 10, "fov": 30, "fx": 0.5, "fy": 0.46, "dist": 280, "az": 1, "ease": "inout2"},
               {"t": B["whoa"]["t0"], "target": [0, -10, 0], "el": 10, "fov": 30, "fx": 0.5, "fy": 0.46, "dist": 270, "az": 2, "ease": "sine"}],
    # the reflex: the furrowed pad in its bath, marbles on it; an orbit through the grip study; then the pull-back that
    # lifts the gauge card (the pad lower right, clear of the card and above the captions)
    "reflex": [{"t": B["whoa"]["t0"], "target": [-40, -14, 0], "el": 22, "fov": 30, "fx": 0.5, "fy": 0.46, "dist": 300, "az": -14},
               {"t": CUE["argued"], "target": [-40, -14, 0], "el": 24, "fov": 30, "fx": 0.5, "fy": 0.46, "dist": 340, "az": -4, "ease": "inout2"},
               {"t": CUE["none"] + 0.4, "target": [-40, -14, 0], "el": 26, "fov": 30, "fx": 0.5, "fy": 0.46, "dist": 330, "az": 6, "ease": "inout2"},
               {"t": B["toscale"]["t0"] + 2.6, "target": [-40, -20, 0], "el": 20, "fov": 30, "fx": 0.72, "fy": 0.36, "dist": 520, "az": 8, "ease": "inout2"},
               {"t": B["takeaway"]["t0"], "target": [-40, -20, 0], "el": 20, "fov": 30, "fx": 0.72, "fy": 0.36, "dist": 510, "az": 9, "ease": "sine"}],
    "close": [{"t": B["takeaway"]["t0"], **PADS, "dist": 520, "az": -4},
              {"t": B["tease"]["t1"], **PADS, "dist": 560, "az": -8, "ease": "sine"}],
}
for shot, keys in CAM.items():
    for a, b in zip(keys, keys[1:]):
        rate = abs(b["az"] - a["az"]) / (b["t"] - a["t"])
        assert rate <= 4.0 + 1e-9, f"{shot}: az turns {rate:.2f}°/s"

# ── the overlay ─────────────────────────────────────────────────────────────
LABELS = [
    {"id": "l-tip-h", "text": "fingertip", "kind": "layer", "anchor": "tip", "t0": 0.0, "t1": B["normal"]["t0"], "shot": "pads", "side": -1, "v": "above", "fixed": True},
    {"id": "l-arm-h", "text": "forearm", "kind": "layer", "anchor": "arm", "t0": A("vo01:arm"), "t1": B["normal"]["t0"], "shot": "pads", "side": 1, "v": "above", "fixed": True},
    {"id": "l-sponge", "text": "swelling like a sponge?", "kind": "water", "anchor": "ghost", "t0": A("vo02:swelling,"), "t1": CUE["wrong"], "shot": "pads", "side": 1, "v": "below", "fixed": True},
    {"id": "l-nerve", "text": "nerve", "kind": "cell", "anchor": "nerve_l", "t0": A("vo03:finger"), "t1": B["why"]["t0"] - 1.2, "shot": "nerves", "side": -1, "v": "above", "fixed": True},
    {"id": "l-cutn", "text": "nerve cut", "kind": "cell", "anchor": "nerve_r", "t0": CUE["cut"], "t1": B["why"]["t0"] - 1.2, "shot": "nerves", "side": 1, "v": "above", "fixed": True},
    {"id": "l-vessel", "text": "tiny vessels", "kind": "cell", "anchor": "vessel", "t0": A("vo04:vessels"), "t1": CUE["shrink"][0] - 0.3, "shot": "inside", "side": -1, "fixed": True},
    {"id": "l-tip-c", "text": "fingertip", "kind": "layer", "anchor": "tip", "t0": A("vo07:So", -0.1), "t1": t_end, "shot": "close", "side": -1, "v": "above", "fixed": True},
    {"id": "l-arm-c", "text": "forearm", "kind": "layer", "anchor": "arm", "t0": A("vo07:So", -0.1), "t1": t_end, "shot": "close", "side": 1, "v": "above", "fixed": True},
]
BADGES = [
    {"id": "b-simp-h", "text": "simplified", "t0": B["normal"]["t0"] - 0.6, "t1": B["why"]["t0"], "slot": "tr"},
    {"id": "b-wrong", "text": "not what happens", "t0": CUE["wrong"], "t1": A("vo03:Almost", -0.15), "slot": "tl"},
    {"id": "b-1930", "text": "Lewis & Pickering, 1930s", "t0": A("vo03:doctors"), "t1": B["why"]["t0"], "slot": "tl"},
    {"id": "b-ws", "text": "Wilder-Smith & Chow, 2003", "t0": A("vo04:narrow"), "t1": B["whoa"]["t0"], "slot": "tl"},
    {"id": "b-fast", "text": "minutes, sped up", "t0": A("vo04:In"), "t1": B["whoa"]["t0"], "slot": "br"},
    {"id": "b-trigger", "text": "the trigger: still studied", "t0": A("vo04:In"), "t1": B["whoa"]["t0"], "slot": "bl"},
    {"id": "b-debated", "text": "debated", "t0": CUE["argued"], "t1": B["toscale"]["t0"], "slot": "tr"},
    {"id": "b-studies", "text": "Kareklas 2013 · Haseleu 2014", "t0": CUE["found"] - 0.4, "t1": B["toscale"]["t0"], "slot": "tl"},
    {"id": "b-palm", "text": "palm · cheek ≈ 17 µm (No. 001)", "t0": CUE["thickest"], "t1": B["takeaway"]["t0"], "slot": "tr"},
    {"id": "b-simp-c", "text": "simplified", "t0": B["takeaway"]["t0"], "t1": t_end, "slot": "tr"},
]
SPINE = [0.34, 0.215]
COUNTERS = [   # one readout through the film (WRITING.md, The picture, rule 2)
    {"id": "c-q", "label": "wet fingertip vs forearm", "fmt": "text", "text": "why?", "t0": B["normal"]["t0"] + 0.1, "t1": A("vo03:Almost", -0.55), "at": SPINE},
    {"id": "c-1930", "label": "a finger with a cut nerve", "fmt": "text", "text": "1930s", "t0": A("vo03:Almost"), "t1": B["why"]["t0"] - 0.45, "at": SPINE},
    {"id": "c-nerve", "label": "the wrinkle is made by", "fmt": "text", "text": "nerves", "t0": B["why"]["t0"] + 0.4, "t1": CUE["reflex"] - 0.4, "at": SPINE},
    {"id": "c-reflex", "label": "a nerve reflex", "fmt": "text", "text": "reflex", "t0": CUE["reflex"], "t1": CUE["found"] - 0.4, "at": SPINE},
    {"id": "c-2013", "label": "a better wet grip?", "fmt": "text", "text": "2013 ✓", "t0": CUE["found"], "t1": A("vo05:next") - 0.4, "at": SPINE},
    {"id": "c-2014", "label": "a better wet grip?", "fmt": "text", "text": "2014 ✗", "t0": A("vo05:next"), "t1": B["toscale"]["t0"] + 0.4, "at": SPINE},
    {"id": "c-final", "label": "the wrinkle is made by", "fmt": "text", "text": "nerves", "t0": B["takeaway"]["t0"] + 0.2, "t1": t_end - 0.5, "at": SPINE},
]
CUTS = [sh["at"] for sh in SHOTS[1:]]


def before_cut(t1, lead=0.45):
    return round(t1 - lead, 4) if any(abs(t1 - c) < 1e-6 for c in CUTS) else t1


for row in BADGES + COUNTERS + LABELS:
    row["t1"] = before_cut(row["t1"])
for a, b in zip(COUNTERS, COUNTERS[1:]):
    if b["t0"] - a["t1"] < 0.4:
        a["t1"] = round(b["t0"] - 0.4, 4)

GAUGE = {"rise": [B["toscale"]["t0"] + 0.3, B["toscale"]["t0"] + 1.2], "sc": CUE["thickest"] - 0.6, "paper": B["toscale"]["t0"] + 1.0,
         "back": [B["takeaway"]["t0"] - 0.5, B["takeaway"]["t0"] + 0.4], "sc_um": PALM_UM, "paper_um": PAPER_UM}

TITLE = {"series": "Outer Layer · No. 003", "title": "Bath *fingers*", "t1": B["normal"]["t0"] - 0.5, "sig": A("vo01:wrinkle?", 0.35)}
END = {"title": "Next layer: is a tan a *shield*?", "follow": "Outer Layer · No. 004",
       "next": "A finger with a cut nerve doesn't wrinkle in water (Lewis & Pickering). Narration: synthetic voice (AI)."}
POSTER = A("vo05:grip,", 0.3)

glue(f, {"vo01": ["wet fingers", "the same bath."], "vo02": ["soaking up water", "and swelling,", "like a sponge.", "grew up with,"],
         "vo03": ["Almost a century ago,", "doctors noticed", "something odd:", "had been cut", "in the bath."],
         "vo04": ["your nerves.", "tiny vessels", "under each fingertip,", "the pad", "shrinks a little,", "the skin", "on top"],
         "vo05": ["a reflex,", "one doctors use", "test a nerve.", "a wet grip,", "found none."],
         "vo06": ["hairless skin", "of hands and feet,", "the thickest dead layer,", "two sheets of paper."],
         "vo07": ["don't wrinkle", "because they're soaked.", "decide to."], "vo08": ["your skin?"]})
CAPS = hold(f, keep_units(f.captions(max_chars=24)))

film = {
    "id": ID, "fps": FPS, "bpm": BPM, "dur": f.duration, "poster": POSTER,
    "shots": SHOTS, "beats": BEATS, "tone": TONE,
    "skin": {"wrinkle": WRINKLE, "narrow": NARROW, "palm_um": PALM_UM, "cheek_um": CHEEK_UM, "paper_um": PAPER_UM},
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
    {"t": CUE["swell"][0], "kind": "swell", "tag": "sponge", "t1": CUE["swell"][1]},
    {"t": CUE["wrong"], "kind": "dissolve", "tag": "wrong", "t1": CUE["wrong"] + 0.8},
    {"t": CUE["narrow"][0], "kind": "dissolve", "tag": "narrow", "t1": CUE["narrow"][1]},
    {"t": CUE["buckle"][1] - 0.5, "kind": "cell.land", "tag": "buckle"},
    {"t": B["whoa"]["t0"], "kind": "swell", "tag": "whoa", "t1": B["whoa"]["t1"]},
    {"t": GAUGE["sc"], "kind": "scale", "tag": "g-palm"},
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
print(f"sheet.json: {len(sheet['events'])} events" + (f", {len(shown)} shown times from the picture" if shown else ""))
for pg in CAPS:
    print(f"  {pg['t0']:6.2f}–{pg['t1']:6.2f}  " + " / ".join(" ".join(w for w, _ in r).replace(" ", " ") for r in pg["lines"]))
