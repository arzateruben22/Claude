"""Season 3 v2 voice stems, audio only: from the untouched NN.raw.wav, (1) a steep 150 Hz high-pass (ffmpeg highpass f=150 poles=2, four times = 48 dB/oct; close-mic breath rumble),
(2) kits/cinema/voice/debreath.py (breaths between words down 30 dB, words untouched). Replaces s3_duck.py.   python3 -I set/s3_voice_fix.py ep13
Prints band levels (dB re. the speech band 300 Hz-4 kHz) before and after, summed over every stem."""
import json, subprocess, sys
from pathlib import Path
import numpy as np, soundfile as sf, re
R = Path(__file__).resolve().parent.parent; sys.path.insert(0, str(R.parent.parent.parent / "kits/cinema/voice")); import debreath, align   # run with the voice venv python (sherpa)
REC = align.recognizer(str(Path.home() / ".cache/cinema-voice/models")); norm = lambda t: re.sub(r"[^a-z0-9']", "", t.lower())
d = R / (sys.argv[1] + "v2"); HP = ",".join(["highpass=f=150:poles=2"] * 4)
def bands(files):
    acc = {"<80": 0.0, "80-160": 0.0, "300-4k": 0.0}
    for f in files:
        x, sr = sf.read(f, dtype="float64"); x = x.mean(1) if x.ndim > 1 else x; X = np.abs(np.fft.rfft(x)) ** 2; fr = np.fft.rfftfreq(len(x), 1 / sr)
        for k, (a, b) in {"<80": (20, 80), "80-160": (80, 160), "300-4k": (300, 4000)}.items(): acc[k] += X[(fr >= a) & (fr < b)].sum()
    return {k: round(10 * np.log10(v / acc["300-4k"]), 1) for k, v in acc.items()}
jobs = []
for sub, wj in (("vo", d / "vo/words.json"), ("vo/yt", d / "vo/yt/words.json")):
    lines = json.loads(wj.read_text())["lines"]; lj = json.loads((d / sub / "lines.json").read_text())["lines"]
    for L in lj:
        wav = d / sub / L["file"]; raw = wav.with_suffix(".raw.wav")
        if not raw.exists(): raise SystemExit(f"no {raw} (the s3_duck originals)")
        jobs.append((raw, wav, wj, L["id"]))
before = bands([j[0] for j in jobs]); n = 0
for raw, wav, wj, lid in jobs:
    tmp = wav.with_suffix(".hp.wav"); subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(raw), "-af", HP, "-c:a", "pcm_f32le", str(tmp)], check=True)
    x, sr = sf.read(tmp, dtype="float64"); tmp.unlink(); ws = debreath.load_words(wj, lid)
    # the aligner snaps word ends short (a whispered "that?" ends 0.4 s early), and debreath would lower the rest as a breath: widen every word to the recogniser's own span for it
    heard = align.asr(REC, (x.mean(1) if x.ndim > 1 else x).astype(np.float32), sr); tm = align.match([w["w"] for w in ws], heard)
    ws2 = [dict(w, start=min(w["start"], t[0]) if t[2] else w["start"], end=max(w["end"], t[1]) if t[2] else w["end"]) for w, t in zip(ws, tm)]
    ws3 = []                                  # whispered word tails (-ings, -iver) look like deep valleys: debreath's long-word split would take them as a breath, so words over 0.6 s are cut into abutting pieces
    for w in ws2:
        k = int(np.ceil((w["end"] - w["start"]) / 0.55)) if w["end"] - w["start"] > 0.6 else 1
        ws3 += [dict(w, start=w["start"] + (w["end"] - w["start"]) * i / k, end=w["start"] + (w["end"] - w["start"]) * (i + 1) / k) for i in range(k)]
    y, found = debreath.debreath(x, sr, ws3, -30.0, -8.0); sf.write(wav, y, sr, subtype="PCM_24"); n += len(found)
    a2, _ = sf.read(wav, dtype="float32"); a2 = a2.mean(1) if a2.ndim > 1 else a2; h0 = [norm(w) for w, _, _ in heard if norm(w)]; h1 = [norm(w) for w, _, _ in align.asr(REC, a2, sr) if norm(w)]
    print(f"{wav.relative_to(R)}: {len(found)} breaths lowered; recogniser text {'unchanged' if h0 == h1 else 'CHANGED: ' + ' '.join(h0) + ' -> ' + ' '.join(h1)}")
print("band levels re. speech band, before:", before, " after:", bands([j[1] for j in jobs]), " breaths lowered:", n)
