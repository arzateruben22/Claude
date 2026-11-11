"""build_timeline.py: from long01/voice/lines.json + stages.json, the timelines the engine renders: out/long.json and out/part1..8.json.
Each timeline: dur, mode (land|port), clips [{id, file, t, dur}], captions [{t0,t1,text}], km [[t,km]...], tracks {eclipse, moon, brk, ring, tonight}.
A voice swap only replaces lines.json (same ids, new durations/words): this script re-times everything from it."""
import json, os, re, sys
YT = os.environ.get("VARIANT") == "yt"; YTV = "subscribe" if YT else "follow"; SUF = "-yt" if YT else ""   # VARIANT=yt: the parts with the 'subscribe' CTA line (for the YouTube files) -> out/part<n>-yt.json
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", ".."))
L1 = f"{ROOT}/films/channels/space/long01"; OUT = L1 + "/out"; os.makedirs(OUT, exist_ok=True)
sys.path.insert(0, f"{ROOT}/kits/cinema/film"); from numerals import to_display   # captions show numerals and unit symbols; the voice still says them in words
lines = {x["id"]: x for x in json.load(open(L1 + "/voice/lines.json"))["lines"]}; ST = json.load(open(L1 + "/stages.json")); G = 0.35; BEATS = json.load(open(L1 + "/beats.json"))
def resolve_beats(chapters, caps, is_long):
    """beats.json -> [(T, dur, kind, arrives)] in the timeline's current (pre-insertion) time: T = the boundary after the sentence that starts with `after`"""
    items = []
    for ch in chapters:
        for b in BEATS.get(f"ch{ch}" if ch != "close" else "close", []):
            if b.get("long_only") and not is_long: continue
            if not is_long and ch == "close": continue
            line = f"ch{ch}_vo" if ch != "close" else "close_vo"; own = [c for c in caps if c["line"] == line]
            if not own: continue
            if b["after"] == "__start__": T = own[0]["t0"] - 0.05
            else:
                i = next((j for j, c in enumerate(own) if c["text"].startswith(b["after"]) or b["after"] in c["text"]), None)
                if i is None: print("WARN no sentence for beat", ch, b["after"]); continue
                nxt = next((c for c in caps if c["t0"] > own[i]["t0"]), None); T = (own[i]["t1"] + (nxt["t0"] if nxt else own[i]["t1"] + 0.3)) / 2 if nxt else own[i]["t1"] + 0.1
                T = min(T, (nxt["t0"] - 0.02) if nxt else T)
            items.append((round(T, 3), b["ldur"] if is_long and "ldur" in b else b["dur"], b["kind"], b.get("arrives")))
    items.sort(key=lambda x: x[0]); return items
def warp(t, items): return t + sum(d for (T, d, *_ ) in items if t >= T)
def insert_beats(clips, caps, km, tracks, items, extra_times=()):
    """open a silent gap of `dur` at each boundary T: later things shift; a voice clip that spans T is cut in two (from/dur); approach beats make the counter arrive as the beat ends"""
    nclips = []
    for c in clips:
        cuts = [T for (T, d, *_ ) in items if c["t"] + 0.02 < T < c["t"] + c["dur"] - 0.02]; a = c["t"]; frm = c.get("from", 0.0)
        for T in cuts + [None]:
            end = T if T is not None else c["t"] + c["dur"]; nclips.append({**c, "t": round(warp(a, items), 3), "dur": round(end - a, 3), "from": round(frm + (a - c["t"]), 3)}); a = end
    ncaps = []
    for c in caps:
        t1 = c["t1"]
        for (T, d, *_ ) in items:
            if c["t0"] < T <= t1: t1 = T - 0.03
        ncaps.append({**c, "t0": round(warp(c["t0"], items), 3), "t1": round(warp(t1, items), 3)})
    nkm = [[round(warp(t, items), 3), v] for t, v in km]; ntr = {k: [[round(warp(t, items), 3), v] for t, v in arr] for k, arr in tracks.items()}
    beats = []; shift = 0.0
    for (T, d, kind, arr) in items:
        t0 = T + shift; t1 = t0 + d; shift += d; beats.append({"t0": round(t0, 3), "t1": round(t1, 3), "kind": kind})
        if arr:   # the counter arrives as the beat ends, gliding through the beat
            for k in nkm:
                if k[1] == arr:
                    ta = k[0]; k[0] = round(t1, 3); k[:] = k[:2] + [round(d, 3)]
                    for o in nkm:
                        if o is not k and o[0] == ta and o[1] == arr: o[0] = round(t1, 3)   # the next stage's 'hold' key moves with the arrival
                    break
    nkm.sort(key=lambda k: k[0])
    return nclips, ncaps, nkm, ntr, beats, [round(warp(t, items), 3) for t in extra_times]
def place(seq, t0=0.4):
    """seq: ids in order -> clips with start times (gap G between lines)"""
    t, clips = t0, []
    for i in seq: l = lines[i]; clips.append({"id": i, "file": l["file"], "t": round(t, 3), "dur": l["dur"]}); t += l["dur"] + G
    return clips, t
def captions(clips):
    caps = []
    for c in clips:
        for s in lines[c["id"]]["sentences"]: caps.append({"t0": round(c["t"] + s["t0"], 3), "t1": round(c["t"] + s["t1"] + 0.25, 3), "text": s["text"], "line": c["id"]})
    for a, b in zip(caps, caps[1:]): a["t1"] = round(min(a["t1"], b["t0"] - 0.02), 3) if b["t0"] > a["t0"] else a["t1"]
    return caps
def split_caps(caps, lim):
    """two lines at most on screen: a caption longer than lim characters is shown in pieces, each for a share of the time (by length).
    The cut is the word boundary nearest the middle (a comma or a clause word is preferred), and never leaves 'a', 'the', 'and', 'of' ... at the end of a piece."""
    WEAK = {"a", "an", "the", "and", "or", "of", "to", "in", "on", "at", "is", "it", "as", "by", "for", "with", "than", "that", "but", "so", "its", "your", "from", "into"}
    def cut(txt):
        w = txt.split(" "); best, bs = 1, 1e9; tot = len(txt)
        for k in range(1, len(w)):
            left = " ".join(w[:k]); sc = abs(len(left) - tot / 2)
            if w[k - 1].lower().strip(",.;:") in WEAK and not w[k - 1].endswith(","): sc += 25
            if w[k - 1].endswith(","): sc -= 8
            if sc < bs: best, bs = k, sc
        return " ".join(w[:best]), " ".join(w[best:])
    out = []
    for c in caps:
        parts = [c["text"]]
        while max(len(x) for x in parts) > lim:
            i = max(range(len(parts)), key=lambda j: len(parts[j])); a, b = cut(parts[i]); parts[i:i + 1] = [a, b]
        if len(parts) == 1: out.append(c); continue
        tot = sum(len(x) for x in parts); t = c["t0"]; span = c["t1"] - c["t0"]
        for x in parts:
            d = span * len(x) / tot; out.append({**c, "t0": round(t, 3), "t1": round(t + d - (0.02 if x is not parts[-1] else 0), 3), "text": x}); t += d
    return out
def km_track(clips, chapter, caps):
    st = ST[chapter]; keys = [[0.0, st["start"]]]; prev_t = 0.0
    for k in st["keys"]:
        sent = next((c for c in caps if c["text"].startswith(k["match"]) or k["match"] in c["text"]), None)
        if not sent: print("WARN no sentence for", k["match"]); continue
        # arrival when the number has been said: the end of the sentence's first clause (word 'kilometers'/'thousand') else its end
        line = lines[sent["line"]]; base = next(c["t"] for c in clips if c["id"] == sent["line"]); arr = sent["t1"] - 0.25
        for w in line["words"]:
            ws = base + w["start"]
            if sent["t0"] - 0.01 <= ws <= sent["t1"] and re.match(r"(kilometers|thousand)", w["w"].strip(".,?!").lower()): arr = base + w["end"]; break
        keys.append([round(prev_t, 3), None]); keys[-1][1] = keys[-2][1]
        keys.append([round(max(arr, prev_t + 0.5), 3), k["km"]]); prev_t = keys[-1][0]
    return keys
def find(caps, text): return next((c for c in caps if text in c["text"]), None)
tl = {}
# ---- the long film
seq = ["ch1_bridge"]
for i in range(1, 9):
    seq += [f"ch{i}_vo", f"ch{i}_loop"]
    if i == 3: seq.append("cta3_subscribe")
seq += ["close_vo", "cta4_subscribe", "close_loop"]
clips, t_end = place(seq); caps = captions(clips); dur = round(t_end + 1.8, 3)
km = [[0.0, 384400]]; last_t = 0.0
for i in range(1, 9):
    ch = [c for c in clips if c["id"] in (f"ch{i}_vo", f"ch{i}_loop")]; cc = [c for c in caps if c["line"] in (f"ch{i}_vo", f"ch{i}_loop")]
    kt = km_track(ch, f"ch{i}", cc)
    for t, v in kt[1:]:
        if v is not None and (not km or v < km[-1][1] or t > km[-1][0]):
            if km[-1][1] != v: km.append([round(max(t - 0.0, km[-1][0] + 0.01), 3), v])
# the counter slides continuously from the previous value (hold, then glide): insert a 'start of glide' key = previous arrival
glide = [km[0]]
for (t, v) in km[1:]:
    glide.append([t, v])
tracks = {"eclipse": [[0, 0]], "moon": [[0, 1]], "brk": [[0, 0]], "ring": [[0, 0]], "tonight": [[0, 1], [1.5, 1], [3.2, 0]]}
e0 = find(caps, "The sky goes dim"); e1 = find(caps, "And then you look at the Moon again")
if e0 and e1: tracks["eclipse"] += [[e0["t0"] - 0.2, 0], [e0["t0"] + 1.6, 1], [e1["t0"] - 0.1, 1], [e1["t0"] + 1.6, 0]]
b0 = find(caps, "And then it comes apart"); r0 = find(caps, "Over time, material like that can flatten"); n0 = find(caps, "Tonight's Moon is fine")
t_band = find(caps, "A thin, bright band")
if b0: tracks["moon"] += [[b0["t0"] - 0.1, 1], [b0["t0"] + 1.3, 0]]; tracks["brk"] += [[b0["t0"] - 0.1, 0], [b0["t0"] + 1.3, 1]]
if r0: tracks["brk"] += [[r0["t0"] - 0.1, 1], [r0["t0"] + 2.6, 0]]; tracks["ring"] += [[r0["t0"] - 0.1, 0], [r0["t0"] + 2.6, 1]]
if n0: tracks["ring"] += [[n0["t0"] - 0.2, 1], [n0["t0"] + 2.0, 0]]; tracks["tonight"] += [[n0["t0"] - 0.2, 0], [n0["t0"] + 2.0, 1]]
if n0: km += [[round(n0["t0"] + 0.4, 3), km[-1][1]], [round(n0["t0"] + 2.2, 3), 384400]]   # the Moon is fine: the counter is back where it began (the loop)
items = resolve_beats([1, 2, 3, 4, 5, 6, 7, 8, "close"], caps, True)
clips, caps, km, tracks, beats, (dur,) = insert_beats(clips, caps, km, tracks, items, [dur])
for c in caps: c["spoken"] = c["text"]; c["text"] = to_display(c["text"])
tl["long"] = {"name": "long", "mode": "land", "dur": dur, "clips": clips, "captions": split_caps(caps, 100), "km": km, "tracks": tracks, "beats": beats}
# ---- the eight parts (9:16): hook, chapter, cliffhanger, closer, one like/follow line at 70-85% of the runtime, the ending left out
for i in range(1, 9):
    ch = f"ch{i}"; vo = lines[ch + "_vo"]; sents = vo["sentences"]; cta = f"cta{(i - 1) % 4 + 1}_{YTV}"
    head = [ch + "_hook"]; hc, t_after_hook = place(head, 0.15)
    vo_start = t_after_hook
    # total length if the CTA goes after sentence k; pick k so the CTA starts at 70-85% of the runtime (closest to 77%)
    body_dur = vo["dur"] + G + lines[ch + "_loop"]["dur"] + G + lines[f"closer{i}"]["dur"] + lines[cta]["dur"] + G
    total = vo_start + body_dur; best = None
    for k, s in enumerate(sents[:-1]):
        tins = vo_start + s["t1"] + 0.3; fr = tins / total
        if 0.70 <= fr <= 0.85 and (best is None or abs(fr - 0.77) < abs(best[1] - 0.77)): best = (k, fr, tins)
    if best is None:   # fall back: after the last full sentence before 85%
        k = max(j for j, s in enumerate(sents[:-1]) if (vo_start + s["t1"] + 0.3) / total <= 0.85) if any((vo_start + s["t1"] + 0.3) / total <= 0.85 for s in sents[:-1]) else 0; best = (k, 0, 0)
    k = best[0]; split = round((sents[k]["t1"] + sents[k + 1]["t0"]) / 2, 3)
    # the chapter's voice is one file: the CTA is inserted by cutting the audio at the sentence boundary (the clip is played twice, trimmed)
    c1 = {"id": ch + "_vo", "file": vo["file"], "t": round(vo_start, 3), "dur": round(split, 3), "from": 0.0}
    t = vo_start + split + 0.3
    cc = {"id": cta, "file": lines[cta]["file"], "t": round(t, 3), "dur": lines[cta]["dur"]}; t += lines[cta]["dur"] + 0.3
    c2 = {"id": ch + "_vo", "file": vo["file"], "t": round(t, 3), "dur": round(vo["dur"] - split, 3), "from": round(split, 3)}; t += c2["dur"] + G
    rest, t_end2 = place([ch + "_loop", f"closer{i}"], t)
    clips = hc + [c1, cc, c2] + rest
    caps = []
    for c in hc + rest: caps += [{"t0": round(c["t"] + s["t0"], 3), "t1": round(c["t"] + s["t1"] + 0.25, 3), "text": s["text"], "line": c["id"]} for s in lines[c["id"]]["sentences"]]
    for si, s in enumerate(sents): base = (c1["t"] if si <= k else c2["t"] - split); caps.append({"t0": round(base + s["t0"], 3), "t1": round(base + s["t1"] + 0.25, 3), "text": s["text"], "line": ch + "_vo"})
    caps += [{"t0": round(cc["t"] + s["t0"], 3), "t1": round(cc["t"] + s["t1"] + 0.25, 3), "text": s["text"], "line": cta} for s in lines[cta]["sentences"]]
    caps.sort(key=lambda c: c["t0"])
    if i >= 5:   # the opening (first 2.5 s): a hook text of at most 6 words in the top third, gone by 2.5 s
        HOOK = {5: "Moon bigger than the Sun?", 7: "It rises in the west", 8: "A distance no moon survives"}
        hk = [c for c in caps if c["line"] == ch + "_hook"]
        if i in HOOK and hk: hk[0]["text"] = HOOK[i]; hk[0]["t1"] = max(c["t1"] for c in hk); caps = [c for c in caps if c is hk[0] or c["line"] != ch + "_hook"]
        for c in caps:
            if c["line"] == ch + "_hook": c["t1"] = min(c["t1"], 2.5)
        caps = [c for c in caps if c["t0"] < c["t1"]]
    for a, b in zip(caps, caps[1:]): a["t1"] = round(min(a["t1"], b["t0"] - 0.02), 3) if b["t0"] > a["t0"] else a["t1"]
    dur_p = round(t_end2 + 0.6, 3)
    # distance keys for this chapter, timed from the (re-placed) captions; words come from the chapter's line placed at its real offsets
    st = ST[ch]; kk = [[0.0, st["start"]]]; prev = 0.0
    for key in st["keys"]:
        sent = next((c for c in caps if key["match"] in c["text"]), None)
        if not sent: continue
        arr = sent["t1"] - 0.25; kk.append([round(prev, 3), kk[-1][1]]); kk.append([round(max(arr, prev + 0.5), 3), key["km"]]); prev = kk[-1][0]
    tracks = {"eclipse": [[0, 0]], "moon": [[0, 1]], "brk": [[0, 0]], "ring": [[0, 0]], "tonight": [[0, 0]]}
    if i == 5:
        e0 = find(caps, "The sky goes dim"); e1 = find(caps, "And then you look at the Moon again")
        if e0 and e1: tracks["eclipse"] += [[e0["t0"] - 0.2, 0], [e0["t0"] + 1.6, 1], [e1["t0"] - 0.1, 1], [e1["t0"] + 1.6, 0]]
    items = resolve_beats([i], caps, False)
    clips, caps, kk, tracks, beats, (dur_p, cta_t) = insert_beats(clips, caps, kk, tracks, items, [dur_p, cc["t"]])
    for c in caps: c["spoken"] = c["text"]; c["text"] = to_display(c["text"])
    tl[f"part{i}{SUF}"] = {"name": f"part{i}{SUF}", "mode": "port", "dur": dur_p, "clips": clips, "captions": split_caps(caps, 68), "km": kk, "tracks": tracks, "beats": beats, "cta_at": cta_t, "cta_frac": round(cta_t / dur_p, 3)}
for k, v in tl.items():
    if YT and not k.endswith("-yt"): continue
    json.dump(v, open(f"{OUT}/{k}.json", "w"), indent=1, ensure_ascii=False)
print({k: round(v["dur"], 1) for k, v in tl.items()}); print("CTA at", {k: v.get("cta_frac") for k, v in tl.items() if k != "long"})
