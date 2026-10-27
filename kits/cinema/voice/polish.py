"""Polish a recording of a real voice for narration (crisp, smooth, clear), and cut it into an episode's
line files, so a person can voice a film instead of tts.py.

  python3 -I kits/cinema/voice/polish.py RECORDING --out DIR                       # a voice check: DIR/before.wav, after.wav
  python3 -I kits/cinema/voice/polish.py RECORDING --film films/channels/<ch>/epNN [--out DIR] [--fix 05=retake.m4a]
  then: $CINEMA_VOICE/venv/bin/python -I kits/cinema/voice/align.py DIR

RECORDING is any file ffmpeg reads (a phone's .m4a is fine). It starts with ~3 s of silence (the room
tone the noise reduction learns from). With --film, it holds every vo line of the script once, in
order, with a pause of 2 s or more between lines; it is cut there, and the cut count must equal the
script's line count. A line that went wrong is re-recorded on its own and passed as --fix NN=FILE.

The chain, measured from the recording itself (ffmpeg filters, then numpy):
  level      the speech brought to a known level first, so every threshold below means the same thing
  clean      80 Hz high-pass (rumble, mic thumps); spectral noise reduction that learns the room's own
             noise from the room tone and the pauses (hiss, fan, hum), at most −15 dB (−20 extra) per band
  smooth     a slow leveler (2:1) and a fast peak catcher (4:1), so loud and soft words sit together (about
             6 dB of squeeze on the loudest words, not more); then, because compressors lift the room with
             the quiet words, a gentle downward expander (2.5:1, at most −18 dB, never a hard gate) so the
             pauses go quiet without chopping word ends
  crisp      −3 dB at 320 Hz (boxy, muddy phone sound), +1.5 dB at 140 Hz (body), +2.5 dB at 3.2 kHz
             (consonants: the "pronounced" band), a high shelf of +3 dB from 9 kHz (air)
  de-ess     a split-band de-esser: only the 5–10 kHz band of an "s" that sticks out above the rest of the
             voice is turned down, so the air boost doesn't make s, sh and t hiss
  deliver    −21 LUFS (where tts.py's lines sit, so the soundtrack mixer needs no change), peaks ≤ −2 dBFS,
             48 kHz 24-bit mono, each line trimmed to the voice with 30 ms of air (as tts.py does)

--strength extra adds 1 dB more presence and air, a little harmonic exciter at 7 kHz, and more noise
reduction; normal is the default. The report compares before and after: noise floor, how much the
voice stands above it, sibilance and presence balance, loudness, and each line's pace against
lint.py's 2.2–3.0 words a second.

Writes DIR/NN.wav and DIR/lines.json with tts.py's fields ("voice": "recorded", "phonemes": null), so
align.py, lint.py and timeline.py read it exactly as they read a synthetic voice. DIR defaults to
<film>/vo-recorded; nothing in the film's own vo/ is touched.
"""
import argparse
import hashlib
import json
import re
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent))
from scriptfile import script_lines   # noqa: E402
from studio.meter import lufs          # noqa: E402  (the kit's own BS.1770 meter, at 48 kHz)

SR = 48000
TARGET_LUFS, PEAK_DB = -21.0, -2.0
GAP_S, MIN_LINE_S = 1.6, 0.35
STRENGTH = {
    "normal": {"nr": 15, "presence": 2.5, "air": 3.0, "exciter": None,
               "leveler": "acompressor=threshold=-24dB:ratio=2:attack=15:release=200:knee=6"},
    "extra": {"nr": 20, "presence": 3.5, "air": 4.0, "exciter": "aexciter=amount=0.6:drive=5:freq=7000:blend=0:ceil=16000",
              "leveler": "acompressor=threshold=-26dB:ratio=2:attack=15:release=200:knee=6"},
}


# ── audio in and out ───────────────────────────────────────────────────
def decode(path):
    """Any file ffmpeg reads → float32 mono at 48 kHz."""
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, np.float32).copy()


def ffchain(x, graph):
    """Run float32 mono through an ffmpeg filtergraph (no file on disk)."""
    out = subprocess.run(["ffmpeg", "-v", "error", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-", "-af", graph,
                          "-f", "f32le", "-ar", str(SR), "-ac", "1", "-"], input=x.astype(np.float32).tobytes(),
                         check=True, capture_output=True).stdout
    y = np.frombuffer(out, np.float32).copy()
    return y[:len(x)] if len(y) >= len(x) else np.pad(y, (0, len(x) - len(y)))


def write_wav(path, x):
    """48 kHz 24-bit mono PCM, TPDF-dithered."""
    rng = np.random.default_rng(int.from_bytes(hashlib.sha256(str(Path(path).name).encode()).digest()[:4], "little"))
    q = np.clip(x * 8388607 + rng.random(len(x)) - rng.random(len(x)), -8388608, 8388607).astype("<i4")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1), w.setsampwidth(3), w.setframerate(SR)
        w.writeframes(q.view(np.uint8).reshape(-1, 4)[:, :3].tobytes())


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def loud(x):
    return lufs(np.stack([x, x], 1)) - 3.01 if len(x) > SR // 2 else -70.0   # mono heard on both sides counts once


# ── measuring ──────────────────────────────────────────────────────────
def frames_db(x, win=0.05):
    n = int(win * SR)
    m = len(x) // n
    r = np.sqrt((x[:m * n].reshape(m, n) ** 2).mean(1) + 1e-12)
    return 20 * np.log10(r)


def bands(x, voiced, win=0.05):
    """Mean energy (dB) in a few bands over the voiced frames: what 'muddy', 'clear' and 'hissy' mean in numbers."""
    n = int(win * SR)
    m = len(x) // n
    f = x[:m * n].reshape(m, n)[voiced[:m]] * np.hanning(n)
    if not len(f):
        return {}
    p = (np.abs(np.fft.rfft(f, axis=1)) ** 2).mean(0)
    hz = np.fft.rfftfreq(n, 1 / SR)
    e = lambda a, b: 10 * np.log10(p[(hz >= a) & (hz < b)].sum() + 1e-20)   # noqa: E731
    body, mud, clar, sib = e(100, 1000), e(200, 500), e(2000, 5000), e(5000, 10000)
    return {"mud_vs_body_db": round(mud - body, 1), "presence_vs_body_db": round(clar - body, 1), "sibilance_vs_body_db": round(sib - body, 1)}


def measure(x):
    d = frames_db(x)
    floor, speech = float(np.percentile(d, 10)), float(np.percentile(d, 95))
    voiced = d > max(floor + 10, speech - 30)
    return {"floor_dbfs": round(floor, 1), "speech_dbfs": round(speech, 1), "snr_db": round(speech - floor, 1),
            "lufs": round(loud(x), 1), "peak_dbfs": round(float(20 * np.log10(np.abs(x).max() + 1e-12)), 1), **bands(x, voiced)}, voiced


# ── the chain ──────────────────────────────────────────────────────────
def deess(x, thresh_db=-6.0, max_cut_db=8.0):
    """Split-band de-esser: where the 5–10 kHz band rises above (voice energy + thresh_db), turn that band
    down by the excess (at most max_cut_db), with a 1 ms attack and 60 ms release; the rest is untouched."""
    X = np.fft.rfft(x)
    hz = np.fft.rfftfreq(len(x), 1 / SR)
    w = np.clip((hz - 4500) / 1000, 0, 1) * np.clip((11000 - hz) / 1000, 0, 1)    # 5–10 kHz with soft edges
    sib = np.fft.irfft(X * w, len(x))
    hop = int(0.002 * SR)
    m = len(x) // hop
    e_all = np.sqrt((x[:m * hop].reshape(m, hop) ** 2).mean(1) + 1e-12)
    e_sib = np.sqrt((sib[:m * hop].reshape(m, hop) ** 2).mean(1) + 1e-12)
    over = 20 * np.log10(e_sib / e_all) - thresh_db
    want = -np.clip(over, 0, max_cut_db)                                           # dB of cut wanted per 2 ms
    g, cur = np.empty(m), 0.0
    a_up, a_down = np.exp(-hop / (0.001 * SR)), np.exp(-hop / (0.060 * SR))
    for i in range(m):                                                             # fast into a cut, slow out
        a = a_up if want[i] < cur else a_down
        cur = a * cur + (1 - a) * want[i]
        g[i] = cur
    gs = np.interp(np.arange(len(x)), np.arange(m) * hop + hop / 2, 10 ** (g / 20))
    return x - sib * (1 - gs)


def denoise(x, reduce_db, noise=None, n=2048, hop=512):
    """Spectral noise reduction (power subtraction, 2× over-subtraction, smoothed gains) against the room's
    own noise: the mean spectrum of the quietest 10% of frames (the room tone and the pauses), unless a
    noise spectrum is passed in. No bin is turned down by more than reduce_db, which keeps the voice
    natural and the leftover room even (no 'underwater' warble). → (y, the noise spectrum used)."""
    w = np.sqrt(np.hanning(n + 1)[:-1]).astype(np.float32)                        # sqrt-Hann in and out: Hann overall
    xp = np.pad(x.astype(np.float32), (n, n + hop))
    starts = np.arange(0, len(xp) - n, hop)
    frames = lambda a, b: np.lib.stride_tricks.sliding_window_view(xp, n)[starts[a:b]] * w   # noqa: E731
    P = np.concatenate([np.abs(np.fft.rfft(frames(i, i + 2048), axis=1)).astype(np.float32) ** 2 for i in range(0, len(starts), 2048)])
    if noise is None:
        e = P.sum(1)
        noise = P[e <= np.percentile(e, 10)].mean(0)
    g = np.sqrt(np.maximum(1 - 2.0 * noise / (P + 1e-20), 0))
    q = np.pad(g, ((0, 0), (2, 2)), mode="edge")                                    # smooth across 5 bins (1 2 3 2 1)
    g = (q[:, :-4] + 2 * q[:, 1:-3] + 3 * q[:, 2:-2] + 2 * q[:, 3:-1] + q[:, 4:]) / 9
    g = np.maximum(g, np.maximum(np.vstack([g[:1], g[:-1]]), np.vstack([g[1:], g[-1:]])) * 0.7)            # and hold over 1 frame
    g = np.maximum(g, 10 ** (-reduce_db / 20)).astype(np.float32)
    y = np.zeros(len(xp), np.float32)
    for i in range(0, len(starts), 2048):
        Y = np.fft.irfft(np.fft.rfft(frames(i, i + 2048), axis=1) * g[i:i + 2048], n, axis=1) * w
        for k, s0 in enumerate(starts[i:i + 2048]):
            y[s0:s0 + n] += Y[k]
    return (y / 2.0)[n:n + len(x)], noise                                           # sqrt-Hann² at hop n/4 sums to 2


def polish(x, ref, strength, noise=None):
    """ref: measure() of the raw recording. → (polished, the chain as text, the noise spectrum it removed)."""
    S = STRENGTH[strength]
    pre = -18.0 - ref["speech_dbfs"]                                               # speech peaks at about −18 dBFS
    y = ffchain(x, f"volume={pre:.2f}dB,highpass=f=80:p=2")
    y, noise = denoise(y, S["nr"], noise)
    tone = [
        "bass=g=1.5:f=140:w=0.7",
        "equalizer=f=320:t=q:w=1.1:g=-3",
        f"equalizer=f=3200:t=q:w=0.9:g={S['presence']}",
        f"highshelf=f=9000:g={S['air']}",
        S["leveler"],
        "acompressor=threshold=-14dB:ratio=4:attack=2:release=60:knee=3",
    ]
    y = ffchain(y, ",".join(tone))
    d = frames_db(y)
    floor, speech = float(np.percentile(d, 10)), float(np.percentile(d, 95))
    # after the compressors (which lift the room with the quiet words): a downward expander, 2.5:1 under
    # max(room + 12 dB, speech − 32 dB), at most −18 dB, so pauses go quiet without chopping word ends
    finish = [f"agate=threshold={10 ** (max(floor + 12, speech - 32) / 20):.6f}:ratio=2.5:range=0.125:attack=5:release=200:knee=3"] \
        + ([S["exciter"]] if S["exciter"] else [])
    y = deess(ffchain(y, ",".join(finish)))
    chain = [f"volume={pre:.2f}dB", "highpass=f=80:p=2", f"denoise(room tone profile, at most -{S['nr']} dB per bin)"] + tone + finish \
        + ["deess(5-10 kHz, -6 dB, max 8 dB)"]
    return y, chain, noise


def deliver(y):
    """−21 LUFS, then a true-peak-safe limiter at −2 dBFS (ffmpeg alimiter, no auto makeup)."""
    g = TARGET_LUFS - loud(y)
    lim = 10 ** (PEAK_DB / 20)
    return ffchain(y, f"volume={g:.2f}dB,alimiter=limit={lim:.4f}:attack=3:release=60:level=0:asc=1:latency=1")


# ── cutting into lines ─────────────────────────────────────────────────
def cut(y, gap_s=GAP_S):
    """Voiced stretches separated by pauses of gap_s or more → [(start, end)] in samples."""
    d = frames_db(y, 0.02)
    d = 10 * np.log10(np.convolve(10 ** (d / 10), np.ones(5) / 5, mode="same"))    # over 100 ms: a lone blip isn't a word
    floor, speech = np.percentile(d, 10), np.percentile(d, 95)
    on = d > max(floor + 15, speech - 30)
    n = int(0.02 * SR)
    segs, start, quiet = [], None, 0
    for i, v in enumerate(on):
        if v:
            start = i if start is None else start
            quiet = 0
        elif start is not None:
            quiet += 1
            if quiet * 0.02 >= gap_s:
                segs.append((start * n, (i - quiet + 1) * n))
                start, quiet = None, 0
    if start is not None:
        segs.append((start * n, (len(on) - quiet) * n))
    pad = int(0.4 * SR)                       # a soft last word can sit under the threshold: keep 0.4 s each side, trim() finds the voice
    return [(max(0, a - pad), min(len(y), b + pad)) for a, b in segs if (b - a) / SR >= MIN_LINE_S]


def trim(a, below=30.0, pad=0.03):
    """To the voice, as tts.py's lines are: from the first to the last 30 ms that stay within `below` dB of
    the line's loud words (10 ms frames), keeping pad seconds, with 10 ms fades so a cut never clicks."""
    n = int(0.01 * SR)
    d = frames_db(a, 0.01)
    on = d > np.percentile(d, 95) - below
    run = np.convolve(on, np.ones(3), mode="valid") == 3                            # 3 frames in a row: a word, not a click
    if run.any():
        i, j = int(np.argmax(run)) * n, (len(run) - int(np.argmax(run[::-1])) + 2) * n
        p = int(pad * SR)
        a = a[max(0, i - p):min(len(a), j + p)].copy()
    f = min(len(a) // 4, n)
    if f:
        a[:f] *= np.linspace(0, 1, f)
        a[-f:] *= np.linspace(1, 0, f)
    return a


def words(text):
    return len(re.findall(r"[A-Za-z0-9]+(?:['’.-][A-Za-z0-9]+)*", text))


# ── main ───────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("recording")
    ap.add_argument("--film", help="the episode folder (its script.md says what the lines are)")
    ap.add_argument("--out", help="where to write (default <film>/vo-recorded, or ./voice-check without --film)")
    ap.add_argument("--fix", action="append", default=[], metavar="NN=FILE", help="a line re-recorded on its own")
    ap.add_argument("--strength", choices=list(STRENGTH), default="normal")
    ap.add_argument("--speaker", default="", help="who is speaking (recorded in lines.json)")
    a = ap.parse_args()
    out = Path(a.out or (Path(a.film) / "vo-recorded" if a.film else "voice-check"))
    out.mkdir(parents=True, exist_ok=True)

    raw = decode(a.recording)
    ref, _ = measure(raw)
    y, graph, noise = polish(raw, ref, a.strength)
    pre_main = -18.0 - ref["speech_dbfs"]
    y = deliver(y)
    after, _ = measure(y)
    print(f"{Path(a.recording).name}: {len(raw) / SR:.1f} s, strength {a.strength}")
    print(f"  {'':22}{'before':>9}{'after':>9}")
    for k, label in [("floor_dbfs", "noise floor (dBFS)"), ("snr_db", "voice over floor (dB)"), ("mud_vs_body_db", "mud 200-500 Hz"),
                     ("presence_vs_body_db", "presence 2-5 kHz"), ("sibilance_vs_body_db", "sibilance 5-10 kHz"), ("lufs", "loudness (LUFS)"),
                     ("peak_dbfs", "peak (dBFS)")]:
        print(f"  {label:22}{ref.get(k, '-'):>9}{after.get(k, '-'):>9}")

    if not a.film:
        write_wav(out / "after.wav", y)
        write_wav(out / "before.wav", np.clip(raw * 10 ** ((TARGET_LUFS - ref["lufs"]) / 20), -1, 1))   # same loudness, a fair A/B
        print(f"  wrote {out}/before.wav and after.wav (level-matched, so the difference is the polish, not volume)")
        return 0

    film = Path(a.film)
    lines = list(script_lines(film / "script.md"))
    segs = cut(y)
    fixes = {}
    for f in a.fix:
        k, _, p = f.partition("=")
        fx = decode(p)
        m = measure(fx)[0]               # a short retake may have no room tone: remove the main take's room, at its level
        fixes[int(k)] = deliver(polish(fx, m, a.strength, noise * 10 ** ((-18.0 - m["speech_dbfs"] - pre_main) / 10))[0])
    if len(segs) != len(lines):
        for i, (s, e) in enumerate(segs, 1):
            write_wav(out / f"cut-{i:02d}.wav", trim(y[s:e]))
        print(f"  cut into {len(segs)} pieces at pauses of {GAP_S} s or more, but the script has {len(lines)} lines:")
        print("   " + " · ".join(f"{i}: {(e - s) / SR:.1f} s" for i, (s, e) in enumerate(segs, 1)))
        print(f"  listen to {out}/cut-NN.wav: a pause inside a line splits it (record it again with shorter pauses), "
              "a missing gap joins two (leave 2-3 s between lines), a false start is its own piece (re-record that line and pass --fix NN=FILE)")
        return 3
    meta = {"voice": "recorded", "speaker": a.speaker, "speed": None, "lang": "en-us", "strength": a.strength,
            "source": Path(a.recording).name, "source_sha256": sha256(a.recording), "chain": graph,
            "made_by": "kits/cinema/voice/polish.py", "lines": []}
    print(f"  {len(lines)} lines:")
    for i, ((beat, text, stars), (s, e)) in enumerate(zip(lines, segs), 1):
        x = trim(fixes.get(i, y[s:e]))
        f = out / f"{i:02d}.wav"
        write_wav(f, x)
        dur, n = len(x) / SR, words(text)
        pace = n / dur
        flag = "" if 2.2 <= round(pace, 2) <= 3.0 else ("  ← fast: slow down a little" if pace > 3.0 else "  ← slow: pick up the pace a little")
        print(f"   {i:02d} {beat:9} {dur:5.2f} s  {pace:.2f} words/s  {loud(x):6.1f} LUFS{' (retake)' if i in fixes else ''}{flag}")
        meta["lines"].append({"id": f"vo{i:02d}", "beat": beat, "text": text, "stars": stars, "phonemes": None, "file": f.name,
                              "dur": round(dur, 3), "sha256": sha256(f)})
    (out / "lines.json").write_text(json.dumps(meta, indent=1, ensure_ascii=False) + "\n")
    print(f"  wrote {out}/NN.wav + lines.json; next: align.py {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
