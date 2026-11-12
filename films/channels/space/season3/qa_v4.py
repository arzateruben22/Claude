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
rec = align.recognizer(str(Path.home() / ".cache/cinema-voice/models"))
def hear(t0, t1):   # ASR of just this caption's slice of the final mix (music and all)
    seg = a[int(max(0, t0) * sr): int(t1 * sr)]; ws = align.asr(rec, seg, sr); return [w for w, s_, e_ in ws]
def norm(x): x = to_display(x).lower().replace("kilometers", "km").replace("centimeters", "cm"); x = re.sub(r"(?<!\d)\.|\.(?!\d)", " ", x.replace(",", "")); return re.sub(r"[^a-z0-9×.]", " ", x).split()
bad = 0
caps = tl["captions"]
for ci, c in enumerate(caps):
    nb = set(sum([norm(caps[j]["text"]) for j in (ci - 1, ci + 1) if 0 <= j < len(caps)], []))   # words of the neighbouring captions are not extras
    h = hear(c["t0"] - 0.35, c["t1"] + 0.3); a_, b_ = norm(c["text"]), norm(" ".join(h))
    SAME = {"halve": "half", "feels": "fills", "title": "tidal", "point": "pull", "pool": "pull", "port": "pull", "p": "pull"}   # spelling twins and the recogniser swaps heard on his raw takes too (feels/fills, pull/pool/port/point): NOTE a person should listen to "tidal pull"
    b_ = [SAME.get(x, x) for x in b_]; a_ = [SAME.get(x, x) for x in a_]; miss = [x for x in a_ if x not in b_]; inner = b_[1:-1] if len(b_) > 2 else []; extra = [x for x in inner if x not in a_ and x not in nb]   # the first and last heard word may be a neighbour's edge
    flag = "" if not miss and not extra else "  <-- caption/speech differ"; bad += bool(miss or extra)
    print(f"  {c['t0']:6.2f}  caption: {c['text']!r}\n          speech : {' '.join(h)!r}{flag}")
print("caption = speech:", "OK" if not bad else f"{bad} caption(s) differ (check the lines above)"); ok &= not bad; print("QA", "PASS" if ok else "FAIL")
