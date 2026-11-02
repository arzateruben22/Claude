"""Compile Outer Layer No. 004, "The deadliest dose" (the reboot's look: UV camera + macro flight): script + voice
timings + this direction → film.json (the scene's clock: shots, camera keys, labels, badges, counters, plates,
captions, title and end card) and sheet.json (the studio's cue sheet). Nothing here is a hand-typed time: every
moment hangs on a beat or a spoken word (kits/cinema/script/timeline.py anchors), and every number on screen comes
from claims.json.

  python3 -I films/channels/skincare/ep04/compile.py

Places (one scene, far apart, never in one frame): the brow (the macro terrain, x = 0, arbitrary units, a pore every
3.2), the junction below the frown (../set/junction04.js, x = 4000, schematic), the UV camera's brow (x = −4000).
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[3] / "kits/cinema/script"))
from timeline import Film   # noqa: E402
sys.path.insert(0, str(HERE.parent / "set"))
from capglue import glue, hold, keep_units    # noqa: E402

FPS, BPM = 30, 64.2857                   # bible §5: F major at 64.2857 BPM (a 16th = 7 frames)
ID = "outerlayer-004"
f = Film(HERE / "script.md", HERE / "vo", fps=FPS, bpm=BPM)
plan, end_hold = f.script_plan()
BEATS = f.layout(plan, end_hold=end_hold)
A = f.at
B = {b["id"]: b for b in BEATS}

# ── the numbers (claims.json) ───────────────────────────────────────────────
FROWN_U = 20            # c8: the labelled frown-line dose, 20 units (4 units × 5 sites)
SITES = 5
LETHAL_U = 3000         # c9: estimated human LD50 ≈ 3,000 units for a 70 kg adult (extrapolated from primates)
GAP_UM = 0.05           # c10: the synaptic cleft ≈ 50 nm
PAPER_UM = 100.0        # c11: 80 gsm copy paper ≈ 100 µm
PCT = 100 * FROWN_U / LETHAL_U
assert 0.5 < PCT < 1.0, "well under a hundredth"
assert 1500 <= PAPER_UM / GAP_UM <= 2500, "about two thousand times thinner"
TONE = "light"          # bible §1: one melanin level per episode (004: light)

# ── shots ─────────────────────────────────────────────────────────────────
# brow (the payoff: a macro flight over a frown) · below (a scale jump under the surface on "nerve": the junction; no cut
# into the nerve ending for the change) · rise (a scale jump up and out for Kerner) · uv (the reveal) · gauge (back
# below: to scale, then the new endings; one place, no cut) · close (the hook's flight, under the end card)
t_end = A("vo08:Next:", -0.25)
CUE = {
    "poison": A("vo01:Poison,"), "frown": A("vo01:frown?"), "known": A("vo01:known,"), "nanogram": A("vo01:nanogram."),
    "every": A("vo02:Every"), "nerve": A("vo02:nerve"), "messenger": A("vo02:messenger"), "below": A("vo02:below."),
    "pulls": A("vo02:pulls,"), "crease": A("vo02:crease."),
    "never": A("vo03:never"), "slips": A("vo03:slips"), "cuts": A("vo03:cuts"), "protein": A("vo03:protein"),
    "ready": A("vo03:ready,"), "leaves": A("vo03:leaves."),
    "two": A("vo04:Two"), "justinus": A("vo04:Justinus"), "sausages": A("vo04:sausages."), "guessed": A("vo04:guessed"), "medicine": A("vo04:medicine."),
    "howmuch": A("vo05:much"), "whole": A("vo05:whole"), "hundredth": A("vo05:hundredth"), "kill": A("vo05:kill"), "person": A("vo05:person."),
    "gap": A("vo06:gap"), "thousand": A("vo06:thousand"), "paper": A("vo06:paper."),
    "silence": A("vo07:silence"), "nerve2": A("vo07:nerve"), "endings": A("vo07:endings."),
}
SHOTS = [{"at": 0.0, "name": "brow"}, {"at": CUE["nerve"], "name": "below"}, {"at": B["why"]["t0"], "name": "rise"},
         {"at": CUE["guessed"] - 0.1, "name": "below2"}, {"at": B["whoa"]["t0"], "name": "uv"}, {"at": B["toscale"]["t0"], "name": "gauge"}, {"at": B["tease"]["t0"], "name": "close"}]

# ── the camera (orbit keys: target, dist, el, az, fov, fx, fy) ──
JX, UX = 4000.0, -4000.0
TOPY, BULB, SNAP, CREASE = -18.0, [JX + 4, -10.5, 12], [JX + 4, -16.5, 14.2], [JX, 41.5, 30]
FLY = {"el": 13, "fov": 34, "fx": 0.5, "fy": 0.46}
CAM = {
    # a low drone pass along the crease (it runs along z at x = 0), dipping toward it before the jump below
    "brow": [{"t": 0.0, "target": [0, -0.6, 16], "dist": 24, "az": -6, **FLY},
             {"t": CUE["known"], "target": [0, -0.6, 8], "dist": 21, "az": -3, **FLY, "ease": "sine"},
             {"t": CUE["nerve"], "target": [0, -1.2, 0], "dist": 12, "az": 0, "el": 34, "fov": 34, "fx": 0.5, "fy": 0.46, "ease": "in2"}],
    # the junction: the crease where the brow left it (match), then down to the nerve ending and its messenger, back out
    # for the pull, then into the bulb for the change
    "below": [{"t": CUE["nerve"], "target": CREASE, "dist": 210, "el": 22, "az": 0, "fov": 30, "fx": 0.5, "fy": 0.46},
              {"t": CUE["messenger"] - 0.3, "target": BULB, "dist": 201, "el": 14, "az": -8, "fov": 30, "fx": 0.5, "fy": 0.5, "ease": "inout2"},
              {"t": CUE["pulls"], "target": [JX, 12, 14], "dist": 494, "el": 20, "az": -6, "fov": 30, "fx": 0.5, "fy": 0.46, "ease": "inout2"},
              {"t": B["change"]["t0"], "target": [JX, 10, 14], "dist": 471, "el": 19, "az": -4, "fov": 30, "fx": 0.5, "fy": 0.46, "ease": "sine"},
              {"t": CUE["slips"], "target": BULB, "dist": 126, "el": 12, "az": 2, "fov": 30, "fx": 0.5, "fy": 0.46, "ease": "inout2"},
              {"t": CUE["cuts"] + 0.2, "target": SNAP, "dist": 98, "el": 10, "az": 4, "fov": 30, "fx": 0.5, "fy": 0.46, "ease": "inout2"},
              {"t": B["why"]["t0"], "target": SNAP, "dist": 105, "el": 10, "az": 6, "fov": 30, "fx": 0.5, "fy": 0.46, "ease": "sine"}],
    # up and out: the flight rises high over the brow, the skin falls away into a wide golden view
    "rise": [{"t": B["why"]["t0"], "target": [0, -1, 2], "dist": 16, "el": 30, "az": 6, "fov": 34, "fx": 0.5, "fy": 0.46},
             {"t": B["whoa"]["t0"], "target": [0, -1, -6], "dist": 44, "el": 20, "az": 14, "fov": 34, "fx": 0.5, "fy": 0.62, "ease": "out3"}],
    # back below on "guessed": the silenced nerve ending, the plate's second line over it (the thread returns to the junction)
    "below2": [{"t": CUE["guessed"] - 0.1, "target": BULB, "dist": 230, "el": 12, "az": -6, "fov": 30, "fx": 0.5, "fy": 0.56},
               {"t": B["whoa"]["t0"], "target": BULB, "dist": 170, "el": 12, "az": 0, "fov": 30, "fx": 0.5, "fy": 0.56, "ease": "inout2"}],
    # the reveal: the same brow through the UV camera, held (the plate and the points move, not the camera)
    "uv": [{"t": B["whoa"]["t0"], "target": [UX, 0.1, 0], "dist": 28, "el": 2, "az": 0, "fov": 30, "fx": 0.5, "fy": 0.35},
           {"t": B["toscale"]["t0"], "target": [UX, 0.1, 0], "dist": 26, "el": 2, "az": 0, "fov": 30, "fx": 0.5, "fy": 0.35, "ease": "sine"}],
    # back below: the gap under the card (the card lifts into the upper half), then the new endings along the fibre
    "gauge": [{"t": B["toscale"]["t0"], "target": [JX + 4, -8, 14], "dist": 300, "el": 14, "az": -4, "fov": 30, "fx": 0.5, "fy": 0.6},
              {"t": B["takeaway"]["t0"], "target": [JX + 26, -14, 14], "dist": 150, "el": 14, "az": 0, "fov": 30, "fx": 0.5, "fy": 0.5, "ease": "inout2"},
              {"t": B["tease"]["t0"], "target": [JX + 26, -14, 14], "dist": 165, "el": 14, "az": 4, "fov": 30, "fx": 0.5, "fy": 0.5, "ease": "sine"}],
    "close": [{"t": B["tease"]["t0"], "target": [0, -0.6, 20], "dist": 26, "az": -8, **FLY},
              {"t": B["tease"]["t1"], "target": [0, -0.6, 15], "dist": 24, "az": -6, **FLY, "ease": "sine"}],
}
for shot, keys in CAM.items():           # slow arcs (≤ 6° a second)
    for a, b in zip(keys, keys[1:]):
        rate = abs(b["az"] - a["az"]) / max(1e-6, b["t"] - a["t"])
        assert rate <= 6.0 + 1e-9, f"{shot}: az turns {rate:.2f}°/s"

# ── the overlay ─────────────────────────────────────────────────────────────
LABELS = [
    {"id": "l-nerve", "text": "nerve ending", "kind": "cell", "anchor": "bulb", "t0": CUE["nerve"] + 0.5, "t1": CUE["pulls"] - 0.3, "shot": "below", "side": -1},
    {"id": "l-msg", "text": "messenger", "kind": "water", "anchor": "gap", "t0": CUE["messenger"], "t1": CUE["pulls"] - 0.3, "shot": "below", "side": 1, "v": "below"},
    {"id": "l-muscle", "text": "muscle", "kind": "cell", "anchor": "muscle", "t0": CUE["pulls"], "t1": B["change"]["t0"] + 0.4, "shot": "below", "side": -1, "v": "below"},
    {"id": "l-crease", "text": "the crease", "kind": "cell", "anchor": "crease", "t0": CUE["crease"] - 0.3, "t1": B["change"]["t0"] + 0.4, "shot": "below", "side": 1},
    {"id": "l-tox", "text": "botulinum toxin", "kind": "uv", "anchor": "tox", "t0": CUE["slips"] + 0.2, "t1": CUE["cuts"] + 0.2, "shot": "below", "side": -1, "v": "above"},
    {"id": "l-snap", "text": "SNAP-25, cut", "kind": "water", "anchor": "snap", "t0": CUE["cuts"] + 0.4, "t1": B["why"]["t0"], "shot": "below", "side": 1, "v": "below"},
    {"id": "l-sprout", "text": "new endings", "kind": "cell", "anchor": "sprout", "t0": CUE["nerve2"], "t1": B["tease"]["t0"], "shot": "gauge", "side": 1, "v": "above"},
]
BADGES = [
    {"id": "b-model-h", "text": "model, not a photo", "t0": B["normal"]["t0"] - 0.4, "t1": CUE["nerve"], "slot": "tr"},   # after the title (its series line runs under the top-right note)
    {"id": "b-simp", "text": "simplified · not to scale", "t0": CUE["nerve"] + 0.3, "t1": B["change"]["t0"], "slot": "tl"},
    {"id": "b-illus", "text": "illustration", "t0": B["change"]["t0"], "t1": B["why"]["t0"], "slot": "tl"},
    {"id": "b-model-uv", "text": "model, not a photo", "t0": B["whoa"]["t0"], "t1": B["toscale"]["t0"], "slot": "tl"},
    {"id": "b-gap", "text": "estimate · not to scale", "t0": B["toscale"]["t0"] + 0.3, "t1": B["takeaway"]["t0"], "slot": "tl"},
    {"id": "b-months", "text": "≈ 3–4 months, compressed", "t0": B["takeaway"]["t0"] + 0.3, "t1": t_end, "slot": "tl"},
    {"id": "b-mice", "text": "regrowth studied in mice", "t0": CUE["nerve2"] - 0.3, "t1": t_end, "slot": "tr"},
]
SPINE = [0.62, 0.215]   # top right, under the notes
COUNTERS = [
    {"id": "c-q", "label": "one frown's dose", "fmt": "text", "text": "?", "t0": CUE["frown"] + 0.2, "t1": B["why"]["t0"], "at": SPINE},
    {"id": "c-dose", "label": "of a lethal dose (est.)", "fmt": "text", "text": "< 1 %", "t0": CUE["kill"], "t1": t_end - 0.7, "at": SPINE},
]
# the plates: Kerner's (the why) and the dose (the whoa); the daylight strip before the dose plate replaces it
PLATES = {
    "kerner": {"t0": CUE["justinus"] - 0.2, "t1": B["whoa"]["t0"] - 0.3, "med": CUE["medicine"] - 0.4,
               "name": "Justinus Kerner", "role": "physician, Württemberg", "line1": "1817–1822: “sausage poison” described",
               "line2": "proposed it might one day treat illness"},
    "dose": {"t0": CUE["hundredth"] - 0.5, "t1": B["toscale"]["t0"] - 0.3, "frown": CUE["whole"], "kill": CUE["kill"],
             "frown_u": FROWN_U, "lethal_u": LETHAL_U, "sites": SITES},
    # no daylight strip here: a tone strip under a lethal-dose line would pair tones with a risk (bible §1)
    "viewfinder": {"t0": B["whoa"]["t0"], "t1": B["toscale"]["t0"], "sites": CUE["howmuch"] - 0.2},
}
CUTS = [sh["at"] for sh in SHOTS[1:]]


def before_cut(t1, lead=0.35):           # faded out before a cut, so nothing of one shot sits on the next
    return round(t1 - lead, 4) if any(abs(t1 - c) < 1e-6 for c in CUTS) else t1


for row in BADGES + COUNTERS + LABELS:
    row["t1"] = before_cut(row["t1"])
for a, b in zip(COUNTERS, COUNTERS[1:]):  # two values never share the screen
    if b["t0"] - a["t1"] < 0.4:
        a["t1"] = round(b["t0"] - 0.4, 4)

GAUGE = {"rise": [B["toscale"]["t0"] + 0.1, B["toscale"]["t0"] + 1.0], "sc": CUE["thousand"] - 0.4, "paper": CUE["paper"],
         "back": [B["takeaway"]["t0"] - 0.5, B["takeaway"]["t0"] + 0.4], "sc_um": GAP_UM, "paper_um": PAPER_UM, "bar": "gap",
         "sc_text": "≈ 50 nm"}
# the junction's states, on the words
J = {"puff": [CUE["messenger"], CUE["messenger"] + 1.6], "pull": [CUE["pulls"] - 0.1, CUE["crease"] + 0.4], "open": [B["change"]["t0"] + 0.4, CUE["slips"]],
     "toxin": [CUE["slips"] - 0.2, CUE["cuts"]], "cut": [CUE["cuts"], CUE["cuts"] + 0.5], "release": [CUE["ready"] - 0.1, CUE["leaves"] + 0.6],
     "sprout": [CUE["nerve2"] - 0.6, CUE["endings"] + 0.6], "relight": [CUE["endings"] - 0.1, CUE["endings"] + 1.7], "relax": [B["toscale"]["t0"], CUE["endings"]]}

TITLE = {"series": "Outer Layer · No. 004", "title": "The deadliest *dose*", "t1": B["normal"]["t0"] - 0.5, "sig": A("vo01:frown?", 0.35)}
END = {"title": "Next layer: same sun, one experiment. Which hand *aged*?", "follow": "Outer Layer · No. 005",
       "next": "Alan Scott first injected it to treat crossed eyes (1980); Jean and Alastair Carruthers reported frown lines in 1992. Narration: synthetic voice (AI)."}
POSTER = A("vo05:kill", 0.6)

glue(f, {"vo01": ["in a frown?", "by the nanogram."], "vo02": ["a nerve ending,", "a chemical messenger", "the muscle below."],
         "vo03": ["Botulinum toxin", "the nerve ending", "one small protein", "never leaves."], "vo04": ["Two centuries ago,", "Justinus Kerner", "spoiled sausages."],
         "vo05": ["well under a hundredth", "to kill a person."], "vo06": ["two thousand times", "a sheet of paper."],
         "vo07": ["Poison in a frown:", "new endings."], "vo08": ["one experiment.", "Which hand aged?"]})
CAPS = hold(f, keep_units(f.captions(max_chars=24)))

film = {
    "id": ID, "fps": FPS, "bpm": BPM, "dur": f.duration, "poster": POSTER,
    "shots": SHOTS, "beats": BEATS, "tone": TONE, "trans": [],
    "bio": {"jx": JX, "ux": UX, "paper_um": PAPER_UM, "gap_um": GAP_UM},
    "cam": CAM, "cue": CUE, "gauge": GAUGE, "j": J, "plates": PLATES,
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
    ev.append({"t": L["t0"], "kind": "label", "tag": L["id"]})
for c in COUNTERS:
    ev.append({"t": c["t0"], "kind": "counter.show", "tag": c["id"]})
for b in BADGES:
    if b["t0"] > 0:
        ev.append({"t": b["t0"], "kind": "badge", "tag": b["id"]})
ev += [
    {"t": CUE["nerve"], "kind": "scale.jump", "tag": "below"},
    {"t": J["puff"][0], "kind": "diffuse", "tag": "messenger"},
    {"t": J["cut"][0], "kind": "zap", "tag": "cut"},
    {"t": B["why"]["t0"], "kind": "scale.jump", "tag": "rise"},
    {"t": PLATES["kerner"]["t0"], "kind": "reveal", "tag": "kerner"},
    {"t": B["whoa"]["t0"], "kind": "cell.land", "tag": "shutter"},
    {"t": B["whoa"]["t0"], "kind": "swell", "tag": "whoa", "t1": B["whoa"]["t1"]},
    {"t": PLATES["dose"]["kill"], "kind": "reveal", "tag": "dose"},
    {"t": B["toscale"]["t0"], "kind": "scale.jump", "tag": "back-below"},
    {"t": GAUGE["sc"], "kind": "scale", "tag": "g-gap"},
    {"t": GAUGE["paper"], "kind": "reveal", "tag": "g-paper"},
    {"t": J["sprout"][0], "kind": "cell.land", "tag": "sprout"},
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
