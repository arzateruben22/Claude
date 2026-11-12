"""qa_v4.py <cut.mp4> <timeline.json>: the v4 gate. 61-75 s; -14 LUFS (+-0.5); no still over 1.4 s (freezedetect n=0.003 d=1.4); caption text equals the speech:
Parakeet ASR of the final mix, passed through the same numerals.to_display as the captions, compared word by word with every caption in its time window.
usage: ~/.cache/cinema-voice/venv/bin/python -I qa_v4.py cut.mp4 timeline.json"""
import json, re, subprocess, sys, difflib
from pathlib import Path
import numpy as np, soundfile as sf
ROOT = Path("/home/user/claude"); sys.path.insert(0, str(ROOT / "kits/cinema/film")); sys.path.insert(0, str(ROOT / "kits/cinema/voice")); from numerals import to_display; import align
mp4, tlp = sys.argv[1:3]; tl = json.load(open(tlp)); ok = True
dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp4], capture_output=True, text=True).stdout)
print(f"duration {dur:.2f} s", "OK" if 61 <= dur <= 75 else "FAIL (outside 61-75 s)"); ok &= 61 <= dur <= 75
r = subprocess.run(["ffmpeg", "-hide_banner", "-i", mp4, "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True).stderr; I = float(re.findall(r"I:\s+(-?[\d.]+) LUFS", r)[-1]); print(f"loudness {I} LUFS", "OK" if abs(I + 14) <= 0.5 else "FAIL"); ok &= abs(I + 14) <= 0.5
fz = subprocess.run(["ffmpeg", "-hide_banner", "-i", mp4, "-vf", "freezedetect=n=0.003:d=1.4", "-an", "-f", "null", "-"], capture_output=True, text=True).stderr; fr = re.findall(r"freeze_start: ([\d.]+)", fz); print("stills over 1.4 s:", fr or "none", "OK" if not fr else "FAIL"); ok &= not fr
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", mp4, "-vn", "-ac", "1", "-ar", "16000", "/tmp/qa_v4.wav"], check=True); a, sr = sf.read("/tmp/qa_v4.wav", dtype="float32")
rec = align.recognizer(str(Path.home() / ".cache/cinema-voice/models")); W, S = 24.0, 19.0; t0 = 0.0; best = {}
while t0 < len(a) / sr:
    for w, s, e in align.asr(rec, a[int(t0 * sr): int((t0 + W) * sr)], sr):
        s += t0; e += t0; m = (s + e) / 2; q = min(m - t0, t0 + W - m)
        k = round(m, 1)
        if k not in best or q > best[k][3]: best[k] = (w, s, e, q)
    t0 += S
asr = sorted(best.values(), key=lambda x: x[1])
def norm(x): x = to_display(x).lower().replace("kilometers", "km").replace("centimeters", "cm"); return re.sub(r"[^a-z0-9×.]", " ", x.replace(",", "")).split()
bad = 0
for c in tl["captions"]:
    win = " ".join(w for w, s, e, q in asr if c["t0"] - 0.35 <= (s + e) / 2 <= c["t1"] + 0.35); a_, b_ = norm(c["text"]), norm(win)
    sm = difflib.SequenceMatcher(None, a_, b_); ratio = sm.ratio(); miss = [x for x in a_ if x not in b_]; extra = [x for x in b_ if x not in a_]
    flag = "" if not miss and not extra else "  <-- caption/speech differ"; bad += bool(miss or extra)
    print(f"  {c['t0']:6.2f}  caption: {c['text']!r}\n          speech : {win!r}{flag}")
print("caption = speech:", "OK" if not bad else f"{bad} caption(s) differ (check the lines above)"); ok &= not bad; print("QA", "PASS" if ok else "FAIL")
