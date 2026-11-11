"""Cut the owner's real recording into its lines, by word alignment (the pauses are too short for polish.py's 2 s rule), polish them
with kits/cinema/voice/polish.py's own chain (normal style) and write voice-owner/cut/NN.wav + lines.json.
Where a line was read twice, the LAST take is kept. Nothing is re-voiced or cloned: every sample is the owner's.

  CINEMA_VOICE=/root/.cache/cinema-voice $CINEMA_VOICE/venv/bin/python -I films/channels/whatif/voice-owner/cut.py [--recording FILE --lines LINES.json --out DIR]
"""
import argparse, difflib, json, os, re, sys
from pathlib import Path
import numpy as np
import soundfile as sf

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[3]
sys.path.insert(0, str(REPO / "kits/cinema/voice"))
import align, polish                       # noqa: E402

NUM = {"1": "one", "2": "two", "3": "three", "4": "four", "5": "five", "6": "six", "7": "seven", "8": "eight", "12": "twelve"}
def toks(s):
    out = []
    for w in re.findall(r"[A-Za-z0-9']+", s.lower().replace("’", "'")):
        out.append(NUM.get(w, w))
    return out

# the 28 lines the owner read, in recording order
PARTS = [
 ("What if Earth spun faster, and couldn't stop?", "And the spin has only just begun to speed up."),
 ("The day is now twelve hours long.", "And then the wind starts to blow."),
 ("The air can't keep up with the ground.", "And then the oceans start to move."),
 ("The oceans are sliding toward the equator.", "And the weather is about to change completely."),
 ("Storms are turning faster, and the days are six hours long.", "And the calendar is about to break."),
 ("Now a year has more than a thousand days in it.", "And the days keep getting shorter."),
 ("Three hours, then two: a day is as long as a movie.", "And at an hour and a half, you are almost weightless."),
 ("A day now lasts about an hour and a half.", "One more nudge, and something changes completely.")]
NUMW = "one two three four five six seven eight".split()
LINES = []
for i, (o, c) in enumerate(PARTS, 1):
    LINES += [(f"p{i}-open", o), (f"p{i}-cliff", c)]
for i in range(8):
    LINES.append((f"closer{i + 1}", f"Part {NUMW[i]} of eight. Full video on YouTube."))
LINES += [("cta-hang-follow", "Hang on. If you're enjoying this, tap like and follow. Okay, back to the math."),
          ("cta-hang-subscribe", "Hang on. If you're enjoying this, tap like and subscribe. Okay, back to the math."),
          ("cta-break-follow", "Quick break: like and follow. Then let's see how bad this gets."),
          ("cta-break-subscribe", "Quick break: like and subscribe. Then let's see how bad this gets.")]

def candidates(H, E, after):
    n = len(E)
    best = []
    for i in range(after, len(H)):
        for L in range(max(2, n - 2), n + 3):
            w = H[i:i + L]
            if len(w) < 2: continue
            r = difflib.SequenceMatcher(None, E, w, autojunk=False).ratio()
            best.append((r, i, i + L))
    return best

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--recording", default=str(HERE / "pl-s3-parts-closers-cta.m4a"))
    ap.add_argument("--out", default=str(HERE / "cut"))
    ap.add_argument("--style", default="normal")
    a = ap.parse_args()
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    raw = polish.decode(a.recording)
    sr = polish.SR
    ref, _ = polish.measure(raw)
    y, graph, noise = polish.polish(raw, ref, a.style)
    y = polish.deliver(y)
    # word times from the recognizer on the (unpolished) recording at 16 kHz
    import subprocess, tempfile
    with tempfile.TemporaryDirectory() as td:
        w16 = Path(td) / "r.wav"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", a.recording, "-ac", "1", "-ar", "16000", str(w16)], stderr=subprocess.DEVNULL)
        x16, s16 = sf.read(w16, dtype="float32")
    rec = align.recognizer(os.environ["CINEMA_VOICE"] + "/models")
    heard = align.asr(rec, x16, s16)
    H = [toks(w)[0] if toks(w) else w for w, _, _ in heard]
    env = align.envelope(x16, s16)
    pos = 0
    picks = []
    for idx, (lid, text) in enumerate(LINES):
        E = toks(text)
        c = [t for t in candidates(H, E, pos) if t[0] >= 0.55]
        # the last distinct cluster = the last take; stop before the next line's first words
        if not c: raise SystemExit(f"no match for {lid}: {text}")
        c.sort(key=lambda t: t[1])
        clusters, cur = [], [c[0]]
        for t in c[1:]:
            if t[1] - cur[-1][1] <= max(3, len(E) // 2): cur.append(t)
            else: clusters.append(cur); cur = [t]
        clusters.append(cur)
        # a cluster belongs to this line only if it is not better explained by a later line: keep clusters in order, take the last whose best score is within 0.1 of the global best
        gb = max(t[0] for cl in clusters for t in cl)
        ok = [cl for cl in clusters if max(t[0] for t in cl) >= gb - 0.1]
        cl = ok[-1]
        r, i0, i1 = max(cl, key=lambda t: (round(t[0], 2), t[1], -abs(t[2] - t[1] - len(E))))   # best score; on a tie the LATER take
        picks.append((lid, text, r, i0, i1, len(clusters)))
        pos = i1
    json_lines = []
    n = len(heard)
    for k, (lid, text, r, i0, i1, ncl) in enumerate(picks):
        s0 = heard[i0][1]; e0 = heard[i1 - 1][2]
        prev_end = heard[picks[k - 1][4] - 1][2] if k else 0.0
        nxt = heard[picks[k + 1][3]][1] if k + 1 < len(picks) else len(x16) / s16
        s = align.snap(s0, env, prev_end)
        # the cut sits at the quietest point of the gap on each side
        def quiet(a_, b_):
            ia, ib = int(a_ / align.HOP), int(b_ / align.HOP)
            seg = env[ia:ib] if ib > ia else env[ia:ia + 1]
            return (ia + int(np.argmin(seg))) * align.HOP
        a_cut = quiet(max(prev_end, s - 0.35), s) if s - prev_end > 0.05 else s - 0.03
        b_cut = quiet(e0, min(nxt - 0.05, e0 + 0.5)) if nxt - e0 > 0.1 else e0 + 0.02
        clip = y[int(a_cut * sr): int(b_cut * sr)]
        room = polish.cut(y)[1]
        x = polish.trim(clip, room)
        f = out / f"{k + 1:02d}.wav"
        polish.write_wav(f, x)
        dur = len(x) / sr
        words_n = len(toks(text))
        json_lines.append({"id": f"vo{k + 1:02d}", "beat": lid, "text": text, "stars": [], "phonemes": None, "file": f.name,
                           "dur": round(dur, 3), "sha256": polish.sha256(f), "take_of": ncl, "source_s": [round(a_cut, 2), round(b_cut, 2)], "match": round(r, 2)})
        print(f"{k + 1:02d} {lid:20} {dur:5.2f} s  {words_n / dur:.2f} w/s  match {r:.2f}  takes {ncl}  src {a_cut:6.1f}-{b_cut:6.1f}")
    meta = {"voice": "recorded", "speaker": "owner", "speed": None, "lang": "en-us", "style": a.style, "source": Path(a.recording).name,
            "source_sha256": polish.sha256(a.recording), "chain": graph, "made_by": "films/channels/whatif/voice-owner/cut.py (word-aligned cuts, kits/cinema/voice/polish.py chain)", "lines": json_lines}
    (out / "lines.json").write_text(json.dumps(meta, indent=1, ensure_ascii=False) + "\n")

if __name__ == "__main__":
    main()
