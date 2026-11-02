"""Compile Outer Layer No. 004, "The deadliest dose", in the approved look (look test 2, 2 Nov): script + voice
timings + this direction → film.json (the scene's clock: shots, cues, labels, notes, plates, gauge, captions, title
and end card) and sheet.json (the studio's cue sheet). Nothing here is a hand-typed time: every moment hangs on a
beat or a spoken word (kits/cinema/script/timeline.py anchors), and every number on screen comes from claims.json.

  python3 -I films/channels/skincare/ep04/compile.py

Four hero shots, one subject filling the frame and one slow move each (review/storyboard.md):
  brow   the frown as a skin macro in studio light (../set/brow04.js restyled with studio.js's skinMaterial)
  nmj    the neuromuscular junction at cell scale: the nerve ending, its cyan messenger, the muscle fibre, the toxin
  cut    the micrograph cut face below the skin (set/ref SECTION, public domain), for "never touches the skin"
  dose   the brow again; the UV scan sweeps down on "twenty" and the dose plate sets 20 against ≈ 3,000
Places (one scene, far apart, never in one frame): the brow at x = 0, the junction at x = 500, the cut face at x = 1000.
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
FROWN_U = 20            # c8: the labelled frown-line dose, 20 units
LETHAL_U = 3000         # c9: estimated human LD50 ≈ 3,000 units for a 70 kg adult (extrapolated from primates)
GAP_UM = 0.05           # c10: the synaptic cleft ≈ 50 nm
PAPER_UM = 100.0        # c11: 80 gsm copy paper ≈ 100 µm
PCT = 100 * FROWN_U / LETHAL_U
assert 0.5 < PCT < 1.0, "under a hundredth"
assert 1500 <= PAPER_UM / GAP_UM <= 2500, "about two thousand times thinner"
TONE = "light"          # bible §1: one melanin level per episode (004: light)

# ── the words the picture hangs on ───────────────────────────────────────
t_end = A("vo08:Next:", -0.25)
CUE = {
    "frown": A("vo01:frown?"), "banknote": A("vo01:banknote's"), "million": A("vo01:million."),
    "every": A("vo02:Every"), "nerve": A("vo02:nerve"), "messenger": A("vo02:messenger"), "muscle": A("vo02:muscle"),
    "pulls": A("vo02:pulls,"), "skin": A("vo02:skin"), "folds": A("vo02:folds"), "crease": A("vo02:crease."),
    "botulinum": A("vo03:Botulinum"), "touches": A("vo03:touches"), "slips": A("vo03:slips"), "cuts": A("vo03:cuts"),
    "needs": A("vo03:needs,"), "waits": A("vo03:waits,"), "leaves": A("vo03:leaves."),
    "justinus": A("vo04:Justinus"), "paralysis": A("vo04:paralysis"), "sausages": A("vo04:sausages,"), "guessed": A("vo04:guessed"),
    "medicine": A("vo04:medicine."),
    "units": A("vo05:units,"), "mice": A("vo05:mice."), "one": A("vo05:One"), "twenty": A("vo05:twenty,"), "hundredth": A("vo05:hundredth"),
    "kill": A("vo05:kill"), "person": A("vo05:person."),
    "gap": A("vo06:gap"), "thousand": A("vo06:thousand"), "paper": A("vo06:paper."),
    "silenced": A("vo07:silenced,"), "months": A("vo07:months"), "grows": A("vo07:grows"), "endings": A("vo07:endings,"),
    "then": A("vo07:then"), "prunes": A("vo07:prunes"), "away": A("vo07:away."),
}

# ── the hero shots; every cut on a word ─────────────────────────────────
SHOTS = [
    {"at": 0.0, "name": "brow"},                         # hook: the frown, a skin macro, one slow push into the "11"
    {"at": CUE["nerve"], "name": "nmj"},                 # the scale jump below: the nerve ending on the muscle
    {"at": CUE["skin"], "name": "brow2"},                # "the skin above folds into a crease": the brow, the frown setting
    {"at": CUE["botulinum"], "name": "cut"},             # "never touches the skin": the stained cut face, the push down past it
    {"at": CUE["slips"], "name": "nmj2"},                # inside the nerve ending: the toxin, the cut, the message waits
    {"at": B["why"]["t0"], "name": "kerner"},            # the brow, pulled back, Kerner's plate; the frown goes slack on "paralysis"
    {"at": CUE["guessed"], "name": "nmj3"},              # back to the silenced ending, the plate's second line
    {"at": B["whoa"]["t0"], "name": "dose"},             # the brow; the UV scan on "twenty"; the dose plate
    {"at": B["toscale"]["t0"], "name": "gap"},           # the cleft, the gauge lifted
    {"at": B["takeaway"]["t0"], "name": "regrow"},       # the spare endings grow, then are pruned
    {"at": A("vo07:away.", 0.45), "name": "close"},      # the brow, the crease returning, under the end card (the loop)
]
SH = {s["name"]: s["at"] for s in SHOTS}
NEXT = {a["name"]: b["at"] for a, b in zip(SHOTS, SHOTS[1:])}
NEXT["close"] = f.duration

# the scene's states, on the words (the junction's and the brow's)
J = {"puff": [CUE["messenger"], CUE["messenger"] + 1.8], "pull": [CUE["pulls"] - 0.1, CUE["pulls"] + 0.9],
     "toxin": [CUE["slips"], CUE["slips"] + 1.4], "cut": [CUE["cuts"], CUE["cuts"] + 0.6],
     "bump": [CUE["waits"] - 0.2, CUE["leaves"] + 0.7], "bump2": [CUE["guessed"] + 0.4, B["whoa"]["t0"] - 0.3],
     "relight": [CUE["silenced"] - 0.4, CUE["silenced"] + 0.3], "sprout": [CUE["grows"], CUE["endings"] + 0.4],
     "prune": [CUE["then"], CUE["away"] + 0.35], "puff2": [CUE["prunes"], CUE["away"] + 0.4]}
BROW = {"frown": [CUE["frown"] - 0.1, CUE["frown"] + 0.9], "fold": [CUE["folds"] - 0.2, CUE["crease"] + 0.4],
        "slack": [CUE["paralysis"], CUE["paralysis"] + 1.2], "close": [SH["close"] + 0.2, SH["close"] + 1.4]}
SCAN = {"sweep": [CUE["twenty"] - 0.05, CUE["twenty"] + 0.75]}   # the signature UV switch, on the key fact

# ── the overlay: at most two labels at once; honesty notes small, in a corner ──
TITLE = {"series": "Outer Layer · No. 004", "title": "The deadliest *dose*", "t1": A("vo01:theory,", -0.2), "sig": A("vo01:frown?", 0.35)}
LABELS = [
    {"id": "l-nerve", "text": "nerve ending", "kind": "cell", "anchor": "bulb", "t0": CUE["nerve"] + 0.4, "t1": CUE["muscle"], "shot": "nmj", "side": -1, "v": "above"},
    {"id": "l-ach", "text": "acetylcholine", "kind": "water", "anchor": "gap", "t0": CUE["messenger"] + 0.15, "t1": CUE["skin"], "shot": "nmj", "side": 1, "v": "below"},
    {"id": "l-snap", "text": "SNAP-25", "kind": "water", "anchor": "snap", "t0": CUE["cuts"] + 0.3, "t1": B["why"]["t0"], "shot": "nmj2", "side": 1, "v": "below"},
]
BADGES = [
    {"id": "b-model", "text": "model, not a photo", "t0": TITLE["t1"] + 0.1, "t1": CUE["nerve"], "slot": "tr"},
    {"id": "b-gram", "text": "≈ 1 g, inhaled and evenly dispersed", "t0": CUE["banknote"], "t1": CUE["nerve"], "slot": "tl"},
    {"id": "b-jama", "text": "theoretical (JAMA 2001)", "t0": CUE["banknote"] + 0.15, "t1": CUE["nerve"], "slot": "tl"},
    {"id": "b-simp", "text": "simplified · not to scale", "t0": CUE["nerve"] + 0.3, "t1": CUE["skin"], "slot": "tl"},
    {"id": "b-model2", "text": "model, not a photo", "t0": CUE["skin"] + 0.2, "t1": CUE["botulinum"], "slot": "tl"},
    {"id": "b-micro", "text": "micrograph · stained skin", "t0": CUE["botulinum"] + 0.25, "t1": CUE["slips"], "slot": "tl"},
    {"id": "b-illus", "text": "illustration", "t0": CUE["slips"] + 0.3, "t1": B["why"]["t0"], "slot": "tl"},
    {"id": "b-model3", "text": "model, not a photo", "t0": B["why"]["t0"] + 0.3, "t1": CUE["guessed"], "slot": "tl"},
    {"id": "b-illus2", "text": "illustration", "t0": CUE["guessed"] + 0.3, "t1": B["whoa"]["t0"], "slot": "tl"},
    {"id": "b-unit", "text": "1 unit = the dose that kills", "t0": CUE["units"], "t1": B["toscale"]["t0"], "slot": "tl"},
    {"id": "b-unit2", "text": "half a group of mice", "t0": CUE["units"] + 0.15, "t1": B["toscale"]["t0"], "slot": "tl"},
    {"id": "b-uv", "text": "illustration", "t0": SCAN["sweep"][1], "t1": B["toscale"]["t0"], "slot": "tr"},
    {"id": "b-gap", "text": "≈ 50 nm, varies by site · simplified", "t0": B["toscale"]["t0"] + 0.3, "t1": B["takeaway"]["t0"], "slot": "tl"},
    {"id": "b-months", "text": "≈ 3–4 months, time compressed", "t0": B["takeaway"]["t0"] + 0.3, "t1": SH["close"], "slot": "tl"},
    {"id": "b-mice", "text": "mouse studies; in people, debated", "t0": CUE["grows"] - 0.2, "t1": SH["close"], "slot": "tl"},
    {"id": "b-model4", "text": "model, not a photo", "t0": SH["close"] + 0.3, "t1": t_end, "slot": "tl"},
]
# the spine readout: the payoff's number, held lit from the takeaway to the end card (after the gauge, which owns the top)
COUNTERS = [{"id": "c-dose", "label": "one frown, of a lethal dose", "fmt": "text", "text": "< 1 %", "t0": B["takeaway"]["t0"] + 0.9, "t1": t_end - 0.4, "at": [0.5, 0.21]}]
PLATES = {
    "kerner": {"t0": CUE["justinus"] - 0.2, "t1": B["whoa"]["t0"] - 0.3, "sausages": CUE["sausages"] - 0.1, "guessed": CUE["guessed"],
               "name": "Justinus Kerner", "role": "physician, Württemberg · 1820", "line1": "1817–1822: “sausage poison” described",
               "line2": "proposed it might one day treat illness"},
    "dose": {"t0": CUE["twenty"] - 0.3, "t1": B["toscale"]["t0"] - 0.3, "frown": CUE["twenty"], "kill": CUE["kill"],
             "frown_u": FROWN_U, "lethal_u": LETHAL_U},
}
CUTS = [sh["at"] for sh in SHOTS[1:]]


def before_cut(t1, lead=0.3):            # faded out before a cut, so nothing of one shot sits on the next
    return round(t1 - lead, 4) if any(abs(t1 - c) < 1e-6 for c in CUTS) else t1


for row in BADGES + LABELS:
    row["t1"] = before_cut(row["t1"])

GAUGE = {"rise": [B["toscale"]["t0"] + 0.1, B["toscale"]["t0"] + 1.0], "sc": CUE["gap"], "paper": CUE["paper"] - 0.6,
         "back": [B["takeaway"]["t0"] + 0.1, B["takeaway"]["t0"] + 0.8], "sc_um": GAP_UM, "paper_um": PAPER_UM, "bar": "gap",
         "sc_text": "≈ 50 nm"}
END = {"title": "Next layer: same sun, one experiment. Which hand *aged*?", "follow": "Outer Layer · No. 005",
       "next": "Alan Scott first injected it into eye muscles to treat strabismus (1980); Jean and Alastair Carruthers reported frown lines in 1992. Narration: synthetic voice (AI)."}
POSTER = A("vo05:kill", 0.8)

glue(f, {"vo01": ["in a frown?", "a banknote's weight", "kill a million."], "vo02": ["a nerve ending,", "a chemical messenger", "the muscle below."],
         "vo03": ["Botulinum toxin", "the nerve ending", "one protein", "never leaves."],
         "vo04": ["Two centuries ago", "Justinus Kerner,", "a deadly paralysis", "spoiled sausages,", "become a medicine."],
         "vo05": ["counted in units,", "a hundredth", "kill a person."], "vo06": ["two thousand times", "a sheet of paper."],
         "vo07": ["Poison in a frown:", "one message silenced,", "months later", "spare endings,"], "vo08": ["one experiment.", "Which hand aged?"]})
CAPS = hold(f, keep_units(f.captions(max_chars=24)))

film = {
    "id": ID, "fps": FPS, "bpm": BPM, "dur": f.duration, "poster": POSTER,
    "shots": SHOTS, "next": NEXT, "beats": BEATS, "tone": TONE, "trans": [],
    "bio": {"paper_um": PAPER_UM, "gap_um": GAP_UM},
    "cue": CUE, "gauge": GAUGE, "j": J, "brow": BROW, "scan": SCAN, "plates": PLATES,
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
    {"t": SH["nmj"], "kind": "scale.jump", "tag": "below"},
    {"t": J["puff"][0], "kind": "diffuse", "tag": "messenger"},
    {"t": SH["cut"], "kind": "scale.jump", "tag": "cutface"},
    {"t": SH["nmj2"], "kind": "scale.jump", "tag": "inside"},
    {"t": J["cut"][0], "kind": "zap", "tag": "cut"},
    {"t": PLATES["kerner"]["t0"], "kind": "reveal", "tag": "kerner"},
    {"t": B["whoa"]["t0"], "kind": "swell", "tag": "whoa", "t1": B["whoa"]["t1"]},
    {"t": SCAN["sweep"][0], "kind": "cell.land", "tag": "scan"},
    {"t": PLATES["dose"]["kill"], "kind": "reveal", "tag": "dose"},
    {"t": SH["gap"], "kind": "scale.jump", "tag": "back-below"},
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
print(f"film.json: {f.duration:.2f} s, {len(SHOTS)} shots, {len(LABELS)} labels, {len(BADGES)} notes, {len(CAPS)} caption pages, end card {t_end:.2f} s")
print("  shots " + " · ".join(f"{s['name']} {s['at']:.2f}" for s in SHOTS))
print(f"sheet.json: {len(sheet['events'])} events" + (f", {len(shown)} shown times from the picture" if shown else ""))
for pg in CAPS:
    print(f"  {pg['t0']:6.2f}–{pg['t1']:6.2f}  " + " / ".join(" ".join(w for w, _ in r).replace(" ", " ") for r in pg["lines"]))
