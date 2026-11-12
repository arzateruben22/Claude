"""Take the breaths out of a real voice recording, between the words only, without touching the words.

    python -I debreath.py in.wav words.json out.wav [--line vo03] [--breath-db -30] [--gap-db -8]

words.json: the studio's alignment format ({"lines": [{"id", "words": [{"w", "start", "end"}]}]}) or a plain list of
{"w", "start", "end"} (seconds, in this file's own time). Use --line to pick one line of a multi-line file.

How (restoration only, no resynthesis, the voice stays the speaker's own):
  1. Word edges are refined from the audio: an aligned word is extended over the contiguous sound around it (up to 150 ms
     before, 220 ms after), so soft onsets and long whispered tails ("-iver", "-ings", a trailing vowel) count as the word.
  2. Every pause between words (and the lead-in and the tail) of 120 ms or more, after a guard of 60 ms before the next word
     and 90 ms after the last, is examined in 5 ms frames.
  3. Breath = any sound in a pause at least 8 dB above the recording's floor (whisper-safe: Evelyn's whispered words are
     unvoiced too, so the words are protected by the alignment and the refined edges, not by pitch). Breaths drop by --breath-db (default -30 dB); the rest of the pause (room tone) by --gap-db (-8 dB),
     so pauses stay natural, never dead silence. A clearly voiced sound inside a pause (a word the aligner missed: pitched for
     80 ms or more, within 12 dB of the words) keeps full level. Each pause's breath is lowered as one smooth stretch.
  Long words (over 0.6 s) are split at a deep valley (15 dB under the word for 60 ms or more): whatever follows the valley is
     treated as a pause, because aligners often hand the breath after a phrase to its last word.
  4. The gain moves with 10 ms raised-cosine smoothing: no clicks, no pumping on the words.
The old Skin Sense ducking (s3_duck.py) only treated pauses over about 0.6 s and protected anything within 20 dB of the
voice, which kept Evelyn's soft breaths (they are as loud as her soft speech). This replaces it for every channel."""
import argparse, json
import numpy as np, soundfile as sf


def frames_voicing(m, sr, hop=0.005, win=0.02):
    """Per-frame level (dB) and voicing (0..1) on a 16 kHz copy."""
    k = max(1, int(round(sr / 16000))); y = m[::k] if k > 1 else m; fs = sr / k
    H, N = int(hop * fs), int(win * fs); nf = max(1, (len(y) - N) // H + 1)
    idx = np.arange(N)[None, :] + H * np.arange(nf)[:, None]; F = y[idx] * np.hanning(N)[None, :]
    lv = 10 * np.log10((F ** 2).mean(1) + 1e-14)
    S = np.abs(np.fft.rfft(F, 2 * N, axis=1)) ** 2; ac = np.fft.irfft(S, axis=1)[:, :N]; ac = ac / (ac[:, :1] + 1e-14)
    l0, l1 = int(fs / 400), int(fs / 70); vo = ac[:, l0:l1].max(1)
    t = (np.arange(nf) * H + N / 2) / fs
    return t, lv, vo


def debreath(x, sr, words, breath_db=-30.0, gap_db=-8.0, pre=0.06, post=0.09, min_gap=0.12, split_long=False):
    m = x.mean(1) if x.ndim == 2 else x; n = len(m); dur = n / sr
    t, lv, vo = frames_voicing(m, sr); floor = np.percentile(lv, 8)
    ws = sorted(({"s": float(w["start"]), "e": float(w["end"])} for w in words if w.get("end", 0) > w.get("start", 0)), key=lambda w: w["s"])
    inw = np.zeros(len(t), bool)
    for w in ws: inw |= (t >= w["s"]) & (t <= w["e"])
    ref = np.percentile(lv[inw], 90) if inw.any() else lv.max()
    snd = lv > max(floor + 10, ref - 30)                                      # "sound" for edge refinement
    for w in ws:                                                              # 1. refine edges over contiguous sound
        i = np.searchsorted(t, w["s"])
        j = i
        while j > 0 and snd[j - 1] and t[i] - t[j - 1] <= 0.15: j -= 1
        w["s"] = min(w["s"], t[j] if j < len(t) else w["s"])
        i = np.searchsorted(t, w["e"]); j = i
        while j < len(t) - 1 and snd[j] and t[j] - t[min(i, len(t) - 1)] <= 0.22: j += 1
        w["e"] = max(w["e"], t[j] if j < len(t) else w["e"])
    for w in (ws if split_long else []):                                      # opt-in: a breath the aligner gave to the word before it
        if w["e"] - w["s"] < 0.6: continue
        sel = np.nonzero((t >= w["s"]) & (t <= w["e"]))[0]
        if len(sel) < 20: continue
        pk = np.percentile(lv[sel], 90); low = lv[sel] < pk - 15
        run = np.convolve(low.astype(float), np.ones(12), "valid") >= 12   # >= 60 ms deep valley
        hits = np.nonzero(run)[0]
        if len(hits) and sel[hits[0]] > sel[0] + 40:                          # at least 0.2 s of word before the valley
            w["e"] = t[sel[hits[0]]]
    edges = ([(0.0, ws[0]["s"])] if ws else [(0.0, dur)]) + [(a["e"], b["s"]) for a, b in zip(ws, ws[1:])] + ([(ws[-1]["e"], dur)] if ws else [])
    g_fr = np.ones(len(t)); found = []; gb, gg = 10 ** (breath_db / 20), 10 ** (gap_db / 20)
    for k, (a, b) in enumerate(edges):                                        # 2-3. examine each pause
        a2 = a + (post if k > 0 else 0.0); b2 = b - (pre if (ws and k < len(edges) - 1) else 0.0)
        if b2 - a2 < min_gap: continue
        sel = (t >= a2) & (t < b2); g_fr[sel] = gg
        br = sel & (lv > floor + 8)
        kv = sel & (vo >= 0.75) & (lv > ref - 12)                             # a clearly voiced word the aligner missed
        keep = np.convolve(kv.astype(float), np.ones(16), "same") >= 16 * 0.8   # sustained ~80 ms, not a blip of low breath noise
        keep = np.convolve(keep.astype(float), np.ones(9), "same") > 0
        br = np.convolve(br.astype(float), np.ones(31), "same") > 0           # one breath = one smooth stretch (merge within ~150 ms)
        br &= sel & ~keep
        if br.any():                                                          # fill from its first to last breath frame: no chopping
            ii = np.nonzero(br)[0]; seg = np.zeros_like(br); seg[ii[0]:ii[-1] + 1] = True; br = seg & sel & ~keep
        g_fr[br] = gb; g_fr[keep] = 1.0
        if br.any():
            d = np.diff(np.concatenate([[0], br.astype(int), [0]])); s0 = np.nonzero(d == 1)[0]; s1 = np.nonzero(d == -1)[0]
            found += [(round(t[i], 2), round(t[j - 1], 2)) for i, j in zip(s0, s1) if t[j - 1] - t[i] >= 0.04]
    g = np.interp(np.arange(n) / sr, t, g_fr)                                 # 4. smooth, sample-accurate
    for w in ws: g[int(max(0, w["s"]) * sr):int(min(dur, w["e"]) * sr)] = 1.0
    L = int(0.010 * sr); ker = np.hanning(L); ker /= ker.sum(); g = np.convolve(g, ker, "same")
    for w in ws: g[int(max(0, w["s"]) * sr):int(min(dur, w["e"]) * sr)] = 1.0
    y = x * (g[:, None] if x.ndim == 2 else g)
    return y, found


def load_words(path, line=None):
    j = json.load(open(path))
    if isinstance(j, list): return j
    ls = j["lines"]
    if line: ls = [L for L in ls if L["id"] == line]
    return [w for L in ls for w in L["words"]]


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("src"); ap.add_argument("words"); ap.add_argument("dst"); ap.add_argument("--line")
    ap.add_argument("--breath-db", type=float, default=-30.0); ap.add_argument("--gap-db", type=float, default=-8.0); ap.add_argument("--split-long", action="store_true"); a = ap.parse_args()
    x, sr = sf.read(a.src, dtype="float64"); ws = load_words(a.words, a.line)
    y, found = debreath(x, sr, ws, a.breath_db, a.gap_db, split_long=a.split_long)
    sf.write(a.dst, y, sr, subtype="PCM_24")
    print(f"debreath: {len(found)} breaths lowered {a.breath_db:.0f} dB ({sum(b - a_ for a_, b in found):.2f} s); words untouched -> {a.dst}")
    for s, e in found: print(f"  breath {s:6.2f}-{e:6.2f}")
