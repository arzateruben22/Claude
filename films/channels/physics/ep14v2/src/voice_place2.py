"""RR S3 Part 2: place the owner's nine takes (rr2_raw.wav) on the baked captions of the delivered timeline.
caption starts are the source captions mapped through the cuts (-0.7 s after the 12.0 s cut, -1.5 s after the 20.4 s cut)."""
import sys
import numpy as np, soundfile as sf
R, D = sys.argv[1], sys.argv[2]
x, sr = sf.read(R + 'rr2_raw.wav', dtype='float32'); assert sr == 48000
caps  = [0.70, 6.20, 11.60, 16.20, 20.40, 29.95, 32.60, 38.00, 43.00]     # caption appears (v2 timeline: -1.2 s after the 12.0 s cut, -2.1 s after the 20.4 s cut)
spans = [(5.40, 8.12), (9.45, 11.95), (13.40, 16.35), (17.35, 19.62), (20.65, 22.10), (23.42, 25.32), (27.30, 29.66), (31.76, 33.68), (35.22, 37.70)]
out = np.zeros(int(51.5 * sr), dtype='float32')
def energy_onset(a, b):
    """first moment in the span where the level is within 30 dB of the span's own peak (10 ms hops)"""
    seg = x[int(a * sr):int(b * sr)]; h = int(0.01 * sr); n = len(seg) // h
    e = 20 * np.log10(np.sqrt((seg[:n * h].reshape(n, h) ** 2).mean(1)) + 1e-9)
    return a + int(np.argmax(e > e.max() - 30)) * 0.01
for (a, b), c in zip(spans, caps):
    o = energy_onset(a, b); a = o - 0.08          # start 80 ms before the first sound: no breath, no room tone before it
    seg = x[int(a * sr):int(b * sr)].copy()
    f = int(0.012 * sr); seg[:f] *= np.linspace(0, 1, f); seg[-f:] *= np.linspace(1, 0, f)
    start = c + 0.12 - (o - a)                  # the speech onset lands 0.12 s after the caption appears
    i = int(round(start * sr)); out[i:i + len(seg)] += seg
    print(f'line {a:5.2f}-{b:5.2f} -> {start:5.2f}-{start + len(seg) / sr:5.2f} (caption {c:.2f})')
sf.write(D + 'voice_raw2.wav', out, sr, subtype='FLOAT')
