"""Private ingest of the owner's male takes (never in git): consent.wav + utterance takes + lines.json.

  clone-venv/bin/python -I ingest_male.py
Reads the polished full takes (polish.py voice-check after.wav) and writes ~/.cache/cinema-voice/male/takes/.
"""
import json, os, subprocess, sys
from pathlib import Path
import numpy as np
import soundfile as sf

KIT = Path(__file__).resolve().parent
sys.path.insert(0, str(KIT))
from align import recognizer, asr  # noqa: E402

SP = Path(os.environ.get("VOICE_IN", Path.home() / ".cache/cinema-voice/male/raw"))
SRC = [SP / "check/after.wav", SP / "check-voice2/after.wav", SP / "check-voice3/after.wav"]
OUT = Path.home() / ".cache/cinema-voice/male/takes"
MODELS = Path.home() / ".cache/cinema-voice/models"
ASR_SR = 16000


def load16(p):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(p), "-ac", "1", "-ar", str(ASR_SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for p in (OUT.parent, OUT):
        p.chmod(0o700)
    rec = recognizer(MODELS)
    lines, n = [], 0
    for k, src in enumerate(SRC):
        full, sr = sf.read(src, dtype="float32", always_2d=True)
        full = full.mean(1)
        x16 = load16(src)
        words = []
        step = 20 * ASR_SR                       # transcribe in 20 s windows (cut at quiet points), keep absolute times
        i = 0
        while i < len(x16):
            j = min(len(x16), i + step)
            if j < len(x16):                     # move the cut to the quietest 50 ms in the last 3 s
                seg = x16[j - 3 * ASR_SR:j]
                e = np.convolve(seg ** 2, np.ones(800) / 800, "same")
                j = j - 3 * ASR_SR + int(np.argmin(e))
            for w, s, e in asr(rec, x16[i:j], ASR_SR):
                words.append((w, s + i / ASR_SR, e + i / ASR_SR))
            i = j
        start = 0
        if k == 0:                               # consent sentence: from the start to the first "sense" after "skin"
            low = [w.lower().strip(".,!?") for w, _, _ in words]
            try:
                si = next(m for m in range(len(low) - 1) if low[m] == "skin" and low[m + 1].startswith("sense"))
            except StopIteration:
                sys.exit("could not find 'Skin Sense' at the start of voice 1: not cutting a consent file")
            end = words[si + 1][2] + 0.3
            a = full[:int(end * sr)]
            sf.write(OUT / "consent.wav", a, sr, subtype="PCM_24")
            print(f"consent.wav: 0-{end:.1f} s: {' '.join(w for w, _, _ in words[:si + 2])}")
            start = si + 2
        # utterances: break at gaps >= 0.6 s, keep 3-14 s pieces (merge short neighbours)
        segs, cur = [], [words[start]] if start < len(words) else []
        for w in words[start + 1:]:
            if w[1] - cur[-1][2] >= 0.6 or (w[2] - cur[0][1]) > 14:
                segs.append(cur); cur = [w]
            else:
                cur.append(w)
        if cur:
            segs.append(cur)
        for sg in segs:
            t0, t1 = max(0, sg[0][1] - 0.12), sg[-1][2] + 0.15
            if t1 - t0 < 3:
                continue
            n += 1
            f = f"{n:02d}.wav"
            sf.write(OUT / f, full[int(t0 * sr):int(t1 * sr)], sr, subtype="PCM_24")
            lines.append({"file": f, "text": " ".join(w for w, _, _ in sg), "src": src.parent.name, "t0": round(t0, 2), "t1": round(t1, 2)})
    (OUT / "lines.json").write_text(json.dumps({"speaker": "male", "name": "Ruben", "lines": lines}, indent=1))
    tot = sum(l["t1"] - l["t0"] for l in lines)
    print(f"{len(lines)} takes, {tot:.0f} s, in {OUT}")


if __name__ == "__main__":
    main()
