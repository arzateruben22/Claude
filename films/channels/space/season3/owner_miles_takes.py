"""owner_miles_takes.py: his own takes of the miles lines (voice-owner-spoken/oo-s3-miles.m4a, takes in oo-s3-miles.takes.json) replace the stand-in (AI) wavs for the lines recorded so far:
miles-sheet line 1 -> L2 (last take only, 10.6-23.0 s), line 2 -> L4 (25.15-32.2 s). Cut like recut_v4.py (voice_edges: start/end settle on the level), 8 ms fades, level matched to his other lines (+-3 dB, peak guard),
debreath at its defaults. Word and sentence times come from the recogniser's own timings (Parakeet), merged to the script's words (his pauses stay: 'away', 'a year', 'Tonight', 'it reverses').
Updates long01/voice6/lines.json (stand_in false for these) and voice-owner-spoken/takes-used.json. usage: ~/.cache/cinema-voice/venv/bin/python -I owner_miles_takes.py"""
import json, os, re, subprocess, sys
from pathlib import Path
import numpy as np, soundfile as sf
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", "..")); S = f"{ROOT}/films/channels/space"; L1 = f"{S}/long01"
sys.path.insert(0, HERE); sys.path.insert(0, f"{ROOT}/kits/cinema/voice"); import voice_edges as VE, debreath, align; from scriptfile import spoken, SENTENCE_END
SRC = f"{S}/voice-owner-spoken/oo-s3-miles.m4a"; TK = json.load(open(f"{S}/voice-owner-spoken/oo-s3-miles.takes.json")); TARGET = {"1": "L2", "2": "L4"}
subprocess.run(["ffmpeg", "-v", "quiet", "-y", "-i", SRC, "-ac", "1", "-ar", "48000", "/tmp/oo-s3-miles.wav"])      # the last ALAC frame is empty: a decoder warning, nothing lost
a, sr = sf.read("/tmp/oo-s3-miles.wav", dtype="float32"); a = a if a.ndim == 1 else a.mean(1)
E = VE.envelope(a, sr); floor = float(np.percentile(E, 8)); rec = align.recognizer(str(Path.home() / ".cache/cinema-voice/models"))
J6 = json.load(open(f"{L1}/voice6/lines.json")); by6 = {l["id"]: l for l in J6["lines"]}; used = json.load(open(f"{S}/voice-owner-spoken/takes-used.json"))
ref = [l for l in json.load(open(f"{L1}/voice5/lines.json"))["lines"] if l["id"][0] in "LBD"]
def env(x, h=240): n = len(x) // h; return 20 * np.log10(np.sqrt((x[: n * h].reshape(n, h) ** 2).mean(1)) + 1e-9)
def level(x): e = env(x); sp = e[e > e.max() - 25]; return float(np.mean(sp))
med = float(np.median([level(sf.read(f"{L1}/{l['file']}", dtype="float32")[0]) for l in ref]))
def merge(script_words, toks):
    """the recogniser's tokens -> the script's words (thirty|nine -> thirty-nine, To|night -> Tonight); a mismatch ('fills' for 'feels') takes one token per word"""
    out, i = [], 0; n = lambda s: re.sub(r"[^a-z]", "", s.lower())
    for k, w in enumerate(script_words):
        need = len(n(w)); grp = [toks[i]]; i += 1
        while i < len(toks) - (len(script_words) - k - 1) and len(n("".join(g[0] for g in grp))) < need - 1: grp.append(toks[i]); i += 1
        out.append((w, grp[0][1], grp[-1][2]))
    return out
for k, lid in TARGET.items():
    t = TK["lines"][k]; text = t["words"]; t0, t1 = t["start"], t["end"]
    seg = a[int((t0 - 0.3) * sr): int((t1 + 0.5) * sr)]; toks = [(w, s + t0 - 0.3, e + t0 - 0.3) for w, s, e in align.asr(rec, seg, sr)]
    toks = [x for x in toks if t0 - 0.05 <= x[1] <= t1 + 0.2]
    s_ = VE.settle_start(E, toks[0][1] - 0.02, floor, limit=None); e_ = VE.settle_end(E, toks[-1][2], floor, limit=None, cap=0.6)
    x = a[int(s_ * sr): int(e_ * sr)].copy(); n8 = int(0.008 * sr); x[:n8] *= np.linspace(0, 1, n8); x[-n8:] *= np.linspace(1, 0, n8)
    sw = text.split(); mw = merge(sw, toks); words = [{"w": w, "start": round(s - s_, 3), "end": round(e - s_, 3)} for w, s, e in mw]
    x, found = debreath.debreath(x, sr, words); g = float(np.clip(med - level(x), -3, 3)); x = x * 10 ** (g / 20); pk = np.abs(x).max(); x = x * (0.89 / pk) if pk > 0.89 else x
    sf.write(f"{L1}/voice6/wav/{lid}.wav", x, sr, subtype="PCM_24")
    sents, pos = [], 0
    for m in re.finditer(r".+?" + SENTENCE_END.pattern, text.strip()):
        sp_ = spoken(m.group(0)); kk = len(sp_.split()); seg_w = words[pos:pos + kk]; pos += kk
        if seg_w: sents.append({"text": sp_, "t0": seg_w[0]["start"], "t1": seg_w[-1]["end"], "claims": []})
    Ex = VE.envelope(x, sr); fl = float(np.percentile(Ex, 8)) + 12; step = VE.STEP     # a token's end can span his pause ('year.' runs into 'Tonight'): trim each sentence to where the voice really is
    def snap(t, forward):
        i = int(t / step); j = i
        while 0 <= j < len(Ex) and Ex[j] < fl: j += 1 if forward else -1
        return round(min(max(j, 0), len(Ex) - 1) * step, 3)
    for sn in sents: sn["t0"] = snap(sn["t0"], True); sn["t1"] = snap(sn["t1"], False)
    by6[lid] = {"id": lid, "text": spoken(text), "file": f"voice6/wav/{lid}.wav", "dur": round(len(x) / sr, 3), "sentences": sents, "words": words, "stand_in": False, "owner_take": f"oo-s3-miles.m4a {t0}-{t1} s"}
    used[lid + "-miles"] = {"segments": [[round(s_, 3), round(e_, 3)]], "source": "oo-s3-miles.m4a (his miles take, 16 Nov 2026)", "why": f"line {k} of the miles sheet; the last take; cut with voice_edges, level matched ({g:+.1f} dB), debreath defaults", "breaths_lowered": [list(b) for b in found]}
    print(lid, round(len(x) / sr, 2), "s; sentences:", [(s["text"][:22], s["t0"], s["t1"]) for s in sents], "gain", round(g, 1))
J6["lines"] = [by6[l["id"]] for l in J6["lines"]]; json.dump(J6, open(f"{L1}/voice6/lines.json", "w"), indent=1, ensure_ascii=False); json.dump(used, open(f"{S}/voice-owner-spoken/takes-used.json", "w"), indent=1, ensure_ascii=False)
