"""recut_v4.py: rebuild long01/voice5/wav/*.wav from the owner's recordings without a recogniser, with ends that wait for
the voice to die away (voice_edges.py; the owner, 12 Nov 2026: "some parts of the audio sound quickly cut off").

The cuts recorded in voice-owner-spoken/takes-used.json (owner_voice_v4.py / owner_closers_v4.py) are replayed, each
end and start settled on the level (bounded by the neighbouring takes), then the same chain as before: 8 ms fades, every
line's speech level matched to the median (+-3 dB, peak guard), kits/cinema/voice/debreath.py at its defaults with the
word times already in lines.json (shifted when a start moves). The closers C1/C2 come from the Possibility Lab
recording through clarity.py exactly as owner_closers_v4.py does. Updates lines.json (dur, words, sentences) and
takes-used.json (segments, breaths, the settle shifts).

usage: <python with numpy soundfile noisereduce> -I recut_v4.py --src oo-s3-owner-clean.flac --pl "Valerio St 3.m4a"
       (both recordings are in git: claude/space-voice-owner and claude/whatif-s2, voice-owner-spoken/)
"""
import argparse, json, os, re, subprocess, sys, tempfile
import numpy as np, soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", ".."))
S = f"{ROOT}/films/channels/space"; L1 = f"{S}/long01"; V5 = f"{L1}/voice5"; TU = f"{S}/voice-owner-spoken/takes-used.json"
sys.path.insert(0, HERE); sys.path.insert(0, f"{ROOT}/kits/cinema/voice")
import voice_edges as VE, debreath                                                    # noqa: E402

ap = argparse.ArgumentParser(); ap.add_argument("--src", required=True); ap.add_argument("--pl", required=True); a_ = ap.parse_args()
J = json.load(open(f"{V5}/lines.json")); used = json.load(open(TU)); byid = {l["id"]: l for l in J["lines"]}
a, sr = sf.read(a_.src, dtype="float32"); a = a if a.ndim == 1 else a.mean(1)
E = VE.envelope(a, sr); floor = float(np.percentile(E, 8)); E50 = 10 * np.log10(np.convolve(10 ** (E / 10), np.ones(10) / 10, "same") + 1e-12)
def fade(x, n=int(0.008 * 48000)): x = x.copy(); x[:n] *= np.linspace(0, 1, n); x[-n:] *= np.linspace(1, 0, n); return x
def env(x, h=240): n = len(x) // h; return 20 * np.log10(np.sqrt((x[: n * h].reshape(n, h) ** 2).mean(1)) + 1e-9)
def level(x): e = env(x); sp = e[e > e.max() - 25]; return float(np.mean(sp)) if len(sp) else float(e.max())
segs = [(k, s, e) for k, v in used.items() if k[0] in "LBD" for s, e in v["segments"]]

out, shift = [], {}
for lid in [l["id"] for l in J["lines"] if l["id"][0] in "LBD"]:
    sg = [list(x) for x in used[lid]["segments"]]; s0, e0 = sg[0][0], sg[-1][1]
    nx = [s for k, s, e in segs if k != lid and s >= e0 - 0.01]; pv = [e for k, s, e in segs if k != lid and e <= s0 + 0.01]
    s1 = VE.settle_start(E, s0, floor, limit=max(pv) if pv else None); e1 = VE.settle_end(E, e0, floor, limit=min(nx) if nx else None)
    # a long silent tail (L3 kept 3.2 s of room tone after "down.") delays whatever follows: end 0.3 s after the last word has died away, but
    # only if nothing cut off reaches speech level (-40 dBFS; the owner's words sit at -12 to -30): room tone, breaths, a click, never a late word
    lw = s1 + byid[lid]["words"][-1]["end"] + (sg[-1][0] - sg[0][0] if len(sg) > 1 else 0) - (0.32 if len(sg) > 1 else 0)
    if len(sg) == 1 and lw < e1:
        et = min(e1, VE.settle_end(E, lw, floor, limit=e1) + 0.3); j0, j1 = int(et / VE.STEP), int(e1 / VE.STEP)
        if et < e1 - 0.05 and (j1 <= j0 or float(np.max(E50[j0:j1])) < -40): e1 = round(et, 3)     # 50 ms level: a word is sustained, a click is not
    sg[0][0], sg[-1][1] = s1, e1; shift[lid] = (round(s0 - s1, 3), round(e1 - e0, 3))
    if len(sg) > 1:                                                                    # L12: the phrase-boundary splice, 0.32 s apart
        parts = [fade(a[int(s * sr): int(e * sr)]) for s, e in sg]; x = np.concatenate([parts[0], np.zeros(int(0.32 * sr), np.float32), parts[1]])
    else:
        x = a[int(s1 * sr): int(e1 * sr)].copy()
        m = re.search(r"cut '(\w+)' \(([\d.]+)-([\d.]+) s\)", used[lid].get("why", ""))
        if m:                                                                          # L21: the word cut out, 12 ms crossfade (owner_voice_v4.py)
            k0, k1, n = int((float(m.group(2)) - s1) * sr), int((float(m.group(3)) - s1) * sr), int(0.012 * sr)
            xf = np.linspace(0, 1, n); x = np.concatenate([x[: k0 - n], x[k0 - n: k0] * (1 - xf) + x[k1: k1 + n] * xf, x[k1 + n:]])
        x = fade(x)
    used[lid]["segments"] = [[round(s, 3), round(e, 3)] for s, e in sg]
    out.append((lid, x))
med = float(np.median([level(x) for _, x in out]))
os.makedirs(f"{V5}/wav", exist_ok=True)
def finish(lid, x, words, gain):
    x = x * 10 ** (gain / 20); pk = np.abs(x).max(); x = x * (0.89 / pk) if pk > 0.89 else x
    x, found = debreath.debreath(x, sr, words)
    sf.write(f"{V5}/wav/{lid}.wav", x, sr, subtype="PCM_24"); return x, found
for lid, x in out:
    L = byid[lid]; d = shift[lid][0]
    L["words"] = [{**w, "start": round(w["start"] + d, 3), "end": round(w["end"] + d, 3)} for w in L["words"]]
    L["sentences"] = [{**s, "t0": round(s["t0"] + d, 3), "t1": round(s["t1"] + d, 3)} for s in L["sentences"]]
    x, found = finish(lid, x, L["words"], float(np.clip(med - level(x), -3, 3)))
    L["dur"] = round(len(x) / sr, 3); used[lid]["breaths_lowered"] = [list(b) for b in found]
    if any(shift[lid]): used[lid]["settled"] = {"start_earlier_s": shift[lid][0], "end_later_s": shift[lid][1], "why": "voice_edges.py: the cut waits for the voice to die away (owner, 12 Nov 2026)"}
ref = float(np.median([level(sf.read(f"{V5}/wav/{l}.wav", dtype='float32')[0]) for l, _ in out]))
SPANS = {"C1": (66.0, 68.6), "C2": (69.8, 71.9)}                                       # owner_closers_v4.py
with tempfile.TemporaryDirectory() as T:
    for cid, (s, e) in SPANS.items():
        if cid not in byid: continue
        raw, cl = f"{T}/{cid}.wav", f"{T}/{cid}-clean.wav"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(s - 0.7), "-t", str(e - s + 1.5), "-i", a_.pl, "-ac", "1", "-ar", "48000", raw], check=True)
        subprocess.run([sys.executable, "-I", f"{ROOT}/kits/cinema/voice/clarity.py", "--style", "normal", "--rumble", "--noise", "0.0-0.55", raw, cl], check=True, capture_output=True)
        x, _ = sf.read(cl, dtype="float32"); x = x if x.ndim == 1 else x.mean(1); x = x[int(0.6 * sr):]   # 0 = s - 0.1, as before
        Ec = VE.envelope(x, sr); e_old = e - s + 0.3; e_new = VE.settle_end(Ec, e_old, float(np.percentile(Ec, 8)), cap=0.6)   # the old end: s - 0.1 .. e + 0.2
        x = x[: int(e_new * sr)]; L = byid[cid]
        x, found = debreath.debreath(x, sr, L["words"])
        g = float(np.clip(ref - level(x), -6, 6)); x = x * 10 ** (g / 20); pk = np.abs(x).max(); x = x * (0.89 / pk) if pk > 0.89 else x
        n = int(0.008 * sr); x[:n] *= np.linspace(0, 1, n); x[-n:] *= np.linspace(1, 0, n)
        sf.write(f"{V5}/wav/{cid}.wav", x, sr, subtype="PCM_24"); L["dur"] = round(len(x) / sr, 3)
        used[cid]["breaths_lowered"] = [list(b) for b in found]
        if abs(e_new - e_old) > 0.001: used[cid]["settled"] = {"end_later_s": round(e_new - e_old, 3), "why": "voice_edges.py (owner, 12 Nov 2026)"}
json.dump(J, open(f"{V5}/lines.json", "w"), indent=1, ensure_ascii=False); json.dump(used, open(TU, "w"), indent=1, ensure_ascii=False)
for lid in byid:
    sh = shift.get(lid) or (0, used.get(lid, {}).get("settled", {}).get("end_later_s", 0))
    if any(sh): print(f"{lid}: start {-sh[0]:+.3f} s, end {sh[1]:+.3f} s -> {byid[lid]['dur']} s")
print("NOTE: run once per fresh lines.json/takes-used.json (it rewrites both)")
print("recut", len(out) + len([c for c in SPANS if c in byid]), "lines; level median", round(med, 1), "dB")
