"""Reality Rulebook S3 Part 3 sound bed (synthesised; no music, no voice): kitchen room tone, gas flame, oil sizzle, steam,
the deep slowed 'whoomp' of the kernel, a glassy shimmer for the bubble, the hole sweep and the drifting droplets.
python3 -I bed.py out.wav"""
import sys
from pathlib import Path
import numpy as np
import wave

sys.path.insert(0, str(Path(__file__).parent))
from cfg import TOTAL, T_BURST, T_POP

SR = 48000
N = int(TOTAL * SR)
t = np.arange(N) / SR
rng = np.random.default_rng(3)


def lp(x, fc, order=2):
    """one-pole low-pass applied `order` times"""
    a = np.exp(-2 * np.pi * fc / SR)
    for _ in range(order):
        y = np.empty_like(x); acc = 0.0
        for i in range(0, len(x)):
            acc = a * acc + (1 - a) * x[i]; y[i] = acc
        x = y
    return x


def fft_filter(x, lo=None, hi=None):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    m = np.ones_like(f)
    if lo: m *= 1 / (1 + (lo / np.maximum(f, 1)) ** 4)
    if hi: m *= 1 / (1 + (f / hi) ** 4)
    return np.fft.irfft(X * m, len(x))


def env(t0, t1, a=0.3, r=0.6, peak=1.0):
    e = np.zeros(N); m = (t >= t0) & (t < t1)
    tt = t[m] - t0; d = t1 - t0
    e[m] = np.minimum(1, tt / max(a, 1e-3)) * np.minimum(1, (d - tt) / max(r, 1e-3)) * peak
    return e


def stereo(x, width=0.0):
    return np.stack([x, np.roll(x, int(width * SR)) if width else x], 1)


def db(x):
    return 10 ** (x / 20)


mix = np.zeros((N, 2))

# room tone: soft low air, always on
room = fft_filter(rng.standard_normal(N), 80, 900); room /= np.std(room)
mix += stereo(room * db(-44))

# gas flame: low breathy rumble, present while the pan is in view, then gone
flame = fft_filter(rng.standard_normal(N), 110, 700); flame /= np.std(flame)
flame *= 0.7 + 0.3 * np.sin(2 * np.pi * 0.7 * t + 1.1)
mix += stereo(flame * env(0, 24, 0.6, 5.0) * db(-38))

# oil sizzle: a dense scatter of tiny crackles, fading out as the pan leaves the picture
clicks = np.zeros(N)
for ts in np.sort(rng.uniform(0, 24, 700)):
    i = int(ts * SR); L = int(rng.uniform(0.002, 0.01) * SR)
    if i + L >= N: continue
    clicks[i:i + L] += rng.standard_normal(L) * np.exp(-np.arange(L) / (L / 4)) * rng.uniform(0.2, 1.0)
clicks = fft_filter(clicks, 1800, 9500)
mix += stereo(clicks * env(0, 24, 0.4, 6.0) * db(-29) / (np.std(clicks) + 1e-9) * 0.2, 0.0007)

# a few distinct ticks as the kernel tenses, just before the burst
for k, dt in enumerate([-1.35, -0.95, -0.62, -0.38, -0.2, -0.08]):
    i = int((T_BURST + dt) * SR); L = int(0.012 * SR)
    tick = rng.standard_normal(L) * np.exp(-np.arange(L) / (L / 5))
    tick = fft_filter(np.pad(tick, (0, 2000)), 1500, 7000)[:L]
    mix[i:i + L] += stereo(tick * db(-31 + 1.2 * k))

# the burst: a deep, slowed, stretched 'whoomp' (pitch falls 95 -> 34 Hz) with a soft crack on top
tb = np.arange(int(2.6 * SR)) / SR
f = 34 + 61 * np.exp(-tb / 0.32)
ph = 2 * np.pi * np.cumsum(f) / SR
whoomp = np.sin(ph) * np.exp(-tb / 0.55) + 0.35 * np.sin(2 * ph) * np.exp(-tb / 0.3)
noise = fft_filter(rng.standard_normal(len(tb)), 40, 700) * np.exp(-tb / 0.35)
body = (whoomp * 0.9 + noise * 0.5)
body *= np.minimum(1, tb / 0.01)
i0 = int(T_BURST * SR)
mix[i0:i0 + len(tb)] += stereo(body * db(-8.5))
crack = fft_filter(rng.standard_normal(int(0.06 * SR)) * np.exp(-np.arange(int(0.06 * SR)) / (0.012 * SR)), 1200, 6500)
mix[i0:i0 + len(crack)] += stereo(crack * db(-17))

# steam: breathy hiss after the burst, thinning out
hiss = fft_filter(rng.standard_normal(N), 2800, 11000); hiss /= np.std(hiss)
mix += stereo(hiss * env(T_BURST + 0.1, 21.5, 0.6, 7.0) * db(-37) * (0.8 + 0.2 * np.sin(2 * np.pi * 0.4 * t)), 0.0011)

# bubble shimmer: soft glassy partials with slow vibrato, swelling toward the pop
sh = np.zeros(N)
for fr, am in [(2093, 1.0), (3135, 0.7), (4186, 0.5), (5588, 0.35), (6272, 0.25)]:
    vib = 1 + 0.004 * np.sin(2 * np.pi * rng.uniform(0.3, 0.9) * t + rng.uniform(0, 6))
    sh += am * np.sin(2 * np.pi * fr * np.cumsum(vib) / SR + rng.uniform(0, 6)) * (0.6 + 0.4 * np.sin(2 * np.pi * rng.uniform(0.2, 0.5) * t + rng.uniform(0, 6)))
sh /= np.std(sh)
mix += stereo(sh * (env(20.6, T_POP + 3.5, 1.8, 3.0) ) * db(-47), 0.0013)

# the pop at 1,000x: a soft low 'puh', then a glassy sweep falling 6 kHz -> 700 Hz as the hole races round
tp = np.arange(int(5.0 * SR)) / SR
puh = np.sin(2 * np.pi * np.cumsum(30 + 70 * np.exp(-tp / 0.25)) / SR) * np.exp(-tp / 0.45)
puh += 0.4 * fft_filter(rng.standard_normal(len(tp)), 60, 600) * np.exp(-tp / 0.2)
j0 = int(T_POP * SR); mix[j0:j0 + len(tp)] += stereo(puh * db(-11))
tw = np.arange(int(7.0 * SR)) / SR
fsw = 700 + 5300 * np.exp(-tw / 2.2)
sweep = np.sin(2 * np.pi * np.cumsum(fsw) / SR) + 0.5 * np.sin(4 * np.pi * np.cumsum(fsw) / SR)
sweep *= np.minimum(1, tw / 0.4) * np.exp(-tw / 3.2)
mix[j0:j0 + len(tw)] += stereo(sweep * db(-35), 0.0009)
rush = fft_filter(rng.standard_normal(len(tw)), 900, 7000) * np.minimum(1, tw / 0.5) * np.exp(-tw / 2.8)
mix[j0:j0 + len(tw)] += stereo(rush * db(-37) / (np.std(rush) + 1e-9) * 0.6, 0.001)

# droplets: sparse high pings, drifting through the frozen air
for ts in np.sort(rng.uniform(T_POP + 1.2, T_POP + 17, 46)):
    fr = rng.uniform(2800, 8200); L = int(rng.uniform(0.05, 0.16) * SR); i = int(ts * SR)
    if i + L >= N: continue
    tt = np.arange(L) / SR
    ping = np.sin(2 * np.pi * fr * tt) * np.exp(-tt / (L / SR / 4))
    pan = rng.uniform(-0.6, 0.6)
    amp = db(rng.uniform(-45, -38)) * (1 if ts < T_POP + 9 else 0.8)
    mix[i:i + L, 0] += ping * amp * (1 - pan) / 2 * 1.4
    mix[i:i + L, 1] += ping * amp * (1 + pan) / 2 * 1.4

# a faint low hum that carries the last 4 seconds ('up next: sound')
hum = np.sin(2 * np.pi * 55 * t) + 0.4 * np.sin(2 * np.pi * 110 * t)
mix += stereo(hum * env(TOTAL - 6.5, TOTAL, 3.0, 1.0) * db(-46))

mix *= np.minimum(1, (TOTAL - t) / 0.5)[:, None]    # fade the tail
mix *= np.minimum(1, t / 0.05)[:, None]
pk = np.max(np.abs(mix)); print("peak", pk)
mix = mix / max(pk, 1e-9) * 0.85
pcm = (np.clip(mix, -1, 1) * 32767).astype("<i2")
with wave.open(sys.argv[1], "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print("wrote", sys.argv[1])
