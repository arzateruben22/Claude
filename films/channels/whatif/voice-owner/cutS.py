"""Cut the owner's Part A recording (the long narration) into SENTENCES by word alignment (flubs are restarted at sentence level, so the last
take of each sentence is kept), polish them with polish.py's chain (normal style), and assemble each script line from its sentences.
Writes DIR/sNNN.wav (one per sentence), DIR/NN.wav (one per script line), DIR/lines.json (tts-style, plus a "sentences" list per line).
Every sample is the owner's; nothing is re-voiced.

  CINEMA_VOICE=/root/.cache/cinema-voice $CINEMA_VOICE/venv/bin/python -I films/channels/whatif/voice-owner/cutS.py --recording R.m4a [--recording R2.m4a ...] \
      --script films/channels/whatif/longform/earth-spin/script.md --out films/channels/whatif/voice-owner/cutA
(More than one recording: they are treated as one continuous take, in order; sentences already matched are not looked for again.)
"""
import argparse, difflib, json, os, re, subprocess, sys, tempfile
from pathlib import Path
import numpy as np
import soundfile as sf

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[3]
sys.path.insert(0, str(REPO / "kits/cinema/voice"))
import align, polish                       # noqa: E402

NUM = {"1": "one", "2": "two", "3": "three", "4": "four", "5": "five", "6": "six", "7": "seven", "8": "eight", "12": "twelve", "20": "twenty", "16": "sixteen", "24": "twenty four", "17": "seventeen"}
def toks(s):
    out = []
    for w in re.findall(r"[A-Za-z0-9']+", s.lower().replace("’", "'")):
        out += NUM.get(w, w).split()
    return out

def sentences(text):
    return [s for s in re.split(r"(?<=[.?!])\s+", text.strip()) if s]

def ratio(E, w): return difflib.SequenceMatcher(None, E, w, autojunk=False).ratio()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--recording", action="append", required=True)
    ap.add_argument("--script", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--first", type=int, default=1)
    ap.add_argument("--last", type=int, default=999)
    ap.add_argument("--style", default="normal")
    a = ap.parse_args()
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    txt = Path(a.script).read_text()
    vo = [re.sub(r"\s+", " ", re.sub(r"\{[^}]*\}", "", m)).strip().replace("*", "") for m in re.findall(r"^vo: (.*)$", txt, re.M)]
    names = re.findall(r"^## (\S+)", txt, re.M)
    S = []                                   # (line index, sentence index, text)
    for li in range(a.first - 1, min(a.last, len(vo))):
        for si, s in enumerate(sentences(vo[li])): S.append((li, si, s))
    sr = polish.SR
    ys, heard, envs, offs = [], [], [], []
    base = 0.0
    rec = align.recognizer(os.environ["CINEMA_VOICE"] + "/models")
    for r in a.recording:
        raw = polish.decode(r)
        ref, _ = polish.measure(raw)
        y, graph, noise = polish.polish(raw, ref, a.style)
        y = polish.deliver(y)
        with tempfile.TemporaryDirectory() as td:
            w16 = Path(td) / "r.wav"
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", r, "-ac", "1", "-ar", "16000", str(w16)], stderr=subprocess.DEVNULL)
            x16, s16 = sf.read(w16, dtype="float32")
        hw = align.asr(rec, x16, s16)
        env = align.envelope(x16, s16)
        ys.append(y); envs.append(env)
        for w, s0, e0 in hw: heard.append((w, s0 + base, e0 + base, len(ys) - 1, s0, e0))
        offs.append(base); base += len(x16) / s16
    H = [(toks(w) or [w])[0] for w, *_ in heard]
    # one flat time axis for the (concatenated) recordings
    picks, pos = [], 0
    for k, (li, si, text) in enumerate(S):
        E = toks(text); n = len(E)
        nxt = toks(S[k + 1][2]) if k + 1 < len(S) else None
        cands = []
        for i in range(pos, len(H)):
            for L in range(max(2, n - 3), n + 4):
                w = H[i:i + L]
                if len(w) < 2: continue
                r_ = ratio(E, w)
                if r_ < 0.6: continue
                if nxt and ratio(nxt, w) > r_ + 0.02: continue     # this window is really the next sentence
                cands.append((r_, i, i + len(w)))
        if not cands: raise SystemExit(f"no match for sentence {k + 1}: {text}")
        cands.sort(key=lambda t: t[1])
        clusters, cur = [], [cands[0]]
        for t in cands[1:]:
            if t[1] - cur[-1][1] <= max(3, n // 2): cur.append(t)
            else: clusters.append(cur); cur = [t]
        clusters.append(cur)
        gb = max(t[0] for cl in clusters for t in cl)
        ok = [cl for cl in clusters if max(t[0] for t in cl) >= gb - 0.12]
        cl = ok[-1]
        r_, i0, i1 = max(cl, key=lambda t: (round(t[0], 2), t[1], -abs(t[2] - t[1] - n)))
        picks.append((k, li, si, text, r_, i0, i1, len(clusters)))
        pos = i1
    room_cache = {}
    sent_files, per_line = [], {}
    for j, (k, li, si, text, r_, i0, i1, ncl) in enumerate(picks):
        w0, w1 = heard[i0], heard[i1 - 1]
        ri = w0[3]
        env = envs[ri]; y = ys[ri]
        s0 = align.snap(w0[4], env, None)
        prev_end = heard[picks[j - 1][6] - 1][5] if j and heard[picks[j - 1][6] - 1][3] == ri else 0.0
        nxt_start = heard[picks[j + 1][5]][4] if j + 1 < len(picks) and heard[picks[j + 1][5]][3] == ri else len(env) * align.HOP
        def quiet(a_, b_):
            ia, ib = int(a_ / align.HOP), int(b_ / align.HOP)
            seg = env[ia:ib] if ib > ia else env[ia:ia + 1]
            return (ia + int(np.argmin(seg))) * align.HOP
        a_cut = quiet(max(prev_end, s0 - 0.3), s0) if s0 - prev_end > 0.05 else s0 - 0.03
        e0 = w1[5]
        b_cut = quiet(e0, min(nxt_start - 0.03, e0 + 0.45)) if nxt_start - e0 > 0.08 else e0 + 0.02
        if ri not in room_cache: room_cache[ri] = polish.cut(y)[1]
        x = polish.trim(y[int(a_cut * sr): int(b_cut * sr)], room_cache[ri])
        f = out / f"s{k + 1:03d}.wav"
        polish.write_wav(f, x)
        heard_txt = " ".join(h[0] for h in heard[i0:i1])
        sent_files.append(dict(k=k + 1, line=li, si=si, text=text, heard=heard_txt, file=f.name, dur=round(len(x) / sr, 3), src=[ri, round(a_cut, 2), round(b_cut, 2)], match=round(r_, 2), takes=ncl))
        flag = "" if r_ >= 0.8 else f"   <-- low match; heard: {heard_txt}"
        print(f"s{k + 1:03d} L{li + 1:02d}.{si + 1} {len(x) / sr:5.2f}s match {r_:.2f} takes {ncl} src {ri}:{a_cut:6.1f}-{b_cut:6.1f} {text[:50]}{flag}")
    # lines from sentences: the natural gap when two sentences are neighbours in the source, else 0.35 s
    lines = []
    for li in sorted({s["line"] for s in sent_files}):
        ss = [s for s in sent_files if s["line"] == li]
        parts, t, sl = [], 0.0, []
        for q, s in enumerate(ss):
            x, _ = sf.read(out / s["file"])
            if q:
                p = ss[q - 1]
                gap = 0.35
                if p["src"][0] == s["src"][0] and 0 < s["src"][1] - p["src"][2] <= 1.2 and s["src"][1] > p["src"][1]:
                    gap = max(0.12, s["src"][1] - p["src"][2])
                parts.append(np.zeros(int(gap * sr))); t += gap
            sl.append(dict(si=s["si"], t0=round(t, 3), t1=round(t + len(x) / sr, 3), text=s["text"], match=s["match"]))
            parts.append(x); t += len(x) / sr
        y = np.concatenate(parts)
        f = out / f"{li + 1:02d}.wav"
        polish.write_wav(f, y)
        lines.append({"id": f"vo{li + 1:02d}", "beat": names[li], "text": vo[li], "stars": [], "phonemes": None, "file": f.name, "dur": round(len(y) / sr, 3),
                      "sha256": polish.sha256(f), "sentences": sl})
        print(f"vo{li + 1:02d} {names[li]:9} {len(y) / sr:6.2f} s  {len(toks(vo[li])) / (len(y) / sr):.2f} w/s")
    meta = {"voice": "recorded", "speaker": "owner", "speed": None, "lang": "en-us", "style": a.style, "source": [Path(r).name for r in a.recording],
            "source_sha256": [polish.sha256(r) for r in a.recording], "chain": graph, "made_by": "films/channels/whatif/voice-owner/cutS.py", "lines": lines, "sentence_files": sent_files}
    (out / "lines.json").write_text(json.dumps(meta, indent=1, ensure_ascii=False) + "\n")

if __name__ == "__main__":
    main()
