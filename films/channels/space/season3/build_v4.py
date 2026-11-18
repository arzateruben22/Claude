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
if not os.environ.get("NOMILES"):      # the owner's sheet (16 Nov 2026): the 11 miles lines replace their kilometers lines (same ids, same windows); STAND-IN voice (AI) until he records them
    for x in json.load(open(L1 + "/voice6/lines.json"))["lines"]: lines[x["id"]] = x
N = int(sys.argv[1]); YT = "--yt" in sys.argv; PRE = float(sys.argv[sys.argv.index("--preview") + 1]) if "--preview" in sys.argv else None
G = 0.35
SPOKEN_CTA = N % 2 == 1      # the owner, 12 Nov 2026: a spoken like/follow ask only in every other part (1, 3, 5, 7); even parts keep only the silent pop-up, at the pause before the cliffhanger
_dp = ((N - 1) // 2) % 2        # odd parts alternate the two lines: 1, 5 -> "If that made the sky feel bigger"; 3, 7 -> "Still looking up?"
CTA = ((("D2" if YT else "D1") if _dp == 0 else ("D4" if YT else "D3"))) if SPOKEN_CTA else None
NAME = f"v4-part{N}" + ("-yt" if YT else "") + ("-preview" if PRE else "")
if N == 0: SPOKEN_CTA = True; CTA = "D2"; YT = True; NAME = "v4-long"       # the long film: YouTube only, two asks (after the eclipse payoff, and at the end)
PART = {1: {"hook": "B1", "body": ["L1", "L2", "L3", "L4", "L5"], "closer": "C1",
            "beats": [("__hook__", 3.0, "grow"), ("only goes down", 6.0, "approach"), ("A third wider", 3.0, "grow"), ("tidal pull", 3.5, "tide")],
            "chips": [], "km": [288300]},      # no chips: each one repeated the caption under it (owner, 12 Nov 2026)
        2: {"hook": "B3", "body": ["L6", "L7", "L8"], "closer": "C2",
            "beats": [("__hook__", 6.0, "approach"), ("the tidal pull", 11.0, "climb"), ("Not a measured height", 5.0, "tide"), ("lifted from above", 6.0, "pull")],
            "chips": [], "km": [192200], "start": 288300},
        3: {"hook": "B4", "body": ["L9", "L11"], "closer": None, "start": 192200, "km": [], "glide": 150000, "glide_frac": 0.67,      # owner, 17 Nov 2026: the Moon visibly nearer all the way (the counter falls through two thirds of the part, camera locked), less talking (L10 cut)
            "beats": [("Six and a half times", 6.0, "bright"), ("sharp on the sand", 5.0, "bright")], "chips": []},
        4: {"hook": "B5", "body": ["L12", "L13"], "closer": "C4", "start": 150000, "km": [100000],
            "beats": [("__hook__", 7.0, "approach"), ("Nearly four times wider", 5.0, "grow"), ("far more often", 7.0, "eclipse"), ("because the orbit is tilted", 5.0, "pull"), ("But often", 7.0, "eclipse"), ("Faster", 4.0, "grow")], "chips": []},
        5: {"hook": "B6", "body": ["L14", "L15"], "closer": None, "start": 100000, "km": [70000],
            "beats": [("__hook__", 7.5, "approach"), ("Forty-three thousand", 5.0, "grow"), ("today's tidal pull", 7.0, "tide"), ("about a foot a day", 8.5, "flex"), ("flex far more", 8.0, "flex")], "chips": []},
        6: {"hook": "B7", "body": ["L16", "L17", "L18"], "closer": "C6", "start": 70000, "km": [50000], "keys": [("Twenty-six thousand", 42000, 1.5)],
            "beats": [("__hook__", 7.0, "approach"), ("Nearly eight times wider", 4.0, "grow"), ("how fast the Earth turns", 4.0, "pull"), ("It hangs still", 5.5, "grow"), ("slides the wrong way", 9.0, "slide"), ("rises in the west", 7.0, "rise")], "chips": []},
        7: {"hook": "B8", "body": ["L19", "L20", "L21", "L22"], "closer": None, "start": 42000, "km": [30000], "keys": [("Sixteen", 25000, 1.0), ("Twelve.", 20000, 1.0), ("Around eleven thousand", 18000, 1.5)],
            "beats": [("__hook__", 5.5, "approach"), ("Twelve.", 5.0, "grow"), ("six thousand", 5.0, "strain"), ("straining", 7.0, "strain")], "chips": []},
        0: {"seq": [f"L{i}" for i in range(1, 13)] + ["D2"] + [f"L{i}" for i in range(13, 27)] + ["D4"], "hook": "L1", "body": [f"L{i}" for i in range(2, 27)], "closer": None, "start": 384400, "km": [288300], "motion1": True,
            "beats": [(("L3", "only goes down"), 6.0, "approach", 288300), (("L4", "A third wider"), 3.0, "grow"), (("L4", "tidal pull"), 3.5, "tide"),
                      (("L5", "water starts to climb"), 6.0, "approach", 192200), (("L6", "the tidal pull"), 11.0, "climb"), (("L7", "Not a measured height"), 5.0, "tide"), (("L7", "lifted from above"), 6.0, "pull"),
                      (("L8", "about to change"), 7.5, "approach", 150000), (("L9", "Six and a half times"), 7.0, "bright"), (("L9", "sharp on the sand"), 6.0, "bright"), (("L10", "And it's faster"), 4.0, "pull"), (("L10", "not twenty-seven"), 8.0, "slide"), (("L11", "bigger than the Sun now"), 5.5, "grow"),
                      (("L11", "they line up"), 7.0, "approach", 100000), (("L12", "Nearly four times wider"), 5.0, "grow"), (("L12", "far more often"), 7.0, "eclipse"), (("L12", "because the orbit is tilted"), 5.0, "pull"), (("L12", "But often"), 7.0, "eclipse"), (("L13", "Faster"), 4.0, "grow"),
                      (("L13", "ground feels it too"), 7.5, "approach", 70000), (("L14", "Forty-three thousand"), 5.0, "grow"), (("L14", "today's tidal pull"), 7.0, "tide"), (("L14", "about a foot a day"), 8.5, "flex"), (("L14", "flex far more"), 8.0, "flex"),
                      (("L15", "wrong side of the sky"), 7.0, "approach", 50000), (("L16", "Nearly eight times wider"), 4.0, "grow"), (("L16", "how fast the Earth turns"), 4.0, "pull"), (("L17", "It hangs still"), 5.5, "grow"), (("L18", "slides the wrong way"), 9.0, "slide"), (("L18", "rises in the west"), 7.0, "rise"),
                      (("L18", "rises in the west"), 5.5, "approach", 30000), (("L19", "Twelve."), 5.0, "grow"), (("L20", "six thousand"), 5.0, "strain"), (("L21", "straining"), 7.0, "strain"),
                      (("L23", "A stretch"), 10.0, "stretch"), (("L24", "flatten into a ring"), 9.0, "band"), (("L25", "No Moon"), 8.0, "ring"), (("L26", "Tonight's Moon is fine"), 6.0, "pull")],
            "keys": [("Twenty-six thousand", 42000, 1.5), ("Sixteen", 25000, 1.0), ("Twelve.", 20000, 1.0), ("Around eleven thousand", 18000, 1.5), ("Tonight's Moon is fine", 384400, 3.0)], "chips": []},
        8: {"hook": "L23", "body": ["L24", "L25", "L26"], "closer": "C8", "start": 17000, "km": [], "keys": [("Tonight's Moon is fine", 384400, 3.0)],
            "beats": [("__hook__", 10.0, "stretch"), ("flatten into a ring", 9.0, "band"), ("No Moon", 8.0, "ring"), ("Tonight's Moon is fine", 6.0, "pull")], "chips": []}}[N]
body = PART["body"]; cliff = body[-1]
def build(use_closer):
    # sequence of (id, from, dur): hook, body lines (the CTA goes before the cliffhanger line), the closer
    if PART.get("seq"): seq = [(i, 0.0, lines[i]["dur"]) for i in PART["seq"]]
    else: seq = [(PART["hook"], 0.0, lines[PART["hook"]]["dur"])] + [(i, 0.0, lines[i]["dur"]) for i in body[:-1]] + ([(CTA, 0.0, lines[CTA]["dur"])] if CTA else []) + [(cliff, 0.0, lines[cliff]["dur"])]
    if PART.get("seq"): seq = [(i, 0.0, lines[i]["dur"]) for i in PART["seq"]]
    if use_closer: seq.append((PART["closer"], 0.0, lines[PART["closer"]]["dur"]))
    clips, caps, t = [], [], 0.15
    for lid, frm, d in seq:
        clips.append({"id": lid, "file": lines[lid]["file"], "t": round(t, 3), "dur": d, "from": frm})
        for s in lines[lid]["sentences"]: caps.append({"t0": round(t + s["t0"], 3), "t1": round(t + s["t1"] + 0.25, 3), "text": s["text"], "line": lid})
        t += d + (0.3 if lid in (CTA, "D4") or lid == seq[-1][0] else G)
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
    for bt in PART["beats"]:
        after, d, kind = bt[:3]; arr = bt[3] if len(bt) > 3 else (PART["km"][0] if (kind == "approach" and PART["km"]) else None)
        if after == "__hook__": T = silent_after([c for c in caps if c["line"] == PART["hook"]][-1])
        elif isinstance(after, tuple): T = silent_after(next(c for c in caps if c["line"] == after[0] and after[1] in c["text"]))
        else: T = silent_after(next(c for c in caps if after in c["text"]))
        items.append((T, d, kind, arr))
    items.sort(key=lambda x: x[0])
    st0 = PART.get("start", 384400); kk = [[0.0, st0]]
    if PART["km"]:
        kk += [[0.0, st0]]
        for i_ in items:
            if i_[2] == "approach" and i_[3]: kk.append([i_[0], i_[3]])
    tracks = {"eclipse": [[0, 0]], "moon": [[0, 1]], "brk": [[0, 0]], "ring": [[0, 0]], "tonight": [[0, 0]]}
    dur0 = t + 0.6
    nclips, ncaps, nkm, ntr, beats, (dur, cta_n) = insert_beats(clips, caps, kk, tracks, items, [dur0, cta_t])
    def capt(sub):      # the final time of the caption whose sentence contains `sub` (after the beats)
        return next(c for c in ncaps if sub in c["text"])
    for sub, kmv, gl in PART.get("keys", []):                      # the counter arrives at a number as it is said: a glide of gl seconds ending just before the caption ends
        c = capt(sub); ta = round(c["t1"] - 0.25, 3); nkm.sort(key=lambda k: k[0]); last = [k[1] for k in nkm if k[0] <= ta - gl - 0.001][-1]; nkm.append([round(ta - gl - 0.001, 3), last]); nkm.append([ta, kmv, gl])
    nkm.sort(key=lambda k: k[0])
    for b in beats:                                                 # eclipse beats: the sky dims, the stars come out, the disc slides over the Sun
        if b["kind"] == "eclipse": ntr["eclipse"] += [[round(b["t0"] - 0.2, 3), 0], [round(b["t0"] + 1.6, 3), 1], [round(b["t1"], 3), 1], [round(b["t1"] + 1.6, 3), 0]]
    if N in (0, 8):                                                 # the break-up: the Moon stretches, the rock spreads into a ring, then tonight's Moon is back
        t_b = capt("It comes apart")["t0"]; t_r = capt("The rock spreads")["t0"]; t_n = capt("Tonight's Moon is fine")["t0"]
        ntr["moon"] += [[round(t_b - 0.1, 3), 1], [round(t_b + 1.3, 3), 0]]; ntr["brk"] += [[round(t_b - 0.1, 3), 0], [round(t_b + 1.3, 3), 1], [round(t_r - 0.1, 3), 1], [round(t_r + 2.6, 3), 0]]
        ntr["ring"] += [[round(t_r - 0.1, 3), 0], [round(t_r + 2.6, 3), 1], [round(t_n - 0.2, 3), 1], [round(t_n + 2.0, 3), 0]]; ntr["tonight"] += [[round(t_n - 0.2, 3), 0], [round(t_n + 2.0, 3), 1]]
    if PART.get("glide"):                                           # the counter falls continuously from where the last part ended to the part's distance, arriving at glide_frac of the runtime, then holds
        Tg = round(PART["glide_frac"] * dur, 3); nkm[:] = [[0.0, PART["start"]], [Tg, PART["glide"], Tg]]
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
    def retime(cs):
        """a sentence shown in two pieces (split_caps divides the time by length): start each later piece on its first word, from the aligner's word times"""
        out = []; i = 0
        while i < len(cs):
            j = i
            while j + 1 < len(cs) and cs[j + 1]["spoken"] == cs[i]["spoken"] and cs[j + 1]["line"] == cs[i]["line"]: j += 1
            grp = cs[i:j + 1]
            if len(grp) > 1:
                L = lines[grp[0]["line"]]; sents = L["sentences"]; k = next((q for q, sn in enumerate(sents) if sn["text"] == grp[0]["spoken"]), None)
                if k is not None:
                    w0 = sum(len(x["text"].split()) for x in sents[:k]); cnt = 0; t_starts = [grp[0]["t0"]]
                    for g_ in grp[:-1]:
                        cnt += len(g_["text"].replace("×", " times").split()) if False else 0
                    # word counts of the pieces come from the spoken words, so split the spoken sentence in the same proportions as the displayed pieces' word counts
                    nw = [len(g_["text"].split()) for g_ in grp]; tot = sum(nw); wsent = len(sents[k]["text"].split()); acc = 0
                    for q in range(len(grp) - 1):
                        acc += nw[q]; wi = w0 + min(wsent - 1, max(1, round(acc * wsent / tot)))
                        fw = re.sub(r"[^a-z]", "", grp[q + 1]["text"].split()[0].lower())        # the next piece's first word, found among the sentence's own words (numbers shrink when shown: '239,000' for four words)
                        hit = next((j for j in range(w0 + 1, w0 + wsent) if j < len(L["words"]) and re.sub(r"[^a-z]", "", L["words"][j]["w"].lower()) == fw and j > w0 + q), None)
                        if hit is not None: wi = hit
                        w = L["words"][wi] if wi < len(L["words"]) else None
                        c_ = next((c for c in nclips if c["id"] == L["id"] and c["from"] - 0.01 <= w["start"] <= c["from"] + c["dur"]), None) if w else None
                        t_starts.append(round(c_["t"] + w["start"] - c_["from"] - 0.05, 3) if c_ else grp[q + 1]["t0"])
                    for q, g_ in enumerate(grp):
                        g_ = dict(g_); g_["t0"] = max(t_starts[q], grp[0]["t0"]) if q else grp[0]["t0"]; g_["t1"] = round(t_starts[q + 1] - 0.02, 3) if q + 1 < len(grp) else grp[-1]["t1"]
                        if g_["t1"] > g_["t0"]: grp[q] = g_
            out += grp; i = j + 1
        return out
    tl = {"name": NAME, "mode": "land" if N == 0 else "port", "dur": round(dur, 3), "clips": nclips, "captions": retime(split_caps(ncaps, 100 if N == 0 else 68)), "km": nkm, "tracks": ntr, "beats": beats, "chips": chips,
          "nozoom": N == 3, "sizeChip": N == 3, "badge": {"t": 5.0, "fade": 0.3}, "units": "mi", "shadow": N in (0, 1, 2, 3, 6), "tides": N in (0, 2, 3, 4, 5), "breathe": (N >= 3 and N != 3) or N == 0, "cta_at": cta_n, "cta_frac": round(cta_n / dur, 3), "cliff": cliff}
    if N == 1 or PART.get("motion1"):   # the owner's motion note (12 Nov): nothing holds still. L1: a slow push toward the Moon; L2: an orbit arc widens and the Moon eases smaller along it (drifting off); 'Tonight, it reverses': the arc snaps back, the camera pulls back and the counter starts to fall, all the way to 288,300
        cp = {c["text"]: c for c in tl["captions"]}; l1 = cp["Tonight, the Moon starts coming closer."]["t0"]; l2 = next(c for c in tl["captions"] if c["text"].startswith("Right now"))["t0"]; rv = cp["Tonight, it reverses."]["t0"]
        tl["drift"] = {"a": round(l2 - 0.2, 3), "b": round(rv, 3), "c": round(rv + 1.4, 3)}
        tl["camera"] = [{"t": round(l1 + 0.3, 3), "s": 1.18, "pv": "moon"}, {"t": round(rv, 3), "s": 1.0, "pv": "moon"}, {"t": round(rv + 2.0, 3), "s": 1.12, "pv": "moon"}]
        for k in tl["km"]:
            if k[1] == 288300: k[:] = [k[0], 288300, round(k[0] - rv, 3)]     # one long glide that begins on the reverse line
        tl["stars"] = [{"t0": 0.35, "dur": 0.9, "x0": 0.06, "y0": 0.31, "x1": 0.58, "y1": 0.385}, {"t0": round(l2 + 4.5, 3), "dur": 0.9, "x0": 0.04, "y0": 0.30, "x1": 0.46, "y1": 0.37}]
    if N == 1 and False: tl["stars"] = [{"t0": 0.35, "dur": 0.9, "x0": 0.06, "y0": 0.31, "x1": 0.58, "y1": 0.385}]
    return tl
use_closer = bool(PART.get("closer")) and N % 2 == 0 and PART["closer"] in lines      # owner, 16 Nov 2026: the spoken closer only in even parts
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
if N == 3: Tg_ = tl["km"][-1][0]; cue(0.3, "mass", dur=Tg_, gain=-4, f0=41); cue(0.6, "tick", gain=-5, repeat=int(Tg_ / 0.6), every=0.6)      # the counter ticking down as the Moon nears
if N == 1: cue(0.35, "shooting_star", dur=1.2, pan=[0.0, 0.8], gain=-2)
for b in tl["beats"]:
    t0, t1, k = b["t0"], b["t1"], b["kind"]; d = r(t1 - t0)
    if k == "approach": cue(t0 - 0.2, "mass", dur=r(d + 1.8), gain=-2, f0=41); cue(t0, "whoosh", dur=d, pan=[-0.4, 0.4], gain=-2); cue(t1, "boom", dur=2.5, gain=-4); cue(t1, "tick", gain=-2)
    elif k in ("grow", "pull"): cue(t0, "whoosh", dur=d, pan=[0.3, -0.3], gain=-3); cue(t0 + 0.2, "mass", dur=r(d + 0.8), gain=-4, f0=44)
    elif k in ("tide", "climb"): cue(t0, "surge", dur=r(d + 0.5), gain=1); cue(t0 + d * 0.45, "wave", dur=2.6, gain=-1)
    elif k == "bright": cue(t0, "shimmer", dur=r(d + 0.5), gain=-2); cue(t0, "tick", gain=-3)
    elif k == "eclipse": cue(t0, "hush", dur=r(d + 1.0), gain=0); cue(t0 + 0.3, "mass", dur=r(d + 0.5), gain=-5, f0=38)
    elif k == "flex": cue(t0 + 0.4, "crack", dur=1.4, pan=0.2, gain=-1); cue(t0, "mass", dur=r(d + 0.6), gain=-1, f0=36)
    elif k in ("rise", "slide"): cue(t0, "whoosh", dur=d, pan=[0.5, -0.5], gain=-1); cue(t0 + 0.3, "mass", dur=r(d), gain=-3, f0=40)
    elif k == "strain": cue(t0 + 0.2, "creak", dur=2.2, pan=-0.3, gain=0); cue(t0 + 1.3, "crack", dur=1.5, pan=0.2, gain=-1); cue(t0, "mass", dur=r(d + 1), gain=0, f0=38)
    elif k in ("stretch", "band", "ring"): cue(t0, "whoosh", dur=d, pan=[-0.3, 0.3], gain=-2); cue(t0 + 0.2, "mass", dur=r(d + 0.8), gain=-3, f0=36)
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
if N in (0, 8): cues.append({"at": f"cap:L23-0.2", "kind": "debris", "dur": 3.0, "gain": -3, "seed": 899})
if "--yt" not in sys.argv:
    json.dump({"palette": "space", "cues": cues}, open(f"{L1}/v4/part{N}{'-preview' if PRE else ''}.sfx.json", "w"), indent=1); print("sfx cues", len(cues))
