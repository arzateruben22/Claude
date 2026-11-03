"""Compile Skin Sense No. 006, "Same list as cigarettes" (look 2 rebuild, 2 Nov): script + voice timings + this
direction → film.json and sheet.json. Every moment hangs on a beat or a spoken word; every number on screen comes
from claims.json, hedged as the sources are.

  python3 -I films/channels/skincare/ep06/compile.py

Four hero shots in one scene, far apart (review/storyboard.md):
  list     the IARC Group 1 excerpt as an engraved plate in violet haze (x = 0); it returns for the takeaway
  bed      deep-tone skin under a canopy of UVA tubes (x = 500)
  uv       the same skin through the UV camera; its two banks of tubes go dark (x = 500, the UV switch)
  section  a block of skin cut open, its face a stained tissue photo; UVA dashes pass the top layer (x = 1000)
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
ID = "skin-sense-006"
f = Film(HERE / "script.md", HERE / "vo", fps=FPS, bpm=BPM)
plan, end_hold = f.script_plan()
BEATS = f.layout(plan, end_hold=end_hold)
A = f.at
B = {b["id"]: b for b in BEATS}

# ── the numbers (claims.json) ───────────────────────────────────────────────
YEARS = {"meat": 2015, "beds": 2009, "sun": 1992}          # c1, c2, c12
UVA_X = (10, 15)                                          # c5: "may be 10 to 15 times" the midday sun (AAP 2011)
RR = {"2012": 1.59, "2007": 1.75}                         # c7: first use before 35 (Boniol 2012 corrected; IARC 2007)
BANS = {"Australia": 2015, "Brazil": 2009}                # c8, c9 (commercial beds; WA from 2016)
EPI_UM, PAPER_UM = 100.0, 100.0                           # c11: the epidermis ≈ 0.1 mm on most skin; paper ≈ 100 µm
assert min(RR.values()) > 1.5, "raised by more than half"
assert YEARS["sun"] < YEARS["beds"], "the sun made the list years before the beds"
TONE = "deep"           # bible: 006 is drawn in the deep tone, and only that tone

# ── cues (spoken words) ──────────────────────────────────────────────────────
t_end = A("vo08:Next", -0.25)
CUE = {
    "list": A("vo01:list"), "cigs": A("vo01:cigarettes?"), "meat": A("vo01:meat"),
    "three": A("vo02:three"), "top": A("vo02:top"), "dangerous": A("vo02:dangerous:"), "ranks": A("vo02:ranks"), "sure": A("vo02:sure"),
    "into": A("vo03:Into"), "uva": A("vo03:UVA,"), "long": A("vo03:long"), "large": A("vo03:large,"), "ten": A("vo03:ten"), "sun": A("vo03:sun."),
    "when": A("vo04:When"), "young": A("vo04:young."), "pooled": A("vo04:pooled"), "before": A("vo04:before"), "half": A("vo04:half."),
    "whole": A("vo05:Whole"), "acted": A("vo05:acted:"), "australia": A("vo05:Australia"), "off": A("vo05:off"), "brazil": A("vo05:Brazil"), "too": A("vo05:too."),
    "and": A("vo06:And"), "rays": A("vo06:rays"), "through": A("vo06:through"), "layer": A("vo06:layer,"), "paper": A("vo06:paper."),
    "the7": A("vo07:The"), "sun2": A("vo07:sun"), "beds2": A("vo07:beds."), "same2": A("vo07:Same"), "harm2": A("vo07:harm,"), "certainty": A("vo07:certainty."),
}
# shot cuts land on the first word of their beat (a hair before it, so the cut and the word arrive together); the cut
# into the section lands on the music grid 1.5 s after "too." (a beat), so the dark switch-off holds only briefly
CUT = {"bed": A("vo03:Into", -0.1), "uv": A("vo05:Whole", -0.1), "section": f.frame(f.snap(A("vo05:too.", 1.5))), "list2": A("vo07:The", -0.1)}
assert CUT["section"] < A("vo06:And") - 0.6
SHOTS = [{"at": 0.0, "name": "list"}, {"at": CUT["bed"], "name": "bed"}, {"at": CUT["uv"], "name": "uv"},
         {"at": CUT["section"], "name": "section"}, {"at": CUT["list2"], "name": "list2"}]
CUTS = [s["at"] for s in SHOTS[1:]]
SHOT_END = {s["name"]: (SHOTS[i + 1]["at"] if i + 1 < len(SHOTS) else f.duration) for i, s in enumerate(SHOTS)}


def before_cut(t1, lead=0.35):
    return round(t1 - lead, 4) if any(abs(t1 - c) < 1e-6 for c in CUTS) else t1


# ── the plate (hero 1): which rows light, when ──────────────────────────────
PLATE = {
    "lit": {"Tobacco smoking": CUE["cigs"] - 0.1, "UV-emitting tanning devices": CUE["cigs"] + 0.25, "Processed meat": CUE["meat"] - 0.1},
    "rank": CUE["sure"] - 0.15,
    "sun": CUE["sun2"] - 0.1, "relit": CUE["same2"] - 0.1, "rank2": CUE["harm2"] - 0.1,
    "years": YEARS,
}
# ── the canopy (hero 2) and the switch-off (hero 3) ─────────────────────────
BED = {"on": [CUT["bed"], CUE["uva"]], "flare": [CUE["ten"] - 0.2, CUE["ten"] + 0.6], "swell": [CUE["sun"] - 0.2, CUE["sun"] + 0.9],
       "fall": [CUE["sun"] + 0.9, CUE["when"] + 0.8]}
UVD = {"scan": [CUT["uv"] + 0.05, CUT["uv"] + 0.85], "australia": [CUE["off"] - 0.05, CUE["off"] + 1.1], "brazil": [CUE["brazil"], CUE["brazil"] + 1.1]}
# ── the cut face (hero 4) and the gauge ─────────────────────────────────────
RAYS = {"on": [CUT["section"] + 0.2, CUE["rays"]], "pass": CUE["through"]}
GAUGE = {"rise": [CUE["and"] - 0.2, CUE["and"] + 0.7], "sc": CUE["layer"] - 0.2, "paper": CUE["paper"],
         "back": [CUT["list2"] - 0.5, CUT["list2"]], "sc_um": EPI_UM, "paper_um": PAPER_UM, "bar": "top layer", "sc_text": "≈ 100 µm"}

# ── small labels: at most two at once (spines and tags), honesty notes one at a time in a corner ──────
BADGES = [
    {"id": "b-iarc", "text": "IARC Group 1 · excerpt", "t0": B["normal"]["t0"] - 0.2, "t1": SHOT_END["list"], "slot": "tl"},
    {"id": "b-model-bed", "text": "model, not a photo", "t0": CUT["bed"] + 0.3, "t1": CUE["large"] - 0.3, "slot": "tl"},
    {"id": "b-units", "text": "large, powerful units", "t0": CUE["large"] - 0.2, "t1": CUE["when"] - 0.2, "slot": "tl"},
    {"id": "b-pooled", "text": "pooled studies · 2012 (corr.) · 2007", "t0": CUE["pooled"] - 0.1, "t1": SHOT_END["bed"], "slot": "tl"},
    {"id": "b-model", "text": "model, not a photo", "t0": CUT["uv"] + 0.9, "t1": SHOT_END["uv"], "slot": "tl"},
    {"id": "b-micro", "text": "tissue photo · rays simplified", "t0": CUT["section"] + 0.3, "t1": SHOT_END["section"], "slot": "tr"},
    {"id": "b-iarc2", "text": "IARC Group 1 · excerpt", "t0": CUT["list2"] + 0.2, "t1": CUE["certainty"] - 0.7, "slot": "tl"},
]
SPINE = [0.56, 0.265]     # below the corner notes' row, clear of their width
COUNTERS = [
    {"id": "c-uva", "label": "UVA vs midday sun · may be", "text": f"×{UVA_X[0]}–{UVA_X[1]}", "t0": CUE["ten"] - 0.2, "t1": CUE["when"] - 0.2, "at": SPINE},
    {"id": "c-rr", "label": "melanoma · relative risk · first use < 35", "text": f"{RR['2012']:.2f} · {RR['2007']:.2f}", "t0": CUE["half"] - 0.4, "t1": SHOT_END["bed"],
     "at": [0.5, 0.265], "small": "7.4vmin"},
    {"id": "c-end", "label": "Group 1 ranks", "text": "certainty", "t0": CUE["certainty"] - 0.2, "t1": t_end - 0.5, "at": [0.5, 0.19]},
]
TAGS = [   # the switch-off's two halves, named once each (Australia: most states 2015, Western Australia 2016; c9)
    {"id": "t-au", "text": f"Australia · {BANS['Australia']}–16", "t0": CUE["off"] + 0.1, "t1": SHOT_END["uv"], "side": "left"},
    {"id": "t-br", "text": f"Brazil · {BANS['Brazil']}", "t0": CUE["brazil"] + 0.1, "t1": SHOT_END["uv"], "side": "right"},
]
for row in BADGES + COUNTERS + TAGS:
    row["t1"] = before_cut(row["t1"])


def live(rows, t):
    return sum(1 for r in rows if r["t0"] <= t < r["t1"])


for i in range(int(f.duration * FPS)):   # at most two small labels at once; honesty notes one at a time, in a corner
    assert live(COUNTERS + TAGS, i / FPS) <= 2 and live(BADGES, i / FPS) <= 1, f"too many labels at {i / FPS:.2f} s"

TITLE_T1 = B["normal"]["t0"] - 0.5
# ── cameras: per shot, keys {t, pos, look} eased between (scene units, relative to the shot's place) ─────────
K = lambda t, pos, look: {"t": round(t, 4), "pos": pos, "look": look}   # noqa: E731
CAM = {
    "list": {"keys": [K(0.0, [1.0, 0.1, 21.6], [0.3, -0.45, 0]), K(TITLE_T1, [0.7, 0.2, 21.0], [0.15, -0.55, 0]),
                      K(CUE["sure"], [0.0, 0.3, 18.6], [0.0, -0.8, 0]), K(CUT["bed"], [-0.6, 0.1, 17.6], [-0.1, -0.85, 0])],
             "rack": [0.0, CUE["cigs"] - 0.2]},
    "bed": {"keys": [K(CUT["bed"], [-2.0, 3.4, 15.0], [0.0, 2.2, -6.0]), K(CUE["sun"], [0.2, 2.6, 10.5], [0.5, 0.8, -5.0]),
                     K(A("vo04:started"), [0.6, 2.3, 8.6], [0.6, 0.5, -4.0]), K(CUE["pooled"] + 0.6, [0.9, 2.2, 7.6], [0.7, 8.6, -6.5]),
                     K(CUT["uv"], [1.3, 2.2, 6.4], [0.9, 8.8, -8.0])],
            "rack": [CUE["young"], CUE["pooled"]]},
    "uv": {"keys": [K(CUT["uv"], [0.0, 6.2, 12.5], [0.0, 0.0, -1.0]), K(CUT["section"], [0.0, 4.6, 9.0], [0.0, -0.3, -2.5])]},
    "section": {"keys": [K(CUT["section"], [12.0, 6.2, 21.0], [0.8, -3.0, -1.5]), K(CUT["list2"], [9.0, 4.8, 16.5], [0.4, -3.2, -1.5])]},
    "list2": {"keys": [K(CUT["list2"], [-0.9, 0.4, 19.2], [-0.15, -0.7, 0]), K(f.duration, [0.2, 0.1, 17.6], [0.0, -0.85, 0])]},
}
for name, c in CAM.items():
    ts = [k["t"] for k in c["keys"]]
    assert ts == sorted(ts) and ts[-1] > ts[0], name
for name in ("bed", "uv", "section"):
    assert min(k["pos"][1] for k in CAM[name]["keys"]) > 0.3, f"{name}: the camera stays above the skin"

TITLE = {"series": "Skin Sense · No. 006", "title": "Same list as *cigarettes*", "t1": B["normal"]["t0"] - 0.5, "sig": A("vo01:cigarettes?", 0.35)}
END = {"title": "Next season: why do bath fingers *wrinkle*?", "follow": "Skin Sense · season 2",
       "next": "IARC classified UV-emitting tanning devices as carcinogenic to humans (Group 1) in 2009. Narration: synthetic voice (AI)."}
POSTER = A("vo07:certainty.", 0.3)

glue(f, {"vo01": ["Same list", "as cigarettes?", "Processed meat"], "vo02": ["top group", "cancer agency,", "equally dangerous:", "how sure"],
         "vo03": ["mostly UVA,", "the long rays.", "ten to fifteen times", "the midday sun."], "vo04": ["started young.", "before thirty-five", "more than half."],
         "vo05": ["Whole countries", "every commercial bed", "Brazil banned"], "vo06": ["those long rays", "the top layer,", "as thin as paper."],
         "vo07": ["years before", "Same list", "as cigarettes:", "same harm,", "same certainty."], "vo08": ["Next season:", "bath fingers", "your arm?"]})
CAPS = hold(f, keep_units(f.captions(max_chars=24)))
CAPS = [c for c in CAPS if c["t0"] >= TITLE["t1"] - 1.5 or "".join(w for ln in c["lines"] for w, _ in ln).replace("\u2007", "").lower().replace(" ", "")
        not in "samelistascigarettes?"]   # the title already says "Same list as cigarettes": no duplicate caption under it

film = {
    "id": ID, "fps": FPS, "bpm": BPM, "dur": f.duration, "poster": POSTER,
    "shots": SHOTS, "beats": BEATS, "tone": TONE, "trans": [],
    "bio": {"paper_um": PAPER_UM, "epi_um": EPI_UM},
    "cam": CAM, "cue": CUE, "cut": CUT, "title_t1": TITLE["t1"], "gauge": GAUGE, "plate": PLATE, "bed": BED, "uvd": UVD, "rays": RAYS,
    "badges": BADGES, "counters": COUNTERS, "tags": TAGS, "labels": [], "pills": [],
    "title": TITLE, "endCard": t_end, "end": END,
    "captions": CAPS,
    "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines],
}

ev = [{"t": b["t0"], "kind": "section", "id": b["id"], "t1": b["t1"]} for b in BEATS]
ev.append({"t": TITLE["sig"], "kind": "signature", "tag": "title"})
ev.append({"t": t_end, "kind": "signature", "tag": "end"})
for c in COUNTERS:
    ev.append({"t": c["t0"], "kind": "counter.show", "tag": c["id"]})
for b in BADGES:
    if b["t0"] > 0:
        ev.append({"t": b["t0"], "kind": "badge", "tag": b["id"]})
ev += [
    {"t": PLATE["lit"]["Processed meat"], "kind": "reveal", "tag": "list-meat"},
    {"t": PLATE["rank"], "kind": "cell.land", "tag": "rank"},
    {"t": CUT["bed"], "kind": "scale.jump", "tag": "into-bed"},
    {"t": BED["flare"][0], "kind": "zap", "tag": "tubes-flare"},
    {"t": BED["swell"][0] + 0.2, "kind": "reveal", "tag": "tubes-swell"},
    {"t": CUT["uv"], "kind": "cell.land", "tag": "shutter"},
    {"t": CUT["uv"], "kind": "swell", "tag": "whoa", "t1": B["whoa"]["t1"]},
    {"t": UVD["australia"][0], "kind": "cell.land", "tag": "australia-off"},
    {"t": UVD["brazil"][0] + 0.2, "kind": "cell.land", "tag": "brazil-off"},
    {"t": CUT["section"], "kind": "scale.jump", "tag": "into-section"},
    {"t": GAUGE["sc"], "kind": "scale", "tag": "g-epi"},
    {"t": GAUGE["paper"], "kind": "reveal", "tag": "g-paper"},
    {"t": CUT["list2"], "kind": "scale.jump", "tag": "back-to-list"},
    {"t": PLATE["sun"], "kind": "reveal", "tag": "list-sun"},
    {"t": PLATE["relit"], "kind": "cell.land", "tag": "list-relit"},
]
cues_file = HERE / "build" / f"cues-{ID}-9x16.json"
if cues_file.exists():
    cj = json.loads(cues_file.read_text())
    pic = {e.get("tag"): e for e in cj.get("events", [])}
    for e in ev:
        p = pic.get(e.get("tag"))
        if p and p.get("pos") and e["kind"] in ("label", "counter.show"):
            e["pos"] = p["pos"]
sheet = {"duration": f.duration, "fps": FPS, "preset": "outerlayer-slide",
         "sections": [{"id": b["id"], "t0": b["t0"], "t1": b["t1"], "energy": b["energy"]} for b in BEATS],
         "events": sorted(ev, key=lambda e: e["t"]),
         "voice": [{"id": v["id"], "t": v["t"], "file": v["file"]} for v in film["voice"]]}

(HERE / "film.json").write_text(json.dumps(film, indent=1, ensure_ascii=False))
(HERE / "sheet.json").write_text(json.dumps(sheet, indent=1, ensure_ascii=False))
print(f"film.json: {f.duration:.2f} s, {len(SHOTS)} shots, {len(BADGES)} notes, {len(COUNTERS)} counters, {len(TAGS)} tags, "
      f"{len(CAPS)} caption pages, end card {t_end:.2f} s")
print("  shots " + " · ".join(f"{s['name']} {s['at']:.2f}" for s in SHOTS))
print(f"sheet.json: {len(sheet['events'])} events")
