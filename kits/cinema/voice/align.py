"""Word timings for a voice line: Parakeet TDT (sherpa-onnx) for the words, then snapped to the
audio's own energy, then matched to the script so captions use the script's spelling.

  $CINEMA_VOICE/venv/bin/python -I kits/cinema/voice/align.py VODIR      (reads VODIR/lines.json)

Writes VODIR/words.json: per line, every script word with its start and end (seconds from the
line's start) and whether the recognizer heard it. Parakeet's times sit on an 80 ms grid and run
early at phrase starts, so each start is moved to the energy onset nearby (see snap()); the
accuracy of the result is measured, not assumed (README: "How accurate").
"""
import difflib
import json
import os
import re
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

HOP = 0.005          # 5 ms envelope


def recognizer(models):
    import sherpa_onnx
    pk = Path(models) / "parakeet"
    return sherpa_onnx.OfflineRecognizer.from_transducer(
        encoder=str(pk / "encoder.int8.onnx"), decoder=str(pk / "decoder.int8.onnx"), joiner=str(pk / "joiner.int8.onnx"),
        tokens=str(pk / "tokens.txt"), num_threads=4, model_type="nemo_transducer", decoding_method="greedy_search")


def asr(rec, audio, sr):
    """[(word, start, end)] from the recognizer's tokens."""
    st = rec.create_stream()
    st.accept_waveform(sr, audio.astype(np.float32))
    rec.decode_stream(st)
    r = st.result
    words = []
    durs = list(r.durations) if getattr(r, "durations", None) else [0.08] * len(r.tokens)
    for tok, ts, du in zip(r.tokens, r.timestamps, durs):
        if tok.startswith(("▁", " ")) or not words:
            words.append([tok.lstrip("▁ "), ts, ts + du])
        else:
            words[-1][0] += tok
            words[-1][2] = ts + du
    return [(w, s, e) for w, s, e in words if w]


def envelope(audio, sr):
    h = int(HOP * sr)
    n = len(audio) // h
    e = np.sqrt((audio[: n * h].reshape(n, h) ** 2).mean(1) + 1e-12)
    return 20 * np.log10(e / e.max())


def snap(start, env, prev_end=None, floor=-38.0, back=0.12, fwd=0.2):
    """Move a recognizer start to where the word's sound begins.

    - If it lands in silence (below floor), move forward to the first 5 ms frame with sound.
    - If sound runs into it from before (the recognizer is early or late inside a phrase), move to
      the deepest energy dip within [start − back, start + fwd/2], then to the rise after it: word
      boundaries inside speech are dips, not silences.
    """
    i = int(round(start / HOP))
    n = len(env)
    i = min(max(i, 0), n - 1)
    if env[i] < floor:
        j = i
        while j < min(n, i + int(fwd / HOP)) and env[j] < floor:
            j += 1
        return j * HOP
    lo, hi = max(0, i - int(back / HOP)), min(n, i + int(fwd / 2 / HOP))
    if prev_end is not None:
        lo = max(lo, int(prev_end / HOP))
    if hi - lo < 3:
        return start
    seg = env[lo:hi]
    k = int(np.argmin(seg))
    if seg[k] < floor:                         # a real gap: start at the first sound after it
        j = lo + k
        while j < n - 1 and env[j] < floor:
            j += 1
        return j * HOP
    if seg.max() - seg[k] > 6:                 # a dip of 6 dB or more: the boundary
        return (lo + k) * HOP
    return start


def norm(w):
    return re.sub(r"[^a-z0-9']", "", w.lower())


def match(script_words, heard):
    """Give each script word the time of the recognizer word it matches; interpolate the rest."""
    a, b = [norm(w) for w in script_words], [norm(w) for w, _, _ in heard]
    times = [None] * len(script_words)
    for blk in difflib.SequenceMatcher(None, a, b, autojunk=False).get_matching_blocks():
        for k in range(blk.size):
            times[blk.a + k] = (heard[blk.b + k][1], heard[blk.b + k][2], True)
    known = [i for i, t in enumerate(times) if t]
    for i, t in enumerate(times):
        if t is None:
            prev = max([k for k in known if k < i], default=None)
            nxt = min([k for k in known if k > i], default=None)
            s = times[prev][1] if prev is not None else 0.0
            e = times[nxt][0] if nxt is not None else s + 0.3
            times[i] = (s, e, False)
    return times


def line_words(rec, audio, sr, text, snap_on=True):
    script_words = text.split()
    heard = asr(rec, audio, sr)
    times = match(script_words, heard)
    env = envelope(audio, sr)
    out, prev_end = [], None
    for w, (s, e, ok) in zip(script_words, times):
        s2 = snap(s, env, prev_end) if snap_on else s
        out.append({"w": w, "start": round(s2, 3), "end": round(max(e, s2 + 0.05), 3), "heard": ok})
        prev_end = s2
    return out, " ".join(w for w, _, _ in heard)


def main():
    vodir = Path(sys.argv[1])
    models = os.environ.get("CINEMA_VOICE", str(Path.home() / ".cache/cinema-voice")) + "/models"
    if len(sys.argv) > 2:
        models = sys.argv[2]
    meta = json.loads((vodir / "lines.json").read_text())
    rec = recognizer(models)
    res = {"recognizer": "parakeet-tdt-0.6b-v2-int8", "lines": []}
    for ln in meta["lines"]:
        audio, sr = sf.read(vodir / ln["file"], dtype="float32")
        audio = audio.mean(1) if audio.ndim == 2 else audio
        words, heard = line_words(rec, audio, sr, ln["text"])
        miss = [w["w"] for w in words if not w["heard"]]
        res["lines"].append({"id": ln["id"], "text": ln["text"], "heard": heard, "words": words})
        print(f"{ln['id']}: {len(words)} words, {len(miss)} not heard{': ' + ' '.join(miss) if miss else ''}")
    (vodir / "words.json").write_text(json.dumps(res, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()
