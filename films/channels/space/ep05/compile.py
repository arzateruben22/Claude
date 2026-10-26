"""Compile Light Minute No. 005, "How big is the Sun": script + voice timings + this direction → film.json and
sheet.json. Every moment hangs on a beat or a spoken word; every physical number comes from claims.json.

  python3 -I films/channels/space/ep05/compile.py

Two places, one cut between them (on the change's section sound):
- "sky": the Moon and the Sun at their true size and distance ratios (Moon 1737 km at 384,400 km, Sun 696,000 km at
  149.6 million km), scaled down together, so from the camera at Earth they really look the same size. On "But" a cut
  to "wide" (beside the Sun, the Moon moved next to it at its true size: 400 times narrower), on "and" a cut to "side"
  (the line seen square-on: 400 times farther).
- "sun": the Sun 100 units in radius (1 unit = 6,963 km) at true scale with 109 Earths across its face, a big sunspot
  with an Earth in it, the Peloponnese as a map shrinking to a dot, the Sun melted down into beads (1 dot = 200 Earths,
  badged), then the episode's one scale jump: the whole place shrinks ×850 until the Sun is a dot among stars, inside
  the outline of the largest known stars (over 1,000 times wider); from the takeaway a push in on the Sun for the
  readout's light.
"""
import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[3] / "kits/cinema/script"))
from timeline import Film   # noqa: E402
sys.path.insert(0, str(HERE.parent / "set"))
from capglue import glue, hold, keep_units    # noqa: E402

FPS, BPM = 30, 56.25
ID = "lightminute-005"
f = Film(HERE / "script.md", HERE / "vo", fps=FPS, bpm=BPM)
plan, end_hold = f.script_plan()
BEATS = f.layout(plan, end_hold=end_hold)
A = f.at
B = {b["id"]: b for b in BEATS}

# ── the physics (claims.json) ───────────────────────────────────────────────
R_SUN_KM, R_EARTH_KM, R_MOON_KM = 696000.0, 6371.0, 1737.4
D_MOON_KM, D_SUN_KM = 384400.0, 149.6e6
U = R_SUN_KM / 100                         # "sun" place: km per unit (the Sun is 100 units in radius)
R_E = R_EARTH_KM / U                       # 0.915: 109 of them across (c3)
N_ACROSS = round(R_SUN_KM / R_EARTH_KM)    # 109
VOL = (R_SUN_KM / R_EARTH_KM) ** 3         # c7: 1.30 million
DOTS = 6500                                # the melted Sun drawn as 6,500 dots: 1 dot = 200 Earths
PER_DOT = round(VOL / DOTS, -1)
SPOT_DIR = [v / math.sqrt(0.25**2 + 0.8**2 + 0.545**2) for v in (0.25, -0.8, 0.545)]   # the big sunspot sits near the lower limb
BASE = 0.25                                # the "sun" place is drawn at a quarter size (the Sun 25 units in radius), so the camera stays inside the sky
SPOT_P = [100.0 * BASE * v for v in SPOT_DIR]
SPOT_R = 2.6 * R_E                         # a big sunspot, 2.6 Earth radii (about 33,000 km across; c14: up to 50,000 km)
PELO_KM = 2 * math.sqrt(21550 / math.pi)   # c15: 166 km (the dot: a circle of the peninsula's area)
PELO_ACROSS = 200.0                        # c15: the ring's start, about 200 km: the Sun is about 7,000 times wider
GIANT = 1000.0                             # c8: the largest known stars, over 1,000 × the Sun's radius
SKY_K = 1.0 / 150000.0                     # "sky" place: km → units (the Moon 2.56 units out, the Sun 997)
SEP = 0.0080                               # the pair's angular offset either side of the line of sight (rad): both discs whole in the frame
assert N_ACROSS == 109 and abs(VOL - 1.30e6) < 0.02e6, (N_ACROSS, VOL)

t_cut = B["change"]["t0"]
t_wide, t_side = A("vo02:But"), A("vo02:and#2")   # "wider" beside the Sun, "farther" from the side
t_row0, t_row1 = A("vo03:Line"), A("vo03:Your", -0.9)   # "nine" is said about 17.6 s (the aligner bunched the spelled number at its start)
t_spot = A("vo03:sunspot")
t_pelo = A("vo04:Greece")
t_melt0, t_melt1 = A("vo05:Melt"), A("vo05:fill")
t_j0, t_j1 = A("vo05:Yet", -0.1), A("vo05:Some")
assert t_j1 - t_j0 <= 3.0, (t_j0, t_j1)
t_end = A("vo08:Next", -0.25)
SHRINK = 1.0 / 850.0                       # the jump: the "sun" place shrinks ×850 more (the 1,000× outline then 29 units, above the spine)

# ── camera (rig.js keys; one per place) ─────────────────────────────────────
key = lambda t, **k: {"t": round(t, 4), "fx": 0.5, **{"fov": 24, **k}}
mz = D_MOON_KM * SKY_K
SKY0 = dict(target=[0, 0, -mz], dist=mz, el=0.0, az=0.0, fy=0.40, fov=3.3)   # at Earth, looking at the pair (a long lens; below the title)
# "wide": 78 units off the Sun (about half the frame's width), the Moon moved beside it at its true size (1 px, ringed):
# "four hundred times wider". The Sun sits left of centre so the Moon and its label stay inside the safe box.
SUN_AT = [D_SUN_KM * SKY_K * math.tan(SEP), 0.0, -D_SUN_KM * SKY_K]
WIDE = dict(target=SUN_AT, dist=78.0, el=0.0, az=0.0, fx=0.36, fy=0.33, fov=24)
# "side": the same place seen square-on, from far out to the side, rolled so the line runs from Earth (lower left,
# above the spine) to the Sun (upper right): the depth the twins hid. A cut on "and" ("four hundred times farther"),
# then a slow drift.
# (the roll turns the frame offset too: fx, fy are chosen so the midpoint lands at x 0.5, y 0.33 after it)
SIDE = dict(target=[0, 0, -D_SUN_KM * SKY_K * 0.5], dist=4660.0, el=12.0, az=90.0, roll=-40.0, fx=0.6943, fy=0.3698, fov=30)
SUNF = dict(target=[0, 0, 0], dist=420.0, el=0.0, az=0.0, fy=0.33)        # the Sun about 0.29 of the frame's height
def zoom(ta, tb, pa, pb, n=4):
    """log-spaced fov keys from pose pa (at ta) to pose pb (at tb): the zoom's magnification grows evenly in time. The aim
    moves in step with the magnification m = 1/(dist·tan(fov/2)), so the subject slides straight to its place instead of
    swinging through the spine and the caption (a plain lerp moves the aim early, while m is still small)"""
    ltan = lambda p: math.log(math.tan(math.radians(p["fov"]) / 2))
    ma, mb = 1 / (pa["dist"] * math.exp(ltan(pa))), 1 / (pb["dist"] * math.exp(ltan(pb)))
    out = []
    for i in range(1, n + 1):
        u = i / n
        e = u * u * (3 - 2 * u)                     # a smoothstep on log fov, so the move starts and lands gently
        lerp = lambda a, b: a + (b - a) * e
        dist, lt = math.exp(lerp(math.log(pa["dist"]), math.log(pb["dist"]))), lerp(ltan(pa), ltan(pb))
        m = 1 / (dist * math.exp(lt))
        w = 1 - (1 - e) * ma / m if mb > ma else e * mb / m   # the aim's share of the way (zooming in, then out)
        out.append(key(ta + (tb - ta) * u, target=[pa["target"][j] + (pb["target"][j] - pa["target"][j]) * w for j in range(3)],
                       dist=dist, el=lerp(pa["el"], pb["el"]), az=lerp(pa["az"], pb["az"]),
                       fov=math.degrees(2 * math.atan(math.exp(lt))), fy=lerp(pa["fy"], pb["fy"]), ease="lin"))
    return out
ROWV = dict(SUNF, dist=268.0, fy=0.27, fov=24.0)
SPOTV = dict(target=SPOT_P, dist=420.0, el=0.0, az=0.0, fov=1.25, fy=0.3)
SPOTV2 = dict(SPOTV, fov=1.15)
ZOOM_IN = zoom(t_spot - 0.3, t_spot + 1.0, ROWV, SPOTV, n=6)
ZOOM_OUT = zoom(A("vo04:ago"), A("vo04:said"), SPOTV2, dict(SUNF, dist=405.0, fov=24.0, fy=0.36), n=8)
# the why beat: a slow push while Anaxagoras is told and the ring grows (the el/az drift to the melt runs on through it)
u_why = lambda t: (t - A("vo04:said")) / (t_melt0 - A("vo04:said"))
# the push from the takeaway to the end card: 4.8% a second in log distance, eased in over 1.2 s and out over the last
# 1.2 s (each ramp counts half), turning on through the star field in step with it
t_take = B["takeaway"]["t0"]
PUSH0, N_PUSH = dict(SUNF, dist=440.0, el=12.9, az=19.0, fy=0.35), t_end - t_take - 1.2
push = lambda t, done, ease: key(t, **dict(PUSH0, dist=440.0 * math.exp(-0.048 * done), el=12.9 + 1.1 * done / N_PUSH, az=19.0 + 11.0 * done / N_PUSH), ease=ease)
CAM = {
    # the hook: a slow push on the twins from frame 0 (frame 0 is SKY0, so the loop holds); the end card comes back to it
    "sky": [key(0.0, **SKY0), key(t_wide - 0.05, **dict(SKY0, fov=3.0), ease="sine"),
            key(t_end + 0.3, **dict(SKY0, dist=mz * 1.02)), key(t_end + 2.6, **SKY0, ease="inout3")],
    "wide": [key(t_wide, **WIDE), key(t_side, **dict(WIDE, dist=75.0), ease="sine")],
    "side": [key(t_side, **SIDE), key(t_cut, **dict(SIDE, dist=4480.0, az=92.0), ease="sine")],
    # the row: push in while the Earths are counted (each Earth about 7 px across), then a long lens on the sunspot near
    # the lower limb (dark sky under it for the text), from the same spot in front of the Sun
    # (the Sun about 0.78 of the frame's width at dist 270, each Earth about 8 px; its lower limb stays above the spine)
    "sun": [key(t_cut, **SUNF), key(t_row0, **SUNF, ease="sine"), key(t_row1, **dict(SUNF, dist=270.0, fy=0.27), ease="inout3"),
            key(t_spot - 0.3, **dict(SUNF, dist=268.0, fy=0.27), ease="sine"),
            # the ×20 zoom in log-spaced steps (the rig lerps fov linearly; one key would bunch the zoom into half a second)
            *ZOOM_IN,
            key(A("vo04:ago"), target=SPOT_P, dist=420.0, el=0.0, az=0.0, fov=1.15, fy=0.3, ease="sine"),
            *ZOOM_OUT,
            # (the Sun a little low while the Anaxagoras card is up: its limb stays under the card's plate)
            key(A("vo04:Calling"), **dict(SUNF, dist=380.0, fy=0.36, el=10.0 * u_why(A("vo04:Calling")), az=8.0 * u_why(A("vo04:Calling"))), ease="sine"),
            key(A("vo04:thousand"), **dict(SUNF, dist=358.0, fy=0.34, el=10.0 * u_why(A("vo04:thousand")), az=8.0 * u_why(A("vo04:thousand"))), ease="sine"),
            key(t_melt0, **dict(SUNF, dist=400.0, el=10.0, az=8.0), ease="sine"),
            # (pulled back as the jump starts, so the outline lands clear of the note above it)
            key(t_j0, **dict(SUNF, dist=425.0, el=12.0, az=11.8), ease="sine"),
            # one star among many: a slow orbit through the star field (the parallax); the 1,000× outline stays between
            # the top notes and the spine (dist 425–440 at fy 0.35)
            key(t_take, **PUSH0, ease="sine"),
            # the takeaway and the readout: the outline gone, a push in on the Sun at the drift limit, so Earth's orbit
            # is about twice as wide by "Sun to Earth"
            push(t_take + 1.2, 0.6, "in2"), push(t_end - 1.2, N_PUSH - 0.6, "lin"), push(t_end, N_PUSH, "out2")],
}
for shot, keys in CAM.items():           # the bible's arc limit: ≤ 1.5° a second, in azimuth and in elevation
    for a, b in zip(keys, keys[1:]):
        for k in ("az", "el"):
            rate = abs(b[k] - a[k]) / (b["t"] - a["t"])
            assert rate <= 1.5 + 1e-9, f"{shot}: {k} turns {rate:.2f}°/s between {a['t']:.2f} and {b['t']:.2f} s (keep ≤ 1.5°/s)"
# the end card's cut lands 0.3 s after the card starts, under its scrim (no bright frame under the arriving title)
SHOTS = [{"at": 0.0, "name": "sky"}, {"at": t_wide, "name": "wide"}, {"at": t_side, "name": "side"}, {"at": t_cut, "name": "sun"},
         {"at": round(t_end + 0.3, 4), "name": "sky"}]

# ── the overlay ─────────────────────────────────────────────────────────────
SPINE = [0.5, 0.555]
LABELS = [
    # the twins keep their names through the push (one pair, no blink), until the cut
    {"id": "l-sun-h", "text": "Sun", "kind": "star", "anchor": "skysun", "t0": 0.0, "t1": t_wide, "side": 1, "shot": "sky"},
    {"id": "l-moon-h", "text": "Moon", "kind": "body", "anchor": "skymoon", "t0": 0.0, "t1": t_wide, "side": -1, "shot": "sky"},
    # the wide shot: the Moon's label hangs above-right of its ring (clear of the Sun's limb)
    {"id": "l-sun-w", "text": "Sun", "kind": "star", "anchor": "skysun", "t0": round(t_wide + 0.2, 4), "t1": t_side, "side": -1, "shot": "wide"},
    {"id": "l-moon-w", "text": "Moon", "kind": "body", "anchor": "wmoon", "t0": round(t_wide + 0.6, 4), "t1": t_side, "side": 1, "shot": "wide"},
    {"id": "l-sun-x", "text": "Sun", "kind": "star", "anchor": "skysun", "t0": round(t_side + 0.2, 4), "t1": t_cut, "side": -1, "shot": "side"},
    # below Earth: the sight lines leave it up and to the right
    {"id": "l-you", "text": "Earth and Moon", "kind": "body", "anchor": "you", "t0": round(t_side + 0.6, 4), "t1": t_cut, "side": 1, "v": "below", "shot": "side"},
    {"id": "l-row", "text": "109 Earths", "kind": "body", "anchor": "row", "t0": t_row1, "t1": A("vo03:inside"), "side": 1, "shot": "sun"},
    # the sunspot's pill arrives as the zoom lands (not riding its fastest part); the Earth in it needs no pill (the
    # globe and "your whole world" name it, and every spot near it lies on the spot)
    {"id": "l-spot", "text": "a big sunspot", "kind": "star", "anchor": "spot", "t0": round(t_spot + 1.0, 4), "t1": B["why"]["t0"] + 1.0, "side": -1, "shot": "sun"},
    # after the map has shrunk to its dot (the pill never sits on its own subject), gone before the ring reaches it
    {"id": "l-pelo", "text": "southern Greece", "kind": "body", "anchor": "pelo", "t0": round(t_pelo + 1.8, 4), "t1": round(A("vo04:Bigger#2") + 0.6, 4), "side": 1, "shot": "sun"},
    # once the "map enlarged" note above it has gone (no hop as the note leaves)
    {"id": "l-x7000", "text": "×7,000", "kind": "star", "anchor": "x7000", "t0": round(A("vo04:thousand") + 0.35, 4), "t1": round(t_melt0 - 0.45, 4), "side": 1, "shot": "sun"},
    {"id": "l-sun-d", "text": "the Sun", "kind": "star", "anchor": "sundot", "t0": A("vo05:giant"), "t1": round(A("vo07:Sun#2") - 0.3, 4), "side": -1, "shot": "sun"},
    # anchored on the outline's lower-right arc, the pill to its left, inside the outline (never across the line it
    # names); it leaves with the outline as the takeaway starts
    {"id": "l-giant", "text": "largest known stars", "kind": "star", "anchor": "giant", "t0": A("vo05:Some"), "t1": t_take, "side": -1, "shot": "sun"},
    # the readout: Earth's orbit drawn to the outline's scale (1 AU = about 215 Sun radii); the pill under the orbit's
    # foot, between it and the spine, once the orbit has faded in
    {"id": "l-orbit", "text": "Earth's orbit", "kind": "gravity", "anchor": "orbit", "t0": round(A("vo07:Sun#2") + 0.4, 4), "t1": round(t_end - 0.45, 4), "side": -1, "v": "below", "shot": "sun"},
]
TITLE_T1 = B["normal"]["t0"] - 0.5
# A note leaves before the next one in its slot arrives (a note's fade is 0.3 s): nothing slides over an outgoing plate
BADGES = [
    {"id": "b-pair", "text": "true sizes, shown side by side", "t0": 0.0, "t1": round(t_wide - 0.3, 4), "slot": "tr"},   # on frame 0 (the loop point), above the title
    {"id": "b-wide", "text": "true sizes, not distances", "t0": t_wide, "t1": round(t_side - 0.3, 4), "slot": "tr"},   # the Moon moved beside the Sun
    {"id": "b-sky", "text": "true distances, shrunk", "t0": t_side, "t1": round(t_cut - 0.3, 4), "slot": "tl"},   # the side view
    {"id": "b-dots", "text": "dots enlarged", "t0": round(t_side + 0.5, 4), "t1": round(t_cut - 0.6, 4), "slot": "tl"},   # after the first note has settled; the lower note leaves first
    {"id": "b-true", "text": "true scale", "t0": t_cut, "t1": A("vo04:ago"), "slot": "tr"},   # the row and the sunspot; gone before the zoom out sweeps the limb under it
    {"id": "b-dot", "text": "map enlarged", "t0": t_pelo, "t1": A("vo04:thousand"), "slot": "tr"},   # southern Greece's outline, until the ring has grown from it
    {"id": "b-melt", "text": "1 dot = 200 Earths, by volume", "t0": t_melt0, "t1": round(t_j0 + 0.1, 4), "slot": "tr"},
    {"id": "b-illus", "text": "illustration · star spacing not to scale", "t0": A("vo05:giant"), "t1": round(t_end - 0.45, 4), "slot": "tr"},
    # the readout's ring of light reaches Earth's orbit in 1.7 s, not 8 min 20 s; it leaves with the light, before the note above it
    {"id": "b-light", "text": "light sped up", "t0": A("vo07:Sun#2"), "t1": round(t_end - 0.75, 4), "slot": "tr"},
    # the why beat's card (narrow, so it never meets the right-hand notes: no stacking, no hop; the why beat's framing
    # keeps the Sun's limb under it)
    {"id": "b-anax", "text": "Anaxagoras\nAthens, 5th century BCE", "t0": A("vo04:Athens"), "t1": A("vo04:impiety"), "slot": "tl", "maxW": 0.6},
]
COUNTERS = [
    {"id": "c-hook", "label": "Earths inside", "text": "?", "t0": 0.0, "t1": A("vo02:four")},   # the question stays open until the first number
    # "farther" joins with the side view and the second "four hundred" (heard about 11.5 s), not before
    {"id": "c-400w", "label": "wider", "text": "400×", "t0": A("vo02:four"), "t1": round(t_side + 0.3, 4)},
    {"id": "c-400f", "label": "wider · farther", "text": "400× · 400×", "t0": round(t_side + 0.3, 4), "t1": round(t_cut - 0.4, 4)},
    {"id": "c-row", "label": "Earths across", "fmt": "count", "from": 1, "to": N_ACROSS, "c0": t_row0, "c1": t_row1, "t0": t_row0, "t1": round(t_spot - 0.75, 4)},   # gone before the zoom fills the frame with white
    {"id": "c-guess", "label": "his guess · bigger than", "text": "southern Greece", "t0": A("vo04:bigger"), "t1": A("vo04:By")},   # the card already names him
    {"id": "c-7000", "label": "bigger, yes · wider by a factor of", "text": "7,000", "t0": A("vo04:seven"), "t1": t_melt0},
    {"id": "c-melt", "label": "Earths inside, by volume", "fmt": "count", "from": 0, "to": round(VOL, -5), "c0": t_melt0, "c1": t_melt1, "t0": t_melt0, "t1": round(t_j0 + 0.6, 4)},   # leaves as the jump starts
    {"id": "c-giant", "label": "wider than the Sun", "text": ">1,000×", "t0": A("vo05:Some"), "t1": B["takeaway"]["t0"]},
    {"id": "c-dwarf", "label": "the Sun's class", "text": "G2V · dwarf", "t0": A("vo06:dwarf"), "t1": B["readout"]["t0"]},
    {"id": "c-read-x", "label": "light time · across the Sun", "text": "5 s", "read": True, "t0": A("vo07:Light"), "t1": round(A("vo07:Sun#2") - 0.05, 4)},
    {"id": "c-read-e", "label": "light time · Sun to Earth", "text": "8 min 20 s", "read": True, "t0": A("vo07:Sun#2"), "t1": round(t_end - 0.45, 4)},   # gone before the end card
]
for c in COUNTERS:
    c.setdefault("at", SPINE)
spine = [c for c in COUNTERS if c["at"] == SPINE]
for a, b in zip(spine, spine[1:]):
    if b["t0"] - a["t1"] < 0.4:
        a["t1"] = round(b["t0"] - 0.4, 4)

TITLE = {"series": "Light Minute · No. 005", "title": "How big is the *Sun*", "t1": TITLE_T1, "sig": A("line:vo01:end", 0.05), "y": 0.17}   # below the hook's note
END = {"title": "Next light: how fast are you *moving*", "follow": "Light Minute · No. 006",
       "next": "The Sun holds about 99.8% of all the mass in the solar system."}   # footnote (c18; NASA)

CUE = {"wide": t_wide, "side": t_side, "orbit": A("vo07:Sun#2"), "light": A("vo07:Light"), "twenty": A("vo07:twenty"), "x0": A("vo04:Bigger#2"), "x1": A("vo04:thousand"),
       "cut": t_cut, "row0": t_row0, "row1": t_row1, "spot": t_spot, "pelo": t_pelo, "melt0": t_melt0, "melt1": t_melt1, "j0": t_j0, "j1": t_j1, "giant": A("vo05:Some"),
       "dwarf": A("vo06:dwarf")}
POSTER = round(t_melt1 + 0.5, 4)           # the filled bead Sun with "1,300,000"
# captions: the aligner didn't hear the spelled numbers and bunched their words at the number's start; the highlight
# takes the word starts measured from the voice's envelope (film seconds; after the last anchor lookup, before glue;
# "word#2" is its second time in the line)
HEARD = {"vo02": {"four": 9.35, "hundred": 9.6, "four#2": 11.5, "hundred#2": 11.8}, "vo03": {"hundred": 17.1, "and": 17.4, "nine.": 17.55},
         "vo04": {"thousand.": 37.65}, "vo05": {"point": 41.82, "three": 42.28}, "vo08": {"thousand": 70.4}}
for ln in f.lines:
    for w, ts in HEARD.get(ln["id"], {}).items():
        base, n = (w.split("#") + ["1"])[:2]
        [x for x in ln["words"] if x["w"] == base][int(n) - 1]["start"] = round(ts - ln["t"], 3)
# number phrases and fixed phrases stay on one line
glue(f, {"vo01": ["a million"], "vo02": ["the Sun", "the full Moon", "look the same size."],
         "vo03": ["would fit inside", "one big sunspot."],
         "vo04": ["a fiery stone,", "than southern Greece."],
         "vo05": ["a thousand"], "vo06": ["the Sun", "dwarf stars."],
         "vo07": ["the Sun:", "about five seconds.", "Sun to Earth:", "eight minutes,", "twenty seconds."]})

film = {
    "id": ID, "fps": FPS, "bpm": BPM, "dur": f.duration, "poster": POSTER,
    "shots": SHOTS, "beats": BEATS,
    "phys": {"u": U, "r_e": R_E, "n_across": N_ACROSS, "vol": VOL, "dots": DOTS, "per_dot": PER_DOT, "spot_r": SPOT_R, "spot_dir": SPOT_DIR, "pelo_km": PELO_KM, "pelo_across": PELO_ACROSS,
             "giant": GIANT, "au_r": D_SUN_KM / R_SUN_KM, "sky_k": SKY_K, "sep": SEP, "r_sun_km": R_SUN_KM, "r_moon_km": R_MOON_KM, "d_moon_km": D_MOON_KM, "d_sun_km": D_SUN_KM, "shrink": SHRINK, "base": BASE},
    "cam": CAM, "cue": CUE,
    "labels": LABELS, "badges": BADGES, "counters": COUNTERS,
    "title": TITLE, "endCard": t_end, "end": END,
    "captions": hold(f, keep_units(f.captions(max_chars=24))),   # each page stays until its last phrase has been spoken
    "voice": [{"id": ln["id"], "t": ln["t"], "dur": ln["dur"], "file": ln["file"], "text": ln["text"]} for ln in f.lines],
}
ev = [{"t": b["t0"], "kind": "section", "id": b["id"], "t1": b["t1"]} for b in BEATS]
ev.append({"t": TITLE["sig"], "kind": "signature", "tag": "title"})
ev.append({"t": t_end, "kind": "signature", "tag": "end"})
ev += [{"t": L["t0"], "kind": "label", "tag": L["id"]} for L in LABELS if L["t0"] > 0]
ev += [{"t": c["t0"], "kind": "counter.show", "tag": c["id"]} for c in COUNTERS if c["t0"] > 0]
ev += [{"t": b["t0"], "kind": "badge", "tag": b["id"]} for b in BADGES if b["t0"] > 0]
ev += [{"t": t_row1, "kind": "counter.end", "tag": "c-row-end"} if False else {"t": t_row1, "kind": "arrive", "tag": "row-full"},
       {"t": t_melt1, "kind": "arrive", "tag": "sun-full"},
       {"t": t_j0, "kind": "scale.jump", "tag": "to-giants", "t1": t_j1}]
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
sheet = {"duration": f.duration, "fps": FPS, "preset": "lightminute-vacuum",
         "sections": [{"id": b["id"], "t0": b["t0"], "t1": b["t1"], "energy": b["energy"]} for b in BEATS],
         "events": sorted(ev, key=lambda e: e["t"]), "voice": [{"id": v["id"], "t": v["t"], "file": v["file"]} for v in film["voice"]]}
if shown:
    sheet["shown"] = shown
(HERE / "film.json").write_text(json.dumps(film, indent=1, ensure_ascii=False))
(HERE / "sheet.json").write_text(json.dumps(sheet, indent=1, ensure_ascii=False))
print(f"film.json: {f.duration:.2f} s, {len(LABELS)} labels, {len(COUNTERS)} counters; {N_ACROSS} across, {VOL:,.0f} by volume "
      f"({DOTS} dots × {PER_DOT:.0f}); jump {t_j0:.2f}–{t_j1:.2f}; end card {t_end:.2f}")
print(f"sheet.json: {len(sheet['events'])} events" + (f", {len(shown)} shown" if shown else ""))
