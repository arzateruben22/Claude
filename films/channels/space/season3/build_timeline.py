"""build_timeline.py: from long01/voice/lines.json + stages.json, the timelines the engine renders: out/long.json and out/part1..8.json.
Each timeline: dur, mode (land|port), clips [{id, file, t, dur}], captions [{t0,t1,text}], km [[t,km]...], tracks {eclipse, moon, brk, ring, tonight}.
A voice swap only replaces lines.json (same ids, new durations/words): this script re-times everything from it."""
import json, os, re, sys
YT = os.environ.get("VARIANT") == "yt"; YTV = "subscribe" if YT else "follow"; SUF = "-yt" if YT else ""   # VARIANT=yt: the parts with the 'subscribe' CTA line (for the YouTube files) -> out/part<n>-yt.json
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", ".."))
L1 = f"{ROOT}/films/channels/space/long01"; OUT = L1 + "/out"; os.makedirs(OUT, exist_ok=True)
lines = {x["id"]: x for x in json.load(open(L1 + "/voice/lines.json"))["lines"]}; ST = json.load(open(L1 + "/stages.json")); G = 0.35
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
tl["long"] = {"name": "long", "mode": "land", "dur": dur, "clips": clips, "captions": split_caps(caps, 100), "km": km, "tracks": tracks}
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
    tl[f"part{i}{SUF}"] = {"name": f"part{i}{SUF}", "mode": "port", "dur": dur_p, "clips": clips, "captions": split_caps(caps, 68), "km": kk, "tracks": tracks, "cta_at": round(cc["t"], 3), "cta_frac": round(cc["t"] / dur_p, 3)}
for k, v in tl.items():
    if YT and not k.endswith("-yt"): continue
    json.dump(v, open(f"{OUT}/{k}.json", "w"), indent=1, ensure_ascii=False)
print({k: round(v["dur"], 1) for k, v in tl.items()}); print("CTA at", {k: v.get("cta_frac") for k, v in tl.items() if k != "long"})
