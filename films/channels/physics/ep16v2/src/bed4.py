"""Reality Rulebook S3 Part 4 sound bed (synthesised, no music, no voice): room tone, a quiet pan, the sharp real clap,
the deep slowed clap, a soft squeeze of air, the ring crossing the room, glass at the window, then near-silence and a
faint low hum. python3 -I bed4.py out.wav"""
import sys, wave
import numpy as np
SR = 48000; TOTAL = 49.0
N = int(TOTAL * SR); t = np.arange(N) / SR
rng = np.random.default_rng(11)
T_CLAP, T_SLOW = 1.3, 4.6

def fft_filter(x, lo=None, hi=None):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); m = np.ones_like(f)
    if lo: m *= 1 / (1 + (lo / np.maximum(f, 1)) ** 4)
    if hi: m *= 1 / (1 + (f / hi) ** 4)
    return np.fft.irfft(X * m, len(x))
def env(t0, t1, a=0.3, r=0.6, peak=1.0):
    e = np.zeros(N); m = (t >= t0) & (t < t1); tt = t[m] - t0; d = t1 - t0
    e[m] = np.minimum(1, tt / max(a, 1e-3)) * np.minimum(1, (d - tt) / max(r, 1e-3)) * peak
    return e
def stereo(x, w=0.0): return np.stack([x, np.roll(x, int(w * SR)) if w else x], 1)
def db(x): return 10 ** (x / 20)

mix = np.zeros((N, 2))
room = fft_filter(rng.standard_normal(N), 80, 900); room /= np.std(room)
mix += stereo(room * db(-44))

# a quiet pan on the stove: sparse crackle, thinning out as we move away
clicks = np.zeros(N)
for ts in np.sort(rng.uniform(0, 14, 260)):
    i = int(ts * SR); L = int(rng.uniform(0.002, 0.008) * SR)
    clicks[i:i + L] += rng.standard_normal(L) * np.exp(-np.arange(L) / (L / 4)) * rng.uniform(0.2, 1.0)
clicks = fft_filter(clicks, 1800, 9000)
mix += stereo(clicks * env(0, 14, 0.3, 5.0) * db(-33) / (np.std(clicks) + 1e-9) * 0.2, 0.0007)

def clap(t0, scale=1.0):
    L = int(1.2 * SR); tt = np.arange(L) / SR
    crack = fft_filter(rng.standard_normal(L), 900, 7500) * np.exp(-tt / 0.018)
    body = np.sin(2 * np.pi * 190 * tt) * np.exp(-tt / 0.03) + 0.5 * np.sin(2 * np.pi * 95 * tt) * np.exp(-tt / 0.05)
    tail = fft_filter(rng.standard_normal(L), 300, 3500) * np.exp(-tt / 0.28) * 0.12      # the room
    return (crack * 1.0 + body * 0.7 + tail) * scale
c = clap(T_CLAP); i0 = int(T_CLAP * SR); mix[i0:i0 + len(c)] += stereo(c * db(-9))

# the deep, slowed clap at 1,000x: a long falling whoomp with a soft crack on top
tb = np.arange(int(3.2 * SR)) / SR
f = 30 + 55 * np.exp(-tb / 0.45); ph = 2 * np.pi * np.cumsum(f) / SR
w = (np.sin(ph) * np.exp(-tb / 0.8) + 0.3 * np.sin(2 * ph) * np.exp(-tb / 0.45)) * np.minimum(1, tb / 0.06)
nz = fft_filter(rng.standard_normal(len(tb)), 40, 600) * np.exp(-tb / 0.5)
i1 = int(T_SLOW * SR); mix[i1:i1 + len(tb)] += stereo((w * 0.9 + nz * 0.4) * db(-9.5))
# air squeezed out between the palms
hiss = fft_filter(rng.standard_normal(N), 1500, 5500); hiss /= np.std(hiss)
mix += stereo(hiss * env(6.4, 11.8, 1.8, 2.6) * db(-45), 0.001)

# the ring crossing the room: a slow breath of low air that swells and thins; a faint low hum underneath
air = fft_filter(rng.standard_normal(N), 70, 420); air /= np.std(air)
air *= 0.8 + 0.2 * np.sin(2 * np.pi * 0.35 * t)
mix += stereo(air * env(12.2, 26.0, 2.2, 3.5) * db(-37), 0.0012)
hum = np.sin(2 * np.pi * 52 * t) + 0.4 * np.sin(2 * np.pi * 104 * t)
mix += stereo(hum * env(11.0, TOTAL, 3.0, 2.5) * db(-47))
# glass at the window: soft partials swelling as the ring reaches it, then fading
gl = np.zeros(N)
for fr, am in [(1760, 1.0), (2637, 0.6), (3520, 0.4), (4699, 0.25)]:
    vib = 1 + 0.004 * np.sin(2 * np.pi * rng.uniform(0.3, 0.8) * t + rng.uniform(0, 6))
    gl += am * np.sin(2 * np.pi * fr * np.cumsum(vib) / SR + rng.uniform(0, 6))
gl /= np.std(gl)
mix += stereo(gl * env(24.0, 34.0, 2.0, 5.0) * db(-50), 0.0013)
# frozen dust: sparse tiny ticks in the near-silence of 10,000x
for ts in np.sort(rng.uniform(28.5, 44, 14)):
    L = int(0.03 * SR); i = int(ts * SR); tt = np.arange(L) / SR
    mix[i:i + L] += stereo(np.sin(2 * np.pi * rng.uniform(3200, 7000) * tt) * np.exp(-tt / 0.006) * db(-50))
mix *= np.minimum(1, (TOTAL - t) / 0.6)[:, None]; mix *= np.minimum(1, t / 0.05)[:, None]
pk = np.max(np.abs(mix)); print("peak", pk)
mix = mix / max(pk, 1e-9) * 0.85
with wave.open(sys.argv[1], "wb") as wv:
    wv.setnchannels(2); wv.setsampwidth(2); wv.setframerate(SR); wv.writeframes((np.clip(mix, -1, 1) * 32767).astype("<i2").tobytes())
print("wrote", sys.argv[1])
