"""owner_asr.py <audio.flac> <out.json>: Parakeet word stream (word, start, end) for the owner's long recording, in 24 s windows with 5 s overlap (words kept from the window where they are farthest from its edges)."""
import json, sys
from pathlib import Path
import numpy as np, soundfile as sf
sys.path.insert(0, "/home/user/claude/kits/cinema/voice"); import align
src, out = sys.argv[1:3]; a, sr = sf.read(src, dtype="float32"); a = a if a.ndim == 1 else a.mean(1)
rec = align.recognizer(str(Path.home() / ".cache/cinema-voice/models")); W, ST = 24.0, 19.0; words = []; t0 = 0.0; wins = []
while t0 < len(a) / sr:
    seg = a[int(t0 * sr): int((t0 + W) * sr)]; ws = align.asr(rec, seg, sr); wins.append((t0, [(w, s + t0, e + t0) for w, s, e in ws])); t0 += ST
best = {}
for t0, ws in wins:
    for w, s, e in ws:
        m = (s + e) / 2; edge = min(m - t0, t0 + W - m)
        k = round(m / 0.2)                                       # one word per 200 ms slot: the one from the window where it sits most centrally
        if k not in best or edge > best[k][3]: best[k] = (w, s, e, edge)
words = sorted(((w, round(s, 3), round(e, 3)) for w, s, e, _ in best.values()), key=lambda x: x[1])
json.dump(words, open(out, "w")); print(len(words), "words;", round(len(a) / sr, 1), "s")
