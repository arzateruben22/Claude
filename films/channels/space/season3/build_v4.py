"""build_v4.py <n> [--preview S]: One More Orbit v4 Part n (1 or 2) in the owner's voice -> long01/out/v4-part<n>[-yt].json (+ ep<12+n>/sfx.json).
Structure: opening line Bn, the part's lines (long01/voice5/lines.json), picture-led beats, one like/follow (or subscribe) line before the cliffhanger line in odd parts only, his closer (C<n>, if present).
The 'Thought experiment' tag is shown for the first 5 s only (0.3 s fade): TL.badge.
Owner's notes, 12 Nov 2026: no chip may repeat the spoken caption under it ("no need for double subtitles"), so the parts carry no chips; a beat opens only in
real silence (between two clips, or at the quietest point between two sentences of a line), never inside a word, and a voice piece is never shorter than 0.4 s."""
import json, os, re, sys, copy
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", ".."))
L1 = f"{ROOT}/films/channels/space/long01"; OUT = L1 + "/out"
g = {"__file__": HERE + "/build_timeline.py", "__name__": "bt"}; exec(open(HERE + "/build_timeline.py").read().split("tl = {}")[0], g)   # reuse insert_beats / split_caps / to_display
insert_beats, split_caps, to_display = g["insert_beats"], g["split_caps"], g["to_display"]
lines = {x["id"]: x for x in json.load(open(L1 + "/voice5/lines.json"))["lines"]}
N = int(sys.argv[1]); YT = "--yt" in sys.argv; PRE = float(sys.argv[sys.argv.index("--preview") + 1]) if "--preview" in sys.argv else None
G = 0.35
SPOKEN_CTA = N % 2 == 1      # the owner, 12 Nov 2026: a spoken like/follow ask only in every other part (1, 3, 5, 7); even parts keep only the silent pop-up, at the pause before the cliffhanger
CTA = (("D2" if YT else "D1") if N % 2 == 1 else ("D4" if YT else "D3")) if SPOKEN_CTA else None; NAME = f"v4-part{N}" + ("-yt" if YT else "") + ("-preview" if PRE else "")
PART = {1: {"hook": "B1", "body": ["L1", "L2", "L3", "L4", "L5"], "closer": "C1",
            "beats": [("__hook__", 3.0, "grow"), ("only goes down", 6.0, "approach"), ("A third wider", 3.0, "grow"), ("tidal pull", 3.5, "tide")],
            "chips": [], "km": [288300]},      # no chips: each one repeated the caption under it (owner, 12 Nov 2026)
        2: {"hook": "B3", "body": ["L6", "L7", "L8"], "closer": "C2",
            "beats": [("__hook__", 6.0, "approach"), ("the tidal pull", 11.0, "climb"), ("Not a measured height", 5.0, "tide"), ("lifted from above", 6.0, "pull")],
            "chips": [], "km": [192200], "start": 288300}}[N]
body = PART["body"]; cliff = body[-1]
def build(use_closer):
    # sequence of (id, from, dur): hook, body lines (the CTA goes before the cliffhanger line), the closer
    seq = [(PART["hook"], 0.0, lines[PART["hook"]]["dur"])] + [(i, 0.0, lines[i]["dur"]) for i in body[:-1]] + ([(CTA, 0.0, lines[CTA]["dur"])] if CTA else []) + [(cliff, 0.0, lines[cliff]["dur"])]
    if use_closer: seq.append((PART["closer"], 0.0, lines[PART["closer"]]["dur"]))
    clips, caps, t = [], [], 0.15
    for lid, frm, d in seq:
        if lid == CTA: t += 0.0
        clips.append({"id": lid, "file": lines[lid]["file"], "t": round(t, 3), "dur": d, "from": frm})
        for s in lines[lid]["sentences"]: caps.append({"t0": round(t + s["t0"], 3), "t1": round(t + s["t1"] + 0.25, 3), "text": s["text"], "line": lid})
        t += d + (0.3 if lid in (CTA,) or lid == seq[-1][0] else G)
    for a, b in zip(caps, caps[1:]): a["t1"] = round(min(a["t1"], b["t0"] - 0.02), 3) if b["t0"] > a["t0"] else a["t1"]
    if CTA: cta_t = next(c["t"] for c in clips if c["id"] == CTA)
    else:                                                       # no spoken ask: the pop-up's moment is the pause before the cliffhanger line
        cl = next(c for c in clips if c["id"] == cliff); prev = max((c for c in clips if c["t"] < cl["t"]), key=lambda c: c["t"]); cta_t = round((prev["t"] + prev["dur"] + cl["t"]) / 2, 3)
    def wav_env(lid):
        """the line's level per 10 ms (dBFS), or None if the file can't be read here"""
        try:
            import numpy as np, soundfile as sf
            x, sr = sf.read(f"{L1}/{lines[lid]['file']}", dtype="float32"); x = x if x.ndim == 1 else x.mean(1); h = int(0.01 * sr); n = len(x) // h
            return 20 * np.log10(np.sqrt((x[: n * h].reshape(n, h) ** 2).mean(1)) + 1e-9)
        except Exception:
            return None
    def silent_after(cap):
        """a beat boundary in real silence just after caption `cap`: between its clip and the next one when its sentence ends the line, else the quietest
        20 ms between this sentence and the next one in the same line (the owner, 12 Nov 2026: a beat that split a word left a cut-off sound)"""
        c = next(x for x in clips if x["id"] == cap["line"]); sents = lines[c["id"]]["sentences"]
        k = next(j for j, sn in enumerate(sents) if to_display(sn["text"]) == to_display(cap["text"]) or sn["text"] == cap["text"])
        if k == len(sents) - 1:
            nxt = min((x for x in clips if x["t"] > c["t"]), key=lambda x: x["t"]); return round((c["t"] + c["dur"] + nxt["t"]) / 2, 3)
        # the aligner's sentence edges can overlap (L7: 'height.' ends 1.52, 'Just' starts 1.445; the real pause is 1.23-1.42), so search the audio
        # from 0.4 s before the end of this sentence to 0.3 s after the start of the next one, inside both sentences
        a = max(sents[k]["t0"], sents[k]["t1"] - 0.4); b = min(sents[k + 1]["t1"], sents[k + 1]["t0"] + 0.3); E = wav_env(c["id"])
        if E is None or b - a < 0.03: return round(c["t"] + (sents[k]["t1"] + sents[k + 1]["t0"]) / 2, 3)
        import numpy as np
        i0, i1 = int(a / 0.01), max(int(a / 0.01) + 1, int(b / 0.01)); w = np.convolve(E[i0:i1 + 1], np.ones(3) / 3, "same")
        m = int(np.argmin(w)); lo = hi = m                                       # the middle of the quiet stretch around the quietest point
        while lo > 0 and w[lo - 1] <= w[m] + 10: lo -= 1
        while hi < len(w) - 1 and w[hi + 1] <= w[m] + 10: hi += 1
        T = round(c["t"] + (i0 + (lo + hi) / 2) * 0.01 + 0.005, 3)
        nxc = next((x for x in caps if x["line"] == c["id"] and x["text"] == sents[k + 1]["text"]), None)
        if nxc is not None and nxc["t0"] < T + 0.02: nxc["t0"] = round(T + 0.02, 3)        # the aligner started the next sentence inside the pause
        return T
    # beats
    items = []
    for after, d, kind in PART["beats"]:
        if after == "__hook__": T = silent_after([c for c in caps if c["line"] == PART["hook"]][-1])
        else: T = silent_after(next(c for c in caps if after in c["text"]))
        items.append((T, d, kind, PART["km"][0] if (kind == "approach" and PART["km"]) else None))
    items.sort(key=lambda x: x[0])
    st0 = PART.get("start", 384400); kk = [[0.0, st0]]
    if PART["km"]:
        T_ap = next(i[0] for i in items if i[2] == "approach"); kk += [[0.0, st0], [T_ap, PART["km"][0]]]
    tracks = {"eclipse": [[0, 0]], "moon": [[0, 1]], "brk": [[0, 0]], "ring": [[0, 0]], "tonight": [[0, 0]]}
    dur0 = t + 0.6
    nclips, ncaps, nkm, ntr, beats, (dur, cta_n) = insert_beats(clips, caps, kk, tracks, items, [dur0, cta_t])
    short = [(c["id"], c["dur"]) for c in nclips if c["dur"] < 0.4]
    if short: raise SystemExit(f"a beat split a voice clip into a piece shorter than 0.4 s: {short} (owner, 12 Nov 2026: no cut-off fragments)")
    # the voice goes where its captions are: a clip that starts just before a beat boundary must move with its first sentence (a clip whose t falls a hair before T is not shifted by the warp)
    for c in nclips:
        for sn in lines[c["id"]]["sentences"]:
            if sn["t0"] >= c["from"] - 0.01 and sn["t1"] <= c["from"] + c["dur"] + 0.02:
                cp = next((x for x in ncaps if x["line"] == c["id"] and x["text"] == sn["text"]), None)
                if cp is not None: c["t"] = round(cp["t0"] - (sn["t0"] - c["from"]), 3)
                break
    # chips from the words, at the final clip positions
    chips = []
    for (word, text, d, occ) in PART["chips"]:
        n = 0
        for c in nclips:
            for w in lines[c["id"]]["words"]:
                if re.sub(r"[^a-z]", "", w["w"].lower()) == word and c["from"] - 0.01 <= w["start"] <= c["from"] + c["dur"]:
                    n += 1
                    if n == occ: t0 = round(c["t"] + w["start"] - c["from"], 3); chips.append({"t0": t0, "t1": round(t0 + d, 3), "text": text})
    for c in ncaps: c["spoken"] = c["text"]; c["text"] = to_display(c["text"])
    tl = {"name": NAME, "mode": "port", "dur": round(dur, 3), "clips": nclips, "captions": split_caps(ncaps, 68), "km": nkm, "tracks": ntr, "beats": beats, "chips": chips,
          "badge": {"t": 5.0, "fade": 0.3}, "cta_at": cta_n, "cta_frac": round(cta_n / dur, 3), "cliff": cliff}
    if N == 1:   # the owner's motion note (12 Nov): nothing holds still. L1: a slow push toward the Moon; L2: an orbit arc widens and the Moon eases smaller along it (drifting off); 'Tonight, it reverses': the arc snaps back, the camera pulls back and the counter starts to fall, all the way to 288,300
        cp = {c["text"]: c for c in tl["captions"]}; l1 = cp["Tonight, the Moon starts coming closer."]["t0"]; l2 = next(c for c in tl["captions"] if c["text"].startswith("Right now"))["t0"]; rv = cp["Tonight, it reverses."]["t0"]
        tl["drift"] = {"a": round(l2 - 0.2, 3), "b": round(rv, 3), "c": round(rv + 1.4, 3)}
        tl["camera"] = [{"t": round(l1 + 0.3, 3), "s": 1.18, "pv": "moon"}, {"t": round(rv, 3), "s": 1.0, "pv": "moon"}, {"t": round(rv + 2.0, 3), "s": 1.12, "pv": "moon"}]
        for k in tl["km"]:
            if k[1] == 288300: k[:] = [k[0], 288300, round(k[0] - rv, 3)]     # one long glide that begins on the reverse line
        tl["stars"] = [{"t0": 0.35, "dur": 0.9, "x0": 0.06, "y0": 0.31, "x1": 0.58, "y1": 0.385}, {"t0": round(l2 + 4.5, 3), "dur": 0.9, "x0": 0.04, "y0": 0.30, "x1": 0.46, "y1": 0.37}]
    if N == 1 and False: tl["stars"] = [{"t0": 0.35, "dur": 0.9, "x0": 0.06, "y0": 0.31, "x1": 0.58, "y1": 0.385}]
    return tl
use_closer = "C%d" % N in lines
tl = build(use_closer)
if PRE:   # preview: the first PRE seconds only (cut at a caption boundary)
    tl["dur"] = PRE
os.makedirs(OUT, exist_ok=True); json.dump(tl, open(f"{OUT}/{NAME}.json", "w"), indent=1, ensure_ascii=False)
print(NAME, tl["dur"], "s; CTA at", tl["cta_frac"], "closer" if use_closer else "no closer", [(b["kind"], b["t0"], b["t1"]) for b in tl["beats"]]); print([(c["t0"], c["t1"], c["text"]) for c in tl["captions"]]); print(tl["chips"], tl["km"])
# ---- the sound-effects sheet (palette space, kits/cinema/sound/sfx.py; its -2.5 dB trim is built in): times before the CTA are absolute, later ones hang on the cliffhanger caption so the 'subscribe' cut follows
cap_end = max(c["t1"] for c in tl["captions"] if c["line"] == cliff); cta = tl["cta_at"]; cues = []; r = lambda x: round(x, 2)
def at(t): return r(t) if t < cta else f"capend:{cliff}{t - cap_end:+.2f}"
def cue(t, kind, **kw): cues.append({"at": at(t), "kind": kind, **kw, "seed": N * 100 + len(cues) + 1})
cue(0.1, "mass", dur=6.0, gain=-3)
if N == 1: cue(0.35, "shooting_star", dur=1.2, pan=[0.0, 0.8], gain=-2)
for b in tl["beats"]:
    t0, t1, k = b["t0"], b["t1"], b["kind"]; d = r(t1 - t0)
    if k == "approach": cue(t0 - 0.2, "mass", dur=r(d + 1.8), gain=-2, f0=41); cue(t0, "whoosh", dur=d, pan=[-0.4, 0.4], gain=-2); cue(t1, "boom", dur=2.5, gain=-4); cue(t1, "tick", gain=-2)
    elif k in ("grow", "pull"): cue(t0, "whoosh", dur=d, pan=[0.3, -0.3], gain=-3); cue(t0 + 0.2, "mass", dur=r(d + 0.8), gain=-4, f0=44)
    elif k in ("tide", "climb"): cue(t0, "surge", dur=r(d + 0.5), gain=1); cue(t0 + d * 0.45, "wave", dur=2.6, gain=-1)
    elif k == "sunbeam": cue(t0, "shimmer", dur=d, gain=-3)
    elif k == "drift": cue(t0, "tick", gain=-3, repeat=int(d / 0.5), every=0.5)
    elif k == "tick": cue(t0, "tick", gain=-2, repeat=max(2, int(d / 0.5)), every=0.5)
if N == 1:
    D = tl["drift"]; l1 = next(c for c in tl["captions"] if c["text"].startswith("Tonight, the Moon starts"))["t0"]
    cue(l1 - 0.2, "mass", dur=6.0, gain=-3, f0=40)                                  # L1: a low mass swell under the push toward the Moon
    cue(D["a"] + 4.3, "shooting_star", dur=1.2, pan=[-0.8, 0.0], gain=-3)          # the second star
    cue(D["b"] - 0.9, "riser", dur=0.9, gain=0); cue(D["b"], "whoosh", dur=1.4, pan=[0.6, -0.6], gain=0); cue(D["b"] + 0.05, "boom", dur=2.5, gain=-3); cue(D["b"] + 0.05, "tick", gain=-1)   # the reversal
    cue(D["b"] + 0.2, "mass", dur=12.0, gain=-4, f0=38); cue(D["b"] + 1.4, "tick", gain=-4, repeat=14, every=0.7)   # the counter falling
for c in tl["chips"]: cue(c["t0"], "tick", gain=-1); cue(c["t0"], "boom", dur=1.8, gain=-7)
cues.append({"at": f"cap:{cliff}-1.4", "kind": "riser", "until": f"capend:{cliff}+0.1", "gain": 2, "seed": N * 100 + 90}); cues.append({"at": f"capend:{cliff}+0.1", "kind": "boom", "dur": 3.0, "gain": 0, "seed": N * 100 + 91})
if "--yt" not in sys.argv:
    json.dump({"palette": "space", "cues": cues}, open(f"{L1}/v4/part{N}{'-preview' if PRE else ''}.sfx.json", "w"), indent=1); print("sfx cues", len(cues))
