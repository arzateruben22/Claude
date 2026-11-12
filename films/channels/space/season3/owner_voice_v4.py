"""owner_voice_v4.py: the owner's own recording (one 282 s take, many re-reads) -> one wav per v4 script line + words/sentences like make_voice_v4.py.
For each line the take that reads the script exactly and is steadiest was chosen from the candidates (owner_takes.py); line 12 is spliced at a phrase boundary and 'far' is cut
from line 21. Each cut starts and ends in the quietest frame beside its words; breaths between words are lowered by kits/cinema/voice/debreath.py (defaults, no split_long).
Writes long01/voice5/{wav/<id>.wav, lines.json} and voice-owner-spoken/takes-used.json. usage: ~/.cache/cinema-voice/venv/bin/python -I owner_voice_v4.py"""
import json, os, re, sys, wave
from pathlib import Path
import numpy as np, soundfile as sf
ROOT = Path("/home/user/claude"); L1 = ROOT / "films/channels/space/long01"; V5 = L1 / "voice5"
sys.path.insert(0, str(ROOT / "kits/cinema/voice")); import align, debreath; from scriptfile import spoken, SENTENCE_END
SRC = "/tmp/ovoice/oo-s3-owner-clean.flac"; a, sr = sf.read(SRC, dtype="float32"); a = a if a.ndim == 1 else a.mean(1)
cand = json.load(open("/tmp/ovoice/candidates.json")); asr = json.load(open("/tmp/ovoice/asr_words.json"))
text = {}
for l in open(L1 / "v4/lines.txt"):
    if "|" in l and not l.startswith("#"): i, t = l.rstrip("\n").split("|", 1); text[i] = t
B = {"B1": "Watch the Moon. It's coming closer.", "B2": "A quarter closer. What changes first?", "B3": "Half the distance. Now the ocean climbs.", "B4": "The night is getting too bright.", "B5": "What happens when the Moon outgrows the Sun?", "B6": "It's not just the sea. The ground moves too.", "B7": "Watch it rise in the wrong place.", "B8": "There's a distance no moon survives."}
D = {"D1": "If that made the sky feel bigger, tap like and follow.", "D2": "If that made the sky feel bigger, tap like and subscribe.", "D3": "Still looking up? Tap like and follow.", "D4": "Still looking up? Tap like and subscribe."}
text.update(B); text.update(D)
# the chosen take (candidate start) per line, with the reason; segments override the candidate window where a line is spliced
CH = {"L1": (1.76, "two clean reads; the first is steadier (level spread 5.2 vs 6.2 dB)"), "L2": (16.32, "one read"), "L3": (30.68, "one read"), "L4": (36.68, "one read"), "L5": (48.64, "one read"), "L6": (53.84, "one read"),
      "L7": (61.56, "one read"), "L8": (68.52, "one read"), "L9": (72.36, "one read"), "L10": (81.52, "one read"), "L11": (89.28, "one read"), "L13": (124.48, "one read"), "L14": (129.84, "one read"),
      "L15": (142.76, "one read"), "L16": (148.04, "two reads; the first matches every word (1.0 vs 0.95)"), "L17": (165.2, "one read"), "L18": (169.52, "one read"), "L19": (174.84, "one read"),
      "L20": (182.04, "one read"), "L21": (196.0, "one read; 'far' cut"), "L22": (203.44, "one read"), "L23": (206.0, "two reads; the first is steadier (6.1 vs 7.9 dB) and has no 'explosion, explosion' restart"),
      "L24": (214.36, "one read"), "L25": (219.96, "one read"), "L26": (224.84, "two reads; the first says 'the real Moon' as scripted and is steadier"), "B1": (240.48, "one read"), "B2": (243.04, "one read"),
      "B3": (245.92, "one read"), "B4": (249.0, "one read"), "B5": (251.56, "one read"), "B6": (254.2, "one read"), "B7": (257.4, "one read"), "B8": (259.72, "two clean reads; the first is steadier (4.5 vs 6.2 dB)"),
      "D1": (268.36, "one read"), "D2": (272.0, "one read"), "D3": (275.28, "one read"), "D4": (278.24, "one read")}
SPLICE = {"L12": [(94.5, 102.35), (119.0, 123.3)]}     # first half from the clean first read; the tail exists only in the later read (the 2nd read of the first half has 'and eclipses and eclipses ... come come far far')
CUTWORD = {"L21": ("far", 197.2, 197.4)}
Hz = sr; ENV = 0.005
def env(x): h = int(ENV * Hz); n = len(x) // h; return 20 * np.log10(np.sqrt((x[: n * h].reshape(n, h) ** 2).mean(1)) + 1e-9)
E = env(a)
def quiet(t, lo, hi):
    """the quietest 20 ms inside [lo, hi] (the nearest to t on ties)"""
    if hi - lo < 0.03: return (lo + hi) / 2
    i0, i1 = int(lo / ENV), int(hi / ENV); w = np.convolve(E[i0:i1], np.ones(4) / 4, "same"); j = int(np.argmin(w + 0.001 * np.abs(np.arange(len(w)) * ENV + lo - t))); return (i0 + j) * ENV
def edges(t0, t1):
    prev = max([e for w, s, e in asr if e <= t0 + 0.05] or [t0 - 0.4]); nxt = min([s for w, s, e in asr if s >= t1 - 0.05] or [t1 + 0.4])
    s = quiet(t0 - 0.1, max(prev + 0.02, t0 - 0.3), t0 - 0.02); e = quiet(t1 + 0.12, t1 + 0.02, min(nxt - 0.02, t1 + 0.35)); return s, e
def fade(x, n=int(0.008 * sr)): x = x.copy(); x[:n] *= np.linspace(0, 1, n); x[-n:] *= np.linspace(1, 0, n); return x
rec = align.recognizer(str(Path.home() / ".cache/cinema-voice/models")); out = []; used = {}
for lid, t in text.items():
    if lid in SPLICE:
        segs = [edges(*s) for s in SPLICE[lid]]; parts = [fade(a[int(s * sr): int(e * sr)]) for s, e in segs]; gap = np.zeros(int(0.32 * sr), np.float32)
        x = np.concatenate([parts[0], gap, parts[1]]); why = "spliced at the phrase boundary 'often.' | 'Not every month': first half from the first read, tail from the later read"; used[lid] = {"segments": [[round(s, 2), round(e, 2)] for s, e in segs], "why": why}
    else:
        t0c = CH[lid][0]; c = [y for y in cand[lid] if abs(y["t0"] - t0c) < 0.01][0]; s, e = edges(c["t0"], c["t1"]); x = a[int(s * sr): int(e * sr)].copy()
        if lid in CUTWORD:                                      # find 'far' with the aligner (script text with 'far' put back), then cut exactly that word and crossfade 12 ms across the join
            wd = CUTWORD[lid][0]; t_with = t.replace("more than", wd + " more than", 1); ww, _ = align.line_words(rec, x, sr, t_with); fw = next(w for w in ww if w["w"].lower().strip(",.") == wd); nx = ww[ww.index(fw) + 1]
            import difflib; best = None
            for off in (-0.012, 0.0, 0.02, 0.04, 0.06, 0.08, 0.10):                      # the aligner's word start can run early: try a few cut points and keep the one the recognizer reads as the script
                k0 = int(max(0.02, fw["start"] + off) * sr); k1 = min(int(max(fw["end"], nx["start"] - 0.012) * sr), int(nx["start"] * sr) - 1); n = int(0.012 * sr)
                xf = np.linspace(0, 1, n); mid = x[k0 - n: k0] * (1 - xf) + x[k1: k1 + n] * xf; xc = np.concatenate([x[: k0 - n], mid, x[k1 + n:]])
                w2, h2 = align.line_words(rec, xc, sr, t); r = difflib.SequenceMatcher(None, [re.sub(r"[^a-z0-9]", "", q.lower()) for q in t.replace("-", " ").split()], [re.sub(r"[^a-z0-9]", "", q.lower()) for q in h2.split()]).ratio()
                if best is None or r > best[0]: best = (r, xc, off)
            x = best[1]; CUTWORD[lid] = (wd, round(s + fw["start"] + best[2], 2), round(s + fw["end"], 2))
        used[lid] = {"segments": [[round(s, 2), round(e, 2)]], "why": CH[lid][1] + (f"; cut '{CUTWORD[lid][0]}' ({CUTWORD[lid][1]}-{CUTWORD[lid][2]} s) with a 12 ms crossfade" if lid in CUTWORD else "")}
        x = fade(x)
    out.append((lid, t, x))
# level: the speech level of every line matched to the median (within +-1 dB), peak guarded
def level(x): e = env(x); sp = e[e > e.max() - 25]; return float(np.mean(sp)) if len(sp) else float(e.max())
med = float(np.median([level(x) for _, _, x in out])); res = []
(V5 / "wav").mkdir(parents=True, exist_ok=True)
for lid, t, x in out:
    g = np.clip(med - level(x), -3, 3); x = x * 10 ** (g / 20); pk = np.abs(x).max(); x = x * (0.89 / pk) if pk > 0.89 else x
    words, heard = align.line_words(rec, x, sr, t)
    x, found = debreath.debreath(x, sr, [{"w": w["w"], "start": w["start"], "end": w["end"]} for w in words])   # kits/cinema/voice/debreath.py (made-with-claude-film 6b84f6ef), defaults only, no split_long
    used.setdefault(lid, {})["breaths_lowered"] = [list(b_) for b_ in found]
    f = V5 / "wav" / f"{lid}.wav"; sf.write(f, x, sr, subtype="PCM_24"); dur = len(x) / sr
    sents, pos = [], 0
    for m in re.finditer(r".+?" + SENTENCE_END.pattern, t.strip()):
        sp = spoken(m.group(0)); k = len(sp.split()); seg = words[pos:pos + k]; pos += k
        if seg: sents.append({"text": sp, "t0": round(seg[0]["start"], 3), "t1": round(seg[-1]["end"], 3), "claims": []})
    miss = [w["w"] for w in words if not w["heard"]]; used[lid]["heard"] = heard; used[lid]["not_heard"] = miss
    res.append({"id": lid, "text": spoken(t), "file": f"voice5/wav/{lid}.wav", "dur": round(dur, 3), "sentences": sents, "words": [{"w": w["w"], "start": w["start"], "end": w["end"]} for w in words]})
    print(lid, round(dur, 2), "not heard:", miss)
json.dump({"voice": "owner (recorded 12 Nov 2026)", "speed": 1.0, "lines": res}, open(V5 / "lines.json", "w"), indent=1, ensure_ascii=False)
Path(ROOT / "films/channels/space/voice-owner-spoken").mkdir(exist_ok=True); json.dump(used, open(ROOT / "films/channels/space/voice-owner-spoken/takes-used.json", "w"), indent=1, ensure_ascii=False); print("done", len(res))
