"""Compile Skin Sense No. 005, "The sunscreen experiment", in the approved look (look test 2, 2 Nov): script +
voice timings + this direction → film.json and sheet.json. Every moment hangs on a beat or a spoken word; every
number on screen comes from claims.json. The ageing trial is 4.5 years and the screen says so (bible §1).

  python3 -I films/channels/skincare/ep05/compile.py

Three hero places, far apart in one scene (scene.mjs; s1v2/BUILD-LOOK2.md):
  x = 0      the sunscreen macro (looktest2): one patch of medium-tone skin, the left half under a thin film of
             sunscreen, the right bare; the UV switch (a cyan scan line) turns the screened half dark and the bare half
             lilac with the damage the eye misses (an illustration, not trial data). Also the to-scale shot (the film,
             grazing, with the gauge) and the loop.
  x = 500    the silicone cast of the skin's lines (grey, no hairs), raking light; the lines deepen ("4.5 years").
  x = 1000   the dermis block, its cut face the stained micrograph (set/ref), for the ten-year melanoma tally.
The model hands (../set/hands05.js) and the town (../set/town05.js) are retired from this episode (coordinator, 2 Nov).
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
ID = "skin-sense-005"
f = Film(HERE / "script.md", HERE / "vo", fps=FPS, bpm=BPM)
plan, end_hold = f.script_plan()
BEATS = f.layout(plan, end_hold=end_hold)
A = f.at
B = {b["id"]: b for b in BEATS}

# ── the numbers (claims.json) ───────────────────────────────────────────────
START, AGE_END, FOLLOW_END = 1992, 1996, 2006     # c1, c4, c7
AGE_YEARS = 4.5                                   # c4, c5: the ageing measurement, 4.5 years (not ten)
OR, OR_CI = 0.76, (0.59, 0.98)                    # c5: relative odds of increased ageing, daily vs discretionary
MEL = (11, 22)                                    # c9: primary melanomas, daily vs discretionary, ten years after
HR, HR_CI = 0.50, (0.24, 1.02)                    # c9: not quite significant (P = .051)
FILM_UM, PAPER_UM = 20.0, 100.0                   # c10: the test dose's film ≈ 20 µm (computed); paper ≈ 100 µm
assert abs((1 - OR) - 0.24) < 1e-9 and MEL[1] == 2 * MEL[0] and HR_CI[1] > 1.0
TONE = "medium"         # bible §1: 005 is drawn in the medium tone

# ── the words the picture hangs on ──────────────────────────────────────────
t_end = A("vo08:Next:", -0.25)
CUE = {
    "aged": A("vo01:aged?"), "four": A("vo01:four"), "one": A("vo01:one"),
    "nambour": A("vo02:Nambour,"), "chance": A("vo02:chance"), "morning": A("vo02:morning."), "head": A("vo02:Head,"),
    "none": A("vo03:none:"), "others": A("vo03:others"), "pleased": A("vo03:pleased,"), "all": A("vo03:all."),
    "researchers": A("vo03:Researchers"), "lines": A("vo03:lines"), "casts": A("vo03:casts"),
    "burn": A("vo04:burn"), "but": A("vo04:But"), "camera": A("vo04:camera"), "misses": A("vo04:misses,"), "surface": A("vo04:surface."),
    "followed": A("vo05:followed"), "ten": A("vo05:ten"), "melanoma": A("vo05:Melanoma,"), "half": A("vo05:half,"), "small": A("vo05:small"),
    "dose": A("vo06:dose,"), "fifth": A("vo06:fifth"), "paper": A("vo06:paper's"),
    "which": A("vo07:which"), "both": A("vo07:Both"), "fewer": A("vo07:fewer,"), "skin": A("vo07:skin"), "count": A("vo07:count."),
}

# ── shots: three hero places (the macro, the cast, the micrograph), each with one slow move per setup ──
SHOTS = [{"at": 0.0, "name": "hook"},                         # the macro, daylight: a slow push over the seam
         {"at": B["normal"]["t0"], "name": "seam"},           # the macro: a long crane along the seam, a dust shaft
         {"at": B["change"]["t0"], "name": "pleased"},        # the macro, close on the bare half: patches come and go
         {"at": CUE["researchers"] - 0.1, "name": "cast"},    # the silicone cast, raking light; the lines deepen
         {"at": B["why"]["t0"], "name": "uv"},                # the macro: a warm flush, then the UV switch on "But"
         {"at": B["whoa"]["t0"], "name": "micro"},            # the micrograph cut face, a slow push into the dermis
         {"at": B["toscale"]["t0"], "name": "film"},          # the macro, grazing: the film on the screened half
         {"at": B["takeaway"]["t0"], "name": "loop"}]         # the hook's framing; the UV switch on "skin"
SH = {s["name"]: s["at"] for s in SHOTS}
nxt = {a["name"]: b["at"] for a, b in zip(SHOTS, SHOTS[1:])}
nxt["loop"] = f.duration
MOVE = {k: [round(SH[k], 4), round(nxt[k], 4)] for k in SH}   # each setup's one slow move spans the shot

# the UV switches: the scan line sweeps down the frame over 0.8 s from the word; the view blends under it
UV = {"uv": [CUE["but"] - 0.05, CUE["but"] + 0.75], "loop": [CUE["skin"] - 0.05, CUE["skin"] + 0.75]}
MACRO = {
    "flush": [B["why"]["t0"] + 0.3, CUE["burn"] + 0.6],          # the burn you feel: a warm flush on the bare half
    "dmg": [CUE["but"] + 0.5, CUE["misses"] + 0.2],              # the hidden freckles darken under UV (illustration)
    "patches": [CUE["others"], CUE["all"] + 0.3],                 # "whenever they pleased, or not at all": sunscreen comes and goes
    "film": [B["toscale"]["t0"] + 0.3, CUE["dose"] + 0.4],        # the morning layer shows as a satin film
    "age": [CUE["researchers"], B["why"]["t0"] - 0.2],           # the cast: the lines deepen on the right ("4.5 years, compressed")
}
RACK = {"hook": [CUE["aged"], CUE["four"]], "micro": [CUE["melanoma"] - 0.6, CUE["melanoma"] + 0.6]}

# ── the overlay: captions carry the words; at most two labels at once; honesty notes small, in a corner ──
LAB_Y = 0.5
LABELS = [
    {"id": "l-daily", "text": "daily", "kind": "water", "t0": CUE["morning"] - 0.2, "t1": CUE["researchers"] - 0.1, "screen": [0.12, LAB_Y], "side": 1},
    {"id": "l-pleased", "text": "as they pleased", "kind": "uv", "t0": CUE["pleased"] - 0.3, "t1": CUE["researchers"] - 0.1, "screen": [0.83, LAB_Y], "side": -1},
    {"id": "l-sun", "text": "sunscreen", "kind": "water", "t0": CUE["camera"], "t1": B["whoa"]["t0"], "screen": [0.12, 0.52], "side": 1},
    {"id": "l-bare", "text": "bare skin", "kind": "uv", "t0": CUE["camera"], "t1": B["whoa"]["t0"], "screen": [0.83, 0.52], "side": -1},
]
BADGES = [
    {"id": "b-model0", "text": "model, not a photo", "t0": 0.0, "t1": B["normal"]["t0"], "slot": "tr"},
    {"id": "b-model", "text": "model, not a photo", "t0": B["normal"]["t0"], "t1": CUE["researchers"] - 0.1, "slot": "tl"},
    {"id": "b-cast", "text": "model · 4.5 years, compressed", "t0": CUE["researchers"] - 0.1, "t1": B["why"]["t0"], "slot": "tl"},
    {"id": "b-burn", "text": "model, not a photo", "t0": B["why"]["t0"], "t1": CUE["but"], "slot": "tl"},
    {"id": "b-uv1", "text": "illustration · not trial data", "t0": CUE["but"], "t1": B["whoa"]["t0"], "slot": "tl"},
    {"id": "b-micro", "text": "micrograph · healthy stained skin", "t0": B["whoa"]["t0"], "t1": B["toscale"]["t0"], "slot": "tl"},
    {"id": "b-est", "text": "estimate · lab test dose", "t0": B["toscale"]["t0"], "t1": B["takeaway"]["t0"], "slot": "tl"},
    {"id": "b-loop", "text": "model, not a photo", "t0": B["takeaway"]["t0"], "t1": CUE["skin"], "slot": "tl"},
    {"id": "b-uv2", "text": "illustration · not trial data", "t0": CUE["skin"], "t1": t_end, "slot": "tl"},
]
SPINE = [0.5, 0.225]
COUNTERS = [
    {"id": "c-start", "label": "Nambour trial begins", "fmt": "text", "text": f"{START}", "t0": CUE["nambour"] - 0.3, "t1": CUE["morning"] - 0.5, "at": SPINE},
    {"id": "c-age", "label": "ageing trial", "fmt": "text", "text": f"{AGE_YEARS:g} years", "t0": CUE["researchers"] + 0.7, "t1": B["why"]["t0"], "at": SPINE},
    {"id": "c-follow", "label": "melanoma followed, to", "fmt": "roll", "text": f"{FOLLOW_END}", "roll": [AGE_END, FOLLOW_END, B["whoa"]["t0"] + 0.7, CUE["ten"] + 1.0],
     "t0": B["whoa"]["t0"] + 0.7, "t1": B["toscale"]["t0"], "at": SPINE},
]
PLATES = {
    "odds": {"t0": CUE["lines"], "t1": B["why"]["t0"], "text": "increased ageing, daily group: about a quarter less likely",
             "sub": f"relative odds {OR:.2f} (95% CI {OR_CI[0]:.2f}–{OR_CI[1]:.2f}) · Hughes et al., 2013"},
    "mel": {"t0": CUE["melanoma"] - 0.3, "t1": B["toscale"]["t0"], "mel": CUE["melanoma"], "half": CUE["half"], "small": CUE["small"],
            "n": list(MEL), "sub": f"{MEL[0]} vs {MEL[1]} · hazard ratio {HR:.2f} (95% CI {HR_CI[0]:.2f}–{HR_CI[1]:.2f})",
            "note": "small numbers · not quite significant · Green et al., 2011"},
}
CUTS = [sh["at"] for sh in SHOTS[1:]]


def before_cut(t1, lead=0.3):
    return round(t1 - lead, 4) if any(abs(t1 - c) < 1e-6 for c in CUTS) or abs(t1 - t_end) < 1e-6 else t1


for row in BADGES + COUNTERS + LABELS:
    row["t1"] = before_cut(row["t1"])
for k in PLATES.values():
    k["t1"] = before_cut(k["t1"])

GAUGE = {"rise": [B["toscale"]["t0"] + 0.4, B["toscale"]["t0"] + 1.3], "sc": CUE["fifth"] - 0.3, "paper": CUE["paper"],
         "back": [B["takeaway"]["t0"] - 0.6, B["takeaway"]["t0"] - 0.1], "sc_um": FILM_UM, "paper_um": PAPER_UM, "bar": "film", "sc_text": "≈ 20 µm"}

TITLE = {"series": "Skin Sense · No. 005", "title": "The sunscreen *experiment*", "t1": B["normal"]["t0"] - 0.4, "sig": A("vo01:aged?", 0.35)}
END = {"title": "Next: tanning beds and cigarettes. Same list, same *risk*?", "follow": "Skin Sense · No. 006",
       "next": "Nambour Skin Cancer Prevention Trial, Queensland: sunscreen 1992–96 (ageing measured over 4.5 years); melanoma followed to 2006. Narration: synthetic voice (AI)."}
POSTER = A("vo07:count.", 0.3)

glue(f, {"vo01": ["Which hand aged?", "four and a half years,", "no detectable ageing."], "vo02": ["in Nambour,", "a Queensland town", "every morning."],
         "vo03": ["against none:", "not at all.", "silicone casts"], "vo04": ["the burn you feel.", "an ultraviolet camera", "the naked eye"],
         "vo05": ["ten more years.", "skin cancer,", "about half,", "to be sure."], "vo06": ["a lab's test dose,", "a fifth of a paper's"],
         "vo07": ["which hand aged?", "kept count."], "vo08": ["tanning beds", "with cigarettes.", "same risk?"]})
CAPS = hold(f, keep_units(f.captions(max_chars=24)))

film = {
    "id": ID, "fps": FPS, "bpm": BPM, "dur": f.duration, "poster": POSTER,
    "shots": SHOTS, "beats": BEATS, "tone": TONE, "trans": [],
    "bio": {"paper_um": PAPER_UM, "film_um": FILM_UM},
    "move": MOVE, "uv": UV, "macro": MACRO, "rack": RACK, "cue": CUE, "gauge": GAUGE, "plates": PLATES,
    "labels": LABELS, "badges": BADGES, "counters": COUNTERS, "pills": [],
    "title": TITLE, "endCard": t_end, "end": END,
    "captions": CAPS,
    "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines],
}

# ── the cue sheet: the picture's events for the sound ──
ev = [{"t": b["t0"], "kind": "section", "id": b["id"], "t1": b["t1"]} for b in BEATS]
ev.append({"t": TITLE["sig"], "kind": "signature", "tag": "title"})
ev.append({"t": t_end, "kind": "signature", "tag": "end"})
hits = [
    {"t": UV["uv"][0], "kind": "cell.land", "tag": "scan-1"},
    {"t": UV["loop"][0], "kind": "cell.land", "tag": "scan-2"},
    {"t": SH["cast"], "kind": "scale.jump", "tag": "down-to-cast"},
    {"t": SH["micro"], "kind": "scale.jump", "tag": "into-dermis"},
    {"t": SH["film"], "kind": "scale.jump", "tag": "up-to-film"},
    {"t": B["whoa"]["t0"], "kind": "swell", "tag": "whoa", "t1": B["whoa"]["t1"]},
    {"t": PLATES["mel"]["half"], "kind": "reveal", "tag": "half"},
    {"t": GAUGE["sc"], "kind": "scale", "tag": "g-film"},
    {"t": GAUGE["paper"], "kind": "reveal", "tag": "g-paper"},
]
ev += hits
taken = [e["t"] for e in hits if e["kind"] != "swell"] + [TITLE["sig"], t_end]
for L in LABELS:
    ev.append({"t": L["t0"], "kind": "label", "tag": L["id"]})
for c in COUNTERS:
    ev.append({"t": c["t0"], "kind": "counter.show", "tag": c["id"]})
for b in BADGES:   # a badge that arrives with a stronger sound (a scan, a cut) stays silent: two sounds within 0.6 s blur the sync
    if b["t0"] > 0 and all(abs(b["t0"] - x) > 0.6 for x in taken + [L["t0"] for L in LABELS] + [c["t0"] for c in COUNTERS]):
        ev.append({"t": b["t0"], "kind": "badge", "tag": b["id"]})
snd = sorted(e["t"] for e in ev if e["kind"] not in ("section", "swell"))
close = [(a, b) for a, b in zip(snd, snd[1:]) if 1e-6 < b - a < 0.6]
assert not close, f"sounds closer than 0.6 s: {close}"

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
print(f"film.json: {f.duration:.2f} s, {len(SHOTS)} shots, {len(LABELS)} labels, "
      f"{len(BADGES)} badges, {len(COUNTERS)} counters, {len(CAPS)} caption pages, end card {t_end:.2f} s")
print("  shots " + " · ".join(f"{s['name']} {s['at']:.2f}" for s in SHOTS))
print(f"sheet.json: {len(sheet['events'])} events" + (f", {len(shown)} shown times from the picture" if shown else ""))
