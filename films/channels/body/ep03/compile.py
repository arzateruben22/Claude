"""Compile Meanwhile, Inside No. 03, "The jump": script + voice timings + this direction → film.json and sheet.json.
Nothing here is a hand-typed time: every moment hangs on a beat or a spoken word (A("vo03:timed")).

  python3 -I films/channels/body/ep03/compile.py

One world, few cuts (WRITING.md, "The picture"). The fibres (scene.mjs):
  hero    a myelinated fibre with its cell body at x < 0 and its terminal at the far end (µm; internodes compressed)
  bare    a thin bare fibre above it (the re-fire, step by step; the slow racer)
  ms      a fibre below it in brain and spinal cord, one sheath damaged (the signal falters there)
One illustrated slide, the drum: Helmholtz's method (a frog muscle on its nerve, a lever, a pen on a turning drum;
two twitch traces, one above the other, the far stimulus's rise later). The takeaway and the tally play over a large body silhouette (HUD).
At the end card the iris returns to frame 0's composition, so a replay is seamless.
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
sys.path.insert(0, str(ROOT / "kits/cinema/script"))
from timeline import Film   # noqa: E402

FPS, BPM = 30, 75
BEAT = 60.0 / BPM
f = Film(HERE / "script.md", HERE / "vo", fps=FPS, bpm=BPM)
plan, end_hold = f.script_plan()
BEATS = f.layout(plan, end_hold=end_hold)
A = f.at
B = {b["id"]: b for b in BEATS}
DUR = f.duration
EC = f.end_card
HALF = 0.5 / FPS
THEME = json.loads((HERE.parent / "theme.json").read_text())


def fr(t):
    return round(round(t * FPS) / FPS, 6)


def cut(t):
    return round(fr(t) - HALF, 6)


CUT = {"drum": cut(B["change"]["t0"]), "fibres": cut(B["why"]["t0"]), "loop": cut(EC)}
SHOTS = [{"at": 0.0, "name": "hook"}, {"at": CUT["drum"], "name": "drum"}, {"at": CUT["fibres"], "name": "fibres"}, {"at": CUT["loop"], "name": "loop"}]
IRIS = [{"t": t, "cx": 0.5, "cy": 0.42} for t in CUT.values()]

# ── the hero fibre's signal: hops (each a node), as [time, node index]; an arc shows each leap ──────────
HOP = 0.85
# frame 0: mid-leap from node 7 to node 8; through the hook a new spike re-crosses that framed internode every HOP
HOOK = {"node0": 7, "t0": -HOP * 0.6}
HOOK_RUN = A("vo02:cell's", -0.3)                        # "racing down one cell's thin fibre": a fresh spike leaves the cell body
WHY_JUMP = {"t0": A("vo04:Many", 0.2), "hop": 0.8, "k0": 2}   # the hero at "myelin": hops from node 2, one lands on "gaps", one on "leaps"
MS = {"t0": A("vo04:Where", 0.0), "hop": 0.9, "bad": 6, "k0": 4, "stall": A("vo04:stall", 0.1)}   # two hops to the damaged sheath, falters, stalls
BARE = {"t0": B["why"]["t0"] + 0.2, "v": 10.0, "x0": 90.0, "step": 5.0}   # why: the bare fibre re-fired step by step (µm/s, shown)
# the race, from one start line: the bare head crawls a fifth of the frame; wrapped pulses streak across every 1.2 s (150 : 1)
RACE = {"x0": 24.0, "bare0": A("vo05:crawl", -0.2), "vbare": 2.0, "wrap0": A("vo05:Thick"), "vwrap": 300.0, "every": 1.2,
        # "Thick wrapped ones" (26 Oct audit): the wrapped racer (the hero) is drawn 1.5× thicker in the race. It thickens
        # during the camera's move from the damaged fibre to the race and thins back under the dimmed, defocused meanwhile
        "thick": 1.5, "grow": [MS["stall"] + 1.0, B["whoa"]["t0"] + 0.2], "shrink": [B["meanwhile"]["t0"], B["tease"]["t0"] - 0.4]}
TEASE = {"t0": B["tease"]["t0"] + 0.3, "hop": 0.5, "arrive": A("vo08:jump")}    # down the last internodes and onto the terminal
TOE = {"stub": A("vo06:jolt", -0.12), "fast": A("vo06:jolt", -0.02), "slow": A("vo06:ache", 0.0)}   # real time: ~0.1 s and ~2.1 s
# two recordings on the same strip of the drum (it turns once between them), so the far stimulus's later rise sits under
# the near one's; the drum stops once the second is written, so both face the lens
DRUM = {"spin0": B["change"]["t0"], "traces": [A("vo03:timed", -0.1), A("vo03:metres", 0.15)], "stim": [A("vo03:timed", -0.1), A("vo03:metres", 0.15)]}

CAM = {
    "hook": [
        {"t": 0.0, "pos": [322.0, 26.0, 150.0], "look": [316.0, -6.0, 0.0], "fov": 34},
        {"t": A("vo01:timed"), "pos": [316.0, 22.0, 132.0], "look": [312.0, -6.0, 0.0], "fov": 34, "ease": "sine"},
        {"t": A("vo02:racing"), "pos": [120.0, 40.0, 380.0], "look": [110.0, -6.0, 0.0], "fov": 34, "ease": "p2"},   # pull back along the fibre
        {"t": A("vo02:cell's"), "pos": [20.0, 36.0, 220.0], "look": [16.0, -6.0, 0.0], "fov": 34, "ease": "p2"},      # the cell body: one cell
        {"t": A("vo02:Some", -0.1), "pos": [22.0, 36.0, 226.0], "look": [18.0, -6.0, 0.0], "fov": 34, "ease": "sine"},  # held while it is named
        {"t": A("vo02:toe"), "pos": [300.0, 60.0, 900.0], "look": [300.0, -20.0, 0.0], "fov": 34, "ease": "p2"},  # the whole fibre, long and thin
        {"t": CUT["drum"], "pos": [310.0, 64.0, 960.0], "look": [310.0, -20.0, 0.0], "fov": 34, "ease": "sine"},
    ],
    "drum": [
        {"t": CUT["drum"], "pos": [44.0, 18.0, 236.0], "look": [4.0, 2.0, 0.0], "fov": 34},                      # the rig: nerve, muscle, lever, drum (the lever above the caption)
        {"t": A("vo03:Helmholtz"), "pos": [36.0, 16.0, 226.0], "look": [4.0, 2.0, 0.0], "fov": 34, "ease": "sine"},
        {"t": A("vo03:timed", 0.1), "pos": [30.0, 6.0, 128.0], "look": [16.0, -4.0, 0.0], "fov": 34, "ease": "p2"},  # medium: electrodes, lever and traces in one frame
        {"t": CUT["fibres"], "pos": [30.0, 5.0, 122.0], "look": [17.0, -5.0, 0.0], "fov": 34, "ease": "sine"},
    ],
    "fibres": [
        {"t": CUT["fibres"], "pos": [96.0, 40.0, 120.0], "look": [90.0, 18.0, 0.0], "fov": 34},                       # the bare fibre
        {"t": A("vo04:step#2"), "pos": [136.0, 38.0, 124.0], "look": [130.0, 16.0, 0.0], "fov": 34, "ease": "sine"},
        # down to the hero, wrapped: the view travels with the leaps (two internodes wide), so each landing is in frame
        {"t": A("vo04:Many", 0.3), "pos": [100.0, 14.0, 220.0], "look": [100.0, -4.0, 0.0], "fov": 34, "ease": "p2"},
        {"t": A("vo04:leaps", 0.4), "pos": [312.0, 14.0, 220.0], "look": [312.0, -4.0, 0.0], "fov": 34, "ease": "lin"},
        {"t": A("vo04:Where", 0.3), "pos": [246.0, -4.0, 150.0], "look": [246.0, -22.0, 0.0], "fov": 34, "ease": "p2"},  # the damaged fibre: the last good gap and the damaged sheath
        {"t": MS["stall"] + 1.0, "pos": [268.0, -8.0, 120.0], "look": [268.0, -22.0, 0.0], "fov": 34, "ease": "sine"},
        # the race, from one start line: bare above, wrapped below. y 10 (was 12, 26 Oct): the thick wrapped racer's
        # lower edge (r 5.4) then clears the caption plate's top (0.61 H) by about 25 px, as the thin one did at y 12
        {"t": B["whoa"]["t0"] + 0.2, "pos": [58.0, 10.0, 260.0], "look": [58.0, 10.0, 0.0], "fov": 34, "ease": "p2"},
        {"t": B["takeaway"]["t0"], "pos": [62.0, 10.0, 280.0], "look": [62.0, 10.0, 0.0], "fov": 34, "ease": "sine"},
        {"t": B["tease"]["t0"], "pos": [430.0, 8.0, 400.0], "look": [430.0, 0.0, 0.0], "fov": 34, "ease": "sine"},
        {"t": A("vo08:A", 0.0), "pos": [652.0, 16.0, 120.0], "look": [666.0, -8.0, 0.0], "fov": 34, "ease": "p2"},   # the terminal and the gap (centre right)
        {"t": CUT["loop"], "pos": [658.0, 14.0, 110.0], "look": [668.0, -8.0, 0.0], "fov": 34, "ease": "sine"},
    ],
}
CAM["loop"] = [dict(CAM["hook"][0], t=CUT["loop"])]

FOC = {
    "hook": [{"t": 0.0, "at": "spark", "f": 0.5}, {"t": A("vo02:racing"), "at": "spark", "f": 0.3}, {"t": A("vo02:cell's", -0.4), "at": "soma", "f": 0.35}, {"t": A("vo02:spine", -0.3), "at": "mid", "f": 0.2}],
    "drum": [{"t": CUT["drum"], "at": "rig", "f": 0.3}, {"t": A("vo03:timed"), "at": "traces", "f": 0.45}],
    "fibres": [{"t": CUT["fibres"], "at": "bare", "f": 0.45}, {"t": A("vo04:Many", 0.2), "at": "spark", "f": 0.45}, {"t": A("vo04:Where", 0.2), "at": "ms", "f": 0.45},
               {"t": B["whoa"]["t0"], "at": "race", "f": 0.3}, {"t": B["takeaway"]["t0"], "at": "near", "f": 0.9},
               {"t": B["tease"]["t0"], "at": "mid", "f": 0.3}, {"t": A("vo08:A", -0.3), "at": "terminal", "f": 0.5}],
    "loop": [{"t": CUT["loop"], "at": "spark", "f": 0.5}],
}

LABELS = [
    {"id": "soma", "text": "one nerve cell", "color": "nerve", "mark": "dot", "at": "soma", "t0": A("vo02:cell's"), "t1": A("vo02:Some", 0.1), "shot": "hook", "side": 1},
    {"id": "muscle", "text": "frog muscle", "color": "muscle", "mark": "dot", "at": "muscle", "t0": A("vo03:In"), "t1": A("vo03:Helmholtz"), "shot": "drum", "side": 1},
    {"id": "nerve", "text": "its nerve", "color": "nerve", "mark": "dot", "at": "frognerve", "t0": A("vo03:fifty", 0.2), "t1": A("vo03:Helmholtz"), "shot": "drum", "side": 1},
    {"id": "trace", "text": "far stimulus: its twitch starts later", "color": "text", "mark": "dot", "at": "traces", "t0": A("vo03:metres", 0.15) + 0.7, "t1": CUT["fibres"] - 0.3, "shot": "drum", "side": 1},
    {"id": "bare", "text": "bare fibre", "color": "nerve", "mark": "dot", "at": "bare", "t0": B["why"]["t0"] + 0.5, "t1": A("vo04:Many", -0.2), "shot": "fibres", "side": 1},
    {"id": "myelin", "text": "myelin", "color": "bone", "mark": "dot", "at": "sheath", "t0": A("vo04:myelin"), "t1": A("vo04:re-firing", 0.0), "shot": "fibres", "side": 1},
    {"id": "gap", "text": "bare gap", "color": "nerve", "mark": "dot", "at": "node", "t0": A("vo04:gaps"), "t1": A("vo04:leaps", 0.0), "shot": "fibres", "side": 1},
    {"id": "ms", "text": "damaged myelin · brain and spinal cord", "color": "bone", "mark": "dashed", "at": "damaged", "t0": round(MS["t0"] + 2 * MS["hop"] - 0.2, 4), "t1": MS["stall"] + 1.0, "shot": "fibres", "side": 1},
    {"id": "racebare", "text": "thinnest bare fibre", "color": "nerve", "mark": "dot", "at": "barefront", "t0": A("vo05:crawl"), "t1": B["takeaway"]["t0"] - 0.3, "shot": "fibres", "side": -1},
    {"id": "racewrap", "text": "thick wrapped fibre", "color": "bone", "mark": "dot", "at": "wrapfront", "t0": A("vo05:Thick", 0.3), "t1": B["takeaway"]["t0"] - 0.3, "shot": "fibres", "side": 1},
    {"id": "terminal", "text": "the end of the line", "color": "nerve", "mark": "dot", "at": "terminal", "t0": A("vo08:line"), "t1": EC, "shot": "fibres", "side": -1},
]
# the spine readout (WRITING.md, "The picture" 2): one number in one place, its label naming the beat
SPINE = [
    {"id": "q", "t0": 0.0, "t1": A("vo02:Some", -0.3), "text": "?", "unit": "m/s", "label": "how fast is this spark?"},
    {"id": "len", "t0": A("vo02:fibres"), "t1": A("vo02:How", -0.45), "value": 1, "unit": "m", "label": "spine to toe: about"},   # c3
    {"id": "take", "t0": A("vo02:How"), "t1": CUT["drum"] - 0.3, "text": "?", "unit": "s", "label": "spine to toe: how long?"},
    {"id": "light", "t0": A("vo03:light"), "t1": A("vo03:Helmholtz", -0.1), "value": 300_000_000, "unit": "m/s", "label": "Müller: as fast as light?"},   # c4, c20
    {"id": "frog", "t0": A("vo03:About"), "t1": CUT["fibres"] - 0.3, "keys": [[A("vo03:About"), 0], [A("vo03:second", 0.2), 27]], "unit": "m/s",
     "label": [[A("vo03:About"), "Helmholtz, 1850, frog: about"], [A("vo03:cheetah"), "Helmholtz 1850 · cheetah speed"]]},   # c6, c17
    {"id": "patch", "t0": A("vo04:re-fires", 0.0), "t1": A("vo04:Many", -0.25), "text": "every step", "unit": "", "label": "bare fibre: re-fired at"},
    {"id": "fired", "t0": WHY_JUMP["t0"], "t1": A("vo04:Where", -0.2), "count": "fired", "unit": "", "label": "wrapped: re-fired only at gaps"},
    # one readout for the race, its label stepping from the crawl to the wrapped (no two plates crossfading in one slot)
    {"id": "race", "t0": A("vo05:crawl"), "t1": A("vo05:Faster", -0.45), "keys": [[A("vo05:Thick"), 1], [A("vo05:fifty", 0.3), 150]], "unit": "m/s",
     "label": [[A("vo05:crawl"), "thinnest bare fibres, about"], [A("vo05:Thick"), "thick wrapped fibres, up to"]]},   # c10, c11
    {"id": "kmh", "t0": A("vo05:Faster"), "t1": B["takeaway"]["t0"] - 0.2, "value": 540, "unit": "km/h", "label": "F1's fastest race speed: 373"},   # c12
    {"id": "toe", "t0": TOE["stub"] - 0.4, "t1": B["meanwhile"]["t0"] + 0.1, "keys": [[TOE["stub"], 0.0], [TOE["slow"], round(TOE["slow"] - TOE["stub"], 2)]], "unit": "s", "label": "since the stub, real time", "fmt": 1},   # c13, c19
]
TALLY = {"t0": B["meanwhile"]["t0"] + 0.3, "t1": B["tease"]["t0"] - 0.2, "rate": 75.0 / 60.0, "unit": "beats", "label": "heartbeats while you watched"}   # c14
FIG = {"t0": B["takeaway"]["t0"] + 0.15, "t1": B["tease"]["t0"] + 0.2,      # the body silhouette over the dimmed fibres
       "route": [A("vo06:toe"), A("vo06:twice")],                         # the toe-to-brain route draws on before the stub
       "zoom": [B["meanwhile"]["t0"] + 0.3, B["meanwhile"]["t0"] + 1.1],   # the meanwhile: in to the heart
       "spark": A("vo07:spark")}
TEASE_T0 = round(TEASE["arrive"] - 4 * TEASE["hop"], 4)
BADGES = [
    {"id": "slow-hook", "text": "slowed · distances compressed", "slot": "tl", "t0": 0.0, "t1": A("vo02:toe")},
    {"id": "nts-hook", "text": "not to scale", "t0": 0.0, "t1": CUT["drum"] - 0.3},
    {"id": "ill-drum", "text": "illustration: Helmholtz's method · slowed", "t0": CUT["drum"], "t1": CUT["fibres"] - 0.3},
    {"id": "nts-fib", "text": "not to scale", "t0": CUT["fibres"], "t1": FIG["t0"]},
    {"id": "slow", "text": "slowed · distances compressed", "slot": "tl", "t0": CUT["fibres"], "t1": B["takeaway"]["t0"] - 0.3},
    {"id": "real", "text": "real time", "slot": "tl", "t0": TOE["stub"] - 0.6, "t1": B["meanwhile"]["t0"]},
    {"id": "nts-tease", "text": "not to scale", "t0": FIG["t1"] - 0.3, "t1": EC},
    {"id": "slow-tease", "text": "slowed", "slot": "tl", "t0": round(TEASE_T0 - 0.3, 4), "t1": EC},
]
TITLE = {"series": "Meanwhile, Inside · No. 03", "title": "The *jump*", "t1": round(A("vo01:The", 0.3), 4), "sig": 0.0, "y": 0.17}
END = {"t0": EC, "title": "Next, inside: *the gap*", "next": "Meanwhile, Inside · No. 04", "follow": "Follow Meanwhile, Inside",
       "fact": "In 1850 Helmholtz timed a frog's nerve signal at about 27 metres a second."}   # c5, c6
SEG_BEATS = [round(k * BEAT, 4) for k in range(round(B["meanwhile"]["t0"] / BEAT), int(TALLY["t1"] / BEAT) + 1)]

# caption pages: the balanced pager (no one-word tails), never splitting these phrases across rows or pages
CAPTION_KEEP = [
    "multiple sclerosis",
    "Formula One",
    "Johannes Müller",
    "a metre a second",
    "thirty metres",
    "eighteen fifty",
    "fatty myelin",
    "spine to toe",
    "nerve signal",
    "leading expert",
    "thin fibre",
    "bare fibres",
    "faster fibres",
    "bare ones",
    "stubbed toe",
    "a hundred and fifty",
    "eighty times",
    "end of the line",
    "at rest",
    "former student",
    "as fast as light",
    "could ever be timed",
    "cheetah speed",
    "the cell",
    "up to",
]

film = {
    "id": "meanwhile-inside-003", "fps": FPS, "bpm": BPM, "dur": DUR, "poster": 0.0,
    "_doc": "Compiled by compile.py from script.md, vo/ and the direction in compile.py. Do not edit by hand.",
    "shots": SHOTS, "beats": BEATS, "iris": IRIS, "hop": HOP, "hookSig": HOOK, "hookRun": HOOK_RUN, "whyJump": WHY_JUMP, "ms": MS, "bare": BARE, "race": RACE,
    "tease": TEASE, "toe": TOE, "drum": DRUM, "fig": FIG,
    "cam": CAM, "foc": FOC, "labels": LABELS, "spine": SPINE, "badges": BADGES, "tally": TALLY,
    "segBeats": SEG_BEATS, "title": TITLE, "endCard": EC, "end": END,
    "look": THEME["scene"],
    "captions": f.captions(max_chars=THEME["sizes"]["caption"]["maxChars"], balance=True, keep=CAPTION_KEEP),
    "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines],
}

ev = [{"t": b["t0"], "kind": "section", "id": b["id"], "t1": b["t1"]} for b in BEATS]
ev.append({"t": TITLE["sig"], "kind": "signature", "tag": "title", "gain": -3.0})
ev.append({"t": EC, "kind": "signature", "tag": "end"})
for lb in LABELS:
    ev.append({"t": lb["t0"], "kind": "label", "tag": lb["id"]})
for bd in BADGES:
    if bd["t0"] > 0:
        ev.append({"t": bd["t0"], "kind": "badge", "tag": bd["id"], "text": bd["text"]})
for sp in SPINE:
    if sp["t0"] > 0:
        ev.append({"t": sp["t0"], "kind": "counter.show", "tag": sp["id"]})
SP = {sp["id"]: sp for sp in SPINE}
ev.append({"t": SP["frog"]["keys"][1][0], "kind": "counter.end", "tag": "frog-end"})
ev.append({"t": SP["race"]["keys"][1][0], "kind": "counter.end", "tag": "wrap-end"})
ev.append({"t": TALLY["t0"], "kind": "counter.show", "tag": "tally"})
for k, t in enumerate(SEG_BEATS):
    ev.append({"t": t, "kind": "beat", "tag": f"beat{k}"})


def hops(t0, hop, t1, tag):
    k = 0
    while t0 + k * hop < t1:
        ev.append({"t": round(t0 + k * hop, 4), "kind": "spike", "tag": f"{tag}{k}"})
        k += 1


hops(HOOK["t0"] + HOP, HOP, HOOK_RUN, "hook")                         # the hook's spike train (the first after frame 0)
hops(HOOK_RUN, HOP, CUT["drum"] - 0.2, "run")                         # the run from the cell body down the fibre
hops(WHY_JUMP["t0"], WHY_JUMP["hop"], A("vo04:Where", -0.3), "why")
hops(MS["t0"], MS["hop"], MS["t0"] + (MS["bad"] - MS["k0"]) * MS["hop"] + 1e-6, "ms")
ev.append({"t": MS["stall"], "kind": "impact", "tag": "stall", "gain": -8.0})
hops(RACE["wrap0"], RACE["every"], B["takeaway"]["t0"] - 0.3, "race")   # each wrapped pulse
hops(TEASE_T0, TEASE["hop"], TEASE["arrive"] + 1e-6, "tease")
ev.append({"t": TOE["stub"], "kind": "impact", "tag": "stub"})
ev.append({"t": TOE["fast"], "kind": "spike", "tag": "jolt"})
ev.append({"t": TOE["slow"], "kind": "swell", "tag": "ache", "t1": TOE["slow"] + 1.6})
ev.append({"t": DRUM["traces"][0], "kind": "impact", "tag": "twitch1", "gain": -6.0})
ev.append({"t": DRUM["traces"][1], "kind": "impact", "tag": "twitch2", "gain": -6.0})
ev.append({"t": FIG["spark"], "kind": "spike", "tag": "pacemaker"})

cues_file = HERE / "build" / f"cues-{film['id']}-9x16.json"
shown = {}
if cues_file.exists():
    cues = json.loads(cues_file.read_text())
    by_tag = {c.get("tag"): c for c in cues.get("events", [])}
    for e in ev:
        c = by_tag.get(e.get("tag"))
        if c and e["kind"] in ("label", "counter.show", "scale", "badge") and c.get("pos"):
            e["pos"] = c["pos"]
        if c and e["kind"] in ("label", "counter.show") and cues.get("shown", {}).get(e["tag"]) is not None:
            shown[e["tag"]] = cues["shown"][e["tag"]]

sheet = {"duration": DUR, "fps": FPS, "preset": "meanwhile-pulse", "duck_db": -9.0,
         "sections": [{"id": b["id"], "t0": b["t0"], "t1": b["t1"], "energy": b["energy"]} for b in BEATS],
         "events": sorted(ev, key=lambda e: (e["t"], e["kind"])),
         "voice": [{"id": v["id"], "t": v["t"], "file": v["file"]} for v in film["voice"]]}
if shown:
    sheet["shown"] = shown

(HERE / "film.json").write_text(json.dumps(film, indent=1, ensure_ascii=False))
(HERE / "sheet.json").write_text(json.dumps(sheet, indent=1, ensure_ascii=False))
print(f"film.json: {len(SHOTS)} shots, {sum(len(v) for v in CAM.values())} camera keys, {len(LABELS)} labels, {len(SPINE)} readouts, "
      f"{len(BADGES)} badges, {len(film['captions'])} caption pages, end card {EC} s, {DUR} s")
print(f"sheet.json: {len(sheet['events'])} events ({'with' if shown else 'without'} the page's cue measurements)")
print("  cuts: " + ", ".join(f"{k} {v:.4f}" for k, v in CUT.items()))
