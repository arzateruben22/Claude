"""Compile Outer Layer No. 005, "The sunscreen experiment" (the reboot's look: UV camera + macro flight): script +
voice timings + this direction → film.json and sheet.json. Every moment hangs on a beat or a spoken word; every
number on screen comes from claims.json. The ageing trial is 4.5 years and the screen says so (bible §1).

  python3 -I films/channels/skincare/ep05/compile.py

Places (one scene, far apart): the hand (the macro terrain, x = 0: a seam down the middle, two neighbours' skin as two
halves of one model), the town (../set/town05.js, x = −4000, a model of the trial's households, not a map), and the
hand through the 365 nm camera (x = +4000).
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
ID = "outerlayer-005"
f = Film(HERE / "script.md", HERE / "vo", fps=FPS, bpm=BPM)
plan, end_hold = f.script_plan()
BEATS = f.layout(plan, end_hold=end_hold)
A = f.at
B = {b["id"]: b for b in BEATS}

# ── the numbers (claims.json) ───────────────────────────────────────────────
START, AGE_END, FOLLOW_END = 1992, 1996, 2006     # c1, c3, c7
AGE_YEARS = 4.5                                   # c3, c5: the ageing measurement, 4.5 years (not ten)
OR, OR_CI = 0.76, (0.59, 0.98)                    # c5: relative odds of increased ageing, daily vs discretionary
MEL = (11, 22)                                    # c9: primary melanomas, daily vs discretionary, ten years after
HR, HR_CI = 0.50, (0.24, 1.02)                    # c9: not quite significant (P = .051)
FILM_UM, PAPER_UM = 20.0, 100.0                   # c10: the test dose's film ≈ 20 µm (computed); paper ≈ 100 µm
assert abs((1 - OR) - 0.24) < 1e-9 and MEL[1] == 2 * MEL[0] and HR_CI[1] > 1.0
TONE = "medium"         # bible §1: 005 is drawn in the medium tone

# ── shots ─────────────────────────────────────────────────────────────────
t_end = A("vo08:Next:", -0.25)
CUE = {
    "aged": A("vo01:aged?"), "both": A("vo01:Both"), "sun": A("vo01:sun."),
    "nineties": A("vo02:nineties,"), "nambour": A("vo02:Nambour,"), "chance": A("vo02:chance"), "morning": A("vo02:morning."),
    "head": A("vo02:head,"), "pleased": A("vo02:pleased."),
    "casts": A("vo03:casts"), "four": A("vo03:four"), "daily": A("vo03:daily"), "increase": A("vo03:increase"),
    "burn": A("vo04:burn"), "but4": A("vo04:But"), "camera": A("vo04:camera"), "misses": A("vo04:misses,"), "surface": A("vo04:surface."),
    "watched": A("vo05:watched"), "ten": A("vo05:ten"), "squamous": A("vo05:Squamous"), "lower": A("vo05:lower,"), "melanoma": A("vo05:melanoma"),
    "half": A("vo05:half,"), "small": A("vo05:small"),
    "dose": A("vo06:dose,"), "fifth": A("vo06:fifth"), "paper": A("vo06:paper's"),
    "which": A("vo07:which"), "eye": A("vo07:eye"), "but": A("vo07:but"), "record": A("vo07:record."),
}
SHOTS = [{"at": 0.0, "name": "hand"}, {"at": B["normal"]["t0"], "name": "town"}, {"at": B["change"]["t0"], "name": "cast"},
         {"at": B["why"]["t0"], "name": "burn"}, {"at": CUE["but4"] - 0.1, "name": "uv1"}, {"at": B["whoa"]["t0"], "name": "town2"}, {"at": B["toscale"]["t0"], "name": "gauge"},
         {"at": CUE["but"] - 0.1, "name": "uv2"}, {"at": B["tease"]["t0"], "name": "close"}]

# ── the camera ──
TX, UX = -4000.0, 4000.0
FLY = {"el": 13, "fov": 34, "fx": 0.5, "fy": 0.46}
UVK = {"target": [UX, 0.1, 0], "el": 2, "az": 0, "fov": 30, "fx": 0.5, "fy": 0.43}
CAM = {
    "hand": [{"t": 0.0, "target": [0, -0.4, 16], "dist": 24, "az": -4, **FLY},
             {"t": CUE["sun"], "target": [0, -0.4, 10], "dist": 22, "az": -2, **FLY, "ease": "sine"},
             {"t": B["normal"]["t0"], "target": [0, -0.4, 8], "dist": 40, "el": 40, "az": 0, "fov": 34, "fx": 0.5, "fy": 0.46, "ease": "in2"}],
    # up and out over the town; on "chance" the households split, on "morning" the daily group lights
    "town": [{"t": B["normal"]["t0"], "target": [TX, 0, 0], "dist": 34, "el": 80, "az": -10, "fov": 34, "fx": 0.5, "fy": 0.44},   # still rising: close over one roof, pulling up
             {"t": CUE["chance"], "target": [TX, 0, 0], "dist": 210, "el": 46, "az": -4, "fov": 34, "fx": 0.5, "fy": 0.44, "ease": "out3"},
             {"t": CUE["morning"], "target": [TX - 10, 0, 6], "dist": 170, "el": 40, "az": 4, "fov": 34, "fx": 0.5, "fy": 0.44, "ease": "inout2"},
             {"t": B["change"]["t0"], "target": [TX - 10, 0, 6], "dist": 70, "el": 62, "az": 8, "fov": 34, "fx": 0.5, "fy": 0.44, "ease": "in2"}],
    # back down to the hand as its silicone cast, both halves in frame, the seam vertical
    "cast": [{"t": B["change"]["t0"], "target": [0, -0.4, 4], "dist": 16, "el": 50, "az": 0, "fov": 34, "fx": 0.5, "fy": 0.44},
             {"t": CUE["casts"], "target": [0, -0.4, 4], "dist": 30, "el": 40, "az": 0, "fov": 34, "fx": 0.5, "fy": 0.44},
             {"t": B["why"]["t0"], "target": [0, -0.4, 3], "dist": 26, "el": 44, "az": 2, "fov": 34, "fx": 0.5, "fy": 0.44, "ease": "sine"}],
    # the burn you feel: the visible hand, a warm flush rising (the eye's view), then the shutter to UV on "But"
    "burn": [{"t": B["why"]["t0"], "target": [3, -0.4, 6], "dist": 22, "el": 24, "az": 4, "fov": 34, "fx": 0.5, "fy": 0.46},
             {"t": CUE["but4"] - 0.1, "target": [3, -0.4, 4], "dist": 18, "el": 26, "az": 2, "fov": 34, "fx": 0.5, "fy": 0.46, "ease": "sine"}],
    "uv1": [{"t": CUE["but4"] - 0.1, **UVK, "dist": 27}, {"t": CUE["camera"], **UVK, "dist": 25, "ease": "inout2"},
            {"t": CUE["misses"], **{**UVK, "target": [UX + 0.9, 0.1, 0]}, "dist": 21, "ease": "inout2"},
            {"t": CUE["surface"], **{**UVK, "target": [UX - 0.4, 0.1, 0]}, "dist": 25, "ease": "inout2"},
            {"t": B["whoa"]["t0"], **UVK, "dist": 27, "ease": "sine"}],
    "town2": [{"t": B["whoa"]["t0"], "target": [TX, 0, 0], "dist": 240, "el": 52, "az": 8, "fov": 34, "fx": 0.5, "fy": 0.3},
              {"t": CUE["ten"], "target": [TX, 0, 0], "dist": 225, "el": 52, "az": 11, "fov": 34, "fx": 0.5, "fy": 0.3, "ease": "inout2"},
              {"t": CUE["half"], "target": [TX, 0, 0], "dist": 150, "el": 48, "az": 14, "fov": 34, "fx": 0.5, "fy": 0.3, "ease": "inout2"},
              {"t": B["toscale"]["t0"], "target": [TX, 0, 0], "dist": 215, "el": 54, "az": 20, "fov": 34, "fx": 0.5, "fy": 0.3, "ease": "sine"}],
    "gauge": [{"t": B["toscale"]["t0"], "target": [-3, -0.4, 6], "dist": 20, "el": 24, "az": -8, "fov": 34, "fx": 0.5, "fy": 0.7},
              {"t": B["takeaway"]["t0"] - 0.4, "target": [-3, -0.4, 4], "dist": 19, "el": 26, "az": -4, "fov": 34, "fx": 0.5, "fy": 0.7, "ease": "sine"},
              {"t": B["takeaway"]["t0"] + 1.2, "target": [0, -0.4, 16], "dist": 24, "az": -4, **FLY, "ease": "inout2"},   # no cut: on to the hook's framing for "which hand aged?"
              {"t": CUE["but"] - 0.1, "target": [0, -0.4, 13], "dist": 23, "az": -3, **FLY, "ease": "sine"}],
    "uv2": [{"t": CUE["but"] - 0.1, **UVK, "dist": 24}, {"t": B["tease"]["t0"], **UVK, "dist": 22, "ease": "sine"}],
    "close": [{"t": B["tease"]["t0"], "target": [0, -0.4, 18], "dist": 25, "az": -6, **FLY},
              {"t": B["tease"]["t1"], "target": [0, -0.4, 14], "dist": 24, "az": -4, **FLY, "ease": "sine"}],
}
for shot, keys in CAM.items():
    for a, b in zip(keys, keys[1:]):
        rate = abs(b["az"] - a["az"]) / max(1e-6, b["t"] - a["t"])
        assert rate <= 6.0 + 1e-9, f"{shot}: az turns {rate:.2f}°/s"

# ── the overlay ─────────────────────────────────────────────────────────────
LABELS = [
    {"id": "l-a", "text": "one neighbour's skin", "kind": "cell", "anchor": "halfL", "t0": 0.3, "t1": B["normal"]["t0"] - 0.6, "shot": "hand", "side": -1, "v": "above", "fixed": True},
    {"id": "l-b", "text": "the other's", "kind": "cell", "anchor": "halfR", "t0": 0.3, "t1": B["normal"]["t0"] - 0.6, "shot": "hand", "side": 1, "v": "above", "fixed": True},
    {"id": "l-daily", "text": "daily sunscreen", "kind": "water", "anchor": "daily", "t0": CUE["morning"] - 0.3, "t1": B["change"]["t0"], "shot": "town", "side": -1, "v": "above"},
    {"id": "l-dis", "text": "as they pleased", "kind": "uv", "anchor": "dis", "t0": CUE["pleased"] - 0.5, "t1": B["change"]["t0"], "shot": "town", "side": 1, "v": "below"},
    {"id": "l-cd", "text": "daily: no detectable increase", "kind": "water", "anchor": "castL", "t0": CUE["daily"], "t1": B["why"]["t0"], "shot": "cast", "side": -1, "v": "below"},
    {"id": "l-dmg", "text": "damage the eye misses (more sun)", "kind": "uv", "anchor": "uvR", "t0": CUE["misses"] - 0.3, "t1": B["whoa"]["t0"], "shot": "uv1", "side": 1, "v": "below", "fixed": True},
]
BADGES = [
    {"id": "b-model-h", "text": "model, not a photo", "t0": 0.0, "t1": B["normal"]["t0"], "slot": "tr"},
    {"id": "b-town", "text": "model, not a map", "t0": B["normal"]["t0"] + 0.3, "t1": B["change"]["t0"], "slot": "tl"},
    {"id": "b-cast", "text": "model · 4.5 years, compressed", "t0": B["change"]["t0"] + 0.3, "t1": B["why"]["t0"], "slot": "tl"},
    {"id": "b-burn", "text": "model, not a photo", "t0": B["why"]["t0"], "t1": CUE["but4"] - 0.1, "slot": "tl"},
    {"id": "b-uv1", "text": "illustration · not trial data", "t0": CUE["but4"] - 0.1, "t1": B["whoa"]["t0"], "slot": "tl"},
    {"id": "b-green", "text": "Green et al., 1999 · 2011", "t0": B["whoa"]["t0"] + 0.3, "t1": CUE["half"] - 0.3, "slot": "tl"},
    {"id": "b-sig", "text": "small numbers · not quite significant", "t0": CUE["half"], "t1": B["toscale"]["t0"], "slot": "tl"},
    {"id": "b-hand", "text": "model, not a photo", "t0": B["toscale"]["t0"], "t1": CUE["but"] - 0.1, "slot": "tl"},
    {"id": "b-est", "text": "estimate", "t0": CUE["fifth"], "t1": B["takeaway"]["t0"], "slot": "tr"},
    {"id": "b-uv2", "text": "illustration · not trial data", "t0": CUE["but"] - 0.1, "t1": t_end, "slot": "tl"},
]
SPINE = [0.5, 0.225]   # centred: the viewfinder's REC owns the top right in the UV shots
COUNTERS = [
    {"id": "c-start", "label": "Nambour trial begins", "fmt": "text", "text": f"{START}", "t0": CUE["nambour"] - 0.3, "t1": B["change"]["t0"], "at": SPINE},
    {"id": "c-age", "label": "the casts were graded after", "fmt": "text", "text": "4.5 years", "t0": B["change"]["t0"] + 0.2, "t1": B["whoa"]["t0"] - 0.2, "at": SPINE},
    {"id": "c-follow", "label": "melanoma followed, to", "fmt": "roll", "text": f"{FOLLOW_END}", "roll": [AGE_END, FOLLOW_END, B["whoa"]["t0"] + 0.2, CUE["ten"] + 1.2], "t0": B["whoa"]["t0"] + 0.2, "t1": CUE["half"] - 0.3, "at": SPINE},
    {"id": "c-end", "label": "melanomas: daily vs as pleased", "fmt": "text", "text": f"{MEL[0]} vs {MEL[1]}", "t0": CUE["half"], "t1": t_end - 0.5, "at": SPINE},   # the whoa's value, held lit to the end (never a cast label over the UV illustration)
]
PLATES = {
    "odds": {"t0": CUE["daily"] - 0.2, "t1": B["why"]["t0"] - 0.3, "text": "increased ageing, daily group: about a quarter less likely",
             "sub": f"relative odds {OR:.2f} (95% CI {OR_CI[0]:.2f}–{OR_CI[1]:.2f}) · Hughes et al., 2013"},
    "mel": {"t0": CUE["squamous"] - 0.3, "t1": B["toscale"]["t0"] - 0.3, "scc": CUE["squamous"], "mel": CUE["melanoma"], "half": CUE["half"], "small": CUE["small"],
            "n": list(MEL), "sub": f"hazard ratio {HR:.2f} (95% CI {HR_CI[0]:.2f}–{HR_CI[1]:.2f}): not quite significant"},
    "viewfinder1": {"t0": B["why"]["t0"], "t1": B["whoa"]["t0"]},
    "viewfinder2": {"t0": CUE["but"] - 0.1, "t1": t_end},
    # no daylight strip: the trial's population was one place's adults, and tones under a damage split would pair tones with a risk
}
TOWN = {"split": [CUE["chance"] - 0.2, CUE["chance"] + 1.6], "glow": CUE["morning"] - 0.4}
HANDS = {"flush": [B["why"]["t0"] + 0.3, CUE["burn"] + 0.8], "age": [CUE["four"], CUE["increase"] + 0.4], "dmg": [B["why"]["t0"] + 0.3, CUE["misses"] + 0.4], "film": [B["toscale"]["t0"] + 0.3, CUE["dose"] + 0.6]}
CUTS = [sh["at"] for sh in SHOTS[1:]]


def before_cut(t1, lead=0.35):
    return round(t1 - lead, 4) if any(abs(t1 - c) < 1e-6 for c in CUTS) else t1


for row in BADGES + COUNTERS + LABELS:
    row["t1"] = before_cut(row["t1"])
for a, b in zip(COUNTERS, COUNTERS[1:]):
    if b["t0"] - a["t1"] < 0.4:
        a["t1"] = round(b["t0"] - 0.4, 4)

GAUGE = {"rise": [B["toscale"]["t0"] + 0.4, B["toscale"]["t0"] + 1.3], "sc": CUE["fifth"] - 0.3, "paper": CUE["paper"],
         "back": [B["takeaway"]["t0"] - 0.5, B["takeaway"]["t0"] + 0.4], "sc_um": FILM_UM, "paper_um": PAPER_UM, "bar": "test dose", "sc_text": "≈ 20 µm"}

TITLE = {"series": "Outer Layer · No. 005", "title": "The sunscreen *experiment*", "t1": B["normal"]["t0"] - 0.5, "sig": A("vo01:aged?", 0.35)}
END = {"title": "Next layer: tanning beds and cigarettes. Same list, same *risk*?", "follow": "Outer Layer · No. 006",
       "next": "Nambour Skin Cancer Prevention Trial, Queensland: sunscreen 1992–96 (ageing measured over 4.5 years); melanoma followed to 2006. Narration: synthetic voice (AI)."}
POSTER = A("vo07:record.", 0.3)

glue(f, {"vo01": ["Which hand aged?", "the same fierce sun."], "vo02": ["In the early nineties,", "a Queensland town", "called Nambour,", "every morning."],
         "vo03": ["silicone casts", "four and a half years,", "no detectable increase"], "vo04": ["the burn you feel.", "an ultraviolet camera", "the naked eye"],
         "vo05": ["ten more years.", "Squamous cell cancers", "about half,", "in small numbers."], "vo06": ["a lab's test dose,", "a fifth of a paper's"],
         "vo07": ["which hand aged?", "its own record."], "vo08": ["tanning beds", "with cigarettes.", "same risk?"]})
CAPS = hold(f, keep_units(f.captions(max_chars=24)))

film = {
    "id": ID, "fps": FPS, "bpm": BPM, "dur": f.duration, "poster": POSTER,
    "shots": SHOTS, "beats": BEATS, "tone": TONE, "trans": [],
    "bio": {"tx": TX, "ux": UX, "paper_um": PAPER_UM, "film_um": FILM_UM},
    "cam": CAM, "cue": CUE, "gauge": GAUGE, "plates": PLATES, "town": TOWN, "hands": HANDS,
    "labels": LABELS, "badges": BADGES, "counters": COUNTERS, "pills": [],
    "title": TITLE, "endCard": t_end, "end": END,
    "captions": CAPS,
    "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines],
}

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
    {"t": B["normal"]["t0"], "kind": "scale.jump", "tag": "up-to-town"},
    {"t": TOWN["split"][0], "kind": "diffuse", "tag": "split"},
    {"t": B["change"]["t0"], "kind": "scale.jump", "tag": "down-to-cast"},
    {"t": CUE["but4"] - 0.1, "kind": "cell.land", "tag": "shutter-1"},
    {"t": CUE["but4"] - 0.1, "kind": "scale.jump", "tag": "uv-1"},
    {"t": B["whoa"]["t0"], "kind": "scale.jump", "tag": "up-to-town-2"},
    {"t": B["whoa"]["t0"], "kind": "swell", "tag": "whoa", "t1": B["whoa"]["t1"]},
    {"t": PLATES["mel"]["half"], "kind": "reveal", "tag": "half"},
    {"t": B["toscale"]["t0"], "kind": "scale.jump", "tag": "down-to-hand"},
    {"t": GAUGE["sc"], "kind": "scale", "tag": "g-film"},
    {"t": GAUGE["paper"], "kind": "reveal", "tag": "g-paper"},
    {"t": B["takeaway"]["t0"], "kind": "cell.land", "tag": "shutter-2"},
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
