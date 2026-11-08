"""Voice a film's script in the owner's cloned voice (Chatterbox, MIT, CPU): tts.py-compatible output.

  $CINEMA_VOICE/clone-venv/bin/python -I kits/cinema/voice/clone.py SCRIPT.md OUTDIR --speaker female --takes TAKES_DIR [--takes DIR2] \
      [--whisper-takes WDIR] [--whisper-beats id,id] [--refresh-ref]

TAKES_DIR holds the owner's polished takes (polish.py output: NN.wav + lines.json). The reference set is
picked automatically, once, and cached PRIVATELY in ~/.cache/cinema-voice/<speaker>/ (refused if that
folder is inside a git work tree): the cleanest 30-90 s of narration-style speech (ref_narration.wav) and
the cleanest whisper take (ref_whisper.wav). Nothing of the owner's voice is ever written into the repo
except the synthetic output lines, which are model output, not recordings.

Writes OUTDIR/NN.wav (24 kHz mono, -21 LUFS, trimmed) + OUTDIR/lines.json with tts.py's fields
("voice": f"clone-{a.speaker}", "phonemes": null), so align.py, lint.py and the compilers work unchanged.
`--pick-only` selects and caches the reference without loading the model (use it to check the pick).
"""
import argparse, hashlib, json, os, subprocess, sys, time
from pathlib import Path
import numpy as np
import soundfile as sf

sys.path.insert(0, str(Path(__file__).resolve().parent))
from scriptfile import script_lines   # noqa: E402
from align import recognizer, asr   # noqa: E402,F401  (sherpa-onnx is imported lazily inside)

SR = 24000
HERE = Path(__file__).resolve().parent
CACHE = Path(os.environ.get("CINEMA_VOICE", Path.home() / ".cache/cinema-voice"))
ROOT = Path.home() / ".cache/cinema-voice"   # one private folder per speaker: ROOT/<speaker>/
OWNER = ROOT / "owner"                     # set per run by main() from --speaker
LOCK = HERE / "clone.lock.json"
COND_S = 10.0                      # seconds of reference the model conditions on


def sha256(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def in_git(p):
    r = subprocess.run(["git", "-C", str(p), "rev-parse", "--is-inside-work-tree"], capture_output=True, text=True)
    return r.returncode == 0 and r.stdout.strip() == "true"


def load(p):
    x, sr = sf.read(p, dtype="float32", always_2d=True)
    x = x.mean(1)
    if sr != SR:
        import subprocess as sp
        raw = sp.run(["ffmpeg", "-v", "error", "-i", str(p), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
        x = np.frombuffer(raw, np.float32)
    return x


def frames_db(x, win=0.05):
    n = int(win * SR)
    f = x[:len(x) // n * n].reshape(-1, n)
    return 20 * np.log10(np.sqrt((f ** 2).mean(1)) + 1e-9)


def quality(x):
    """(score, snr_db): voice level over room level, penalised by clipping and by being mostly silent."""
    d = frames_db(x)
    if len(d) < 10:
        return -99, 0
    snr = np.percentile(d, 90) - np.percentile(d, 8)
    voiced = float((d > np.percentile(d, 90) - 25).mean())
    clip = float((np.abs(x) > 0.99).mean())
    return snr * min(1.0, voiced / 0.6) - 400 * clip, snr


def candidates(dirs):
    out = []
    for d in dirs:
        d = Path(d)
        meta = json.loads((d / "lines.json").read_text()) if (d / "lines.json").exists() else {"lines": []}
        info = {l["file"]: l for l in meta["lines"]}
        for f in sorted(d.glob("*.wav")):
            if "consent" in f.name.lower() or (f.name == "01.wav" and (d / "consent.wav").exists()):
                continue
            x = load(f)
            dur = len(x) / SR
            l = info.get(f.name)
            wps = len(l["text"].split()) / dur if l else None
            narr = dur >= 3 and (wps is None or 2.0 <= wps <= 3.3)
            sc, snr = quality(x)
            out.append({"file": str(f), "x": x, "dur": dur, "score": sc, "snr": snr, "narr": narr, "wps": wps})
    return out


def best_window(x, secs=COND_S):
    """The cleanest `secs` window (highest voiced share, lowest noise) of one take."""
    n = int(secs * SR)
    if len(x) <= n:
        return x
    d = frames_db(x)
    w = int(secs / 0.05)
    best, at = -1e9, 0
    for i in range(0, len(d) - w + 1, 10):
        seg = d[i:i + w]
        s = (np.percentile(seg, 90) - np.percentile(seg, 8)) * float((seg > np.percentile(d, 90) - 25).mean())
        if s > best:
            best, at = s, i
    a = at * int(0.05 * SR)
    return x[a:a + n]


def pick_reference(takes, whisper_takes):
    OWNER.mkdir(parents=True, exist_ok=True)
    OWNER.chmod(0o700)
    pick = {}
    c = [t for t in candidates(takes) if t["narr"]]
    if not c:
        sys.exit("no narration-style takes (>= 3 s, 2.0-3.3 words/s) in --takes")
    c.sort(key=lambda t: -t["score"])
    chosen, tot = [], 0.0
    for t in c:                                    # cleanest first, until 30-90 s (target 60)
        if tot >= 60 or tot + t["dur"] > 90:
            continue
        chosen.append(t); tot += t["dur"]
    if tot < 30:
        print(f"WARNING: only {tot:.0f} s of clean narration found (want 30-90 s)", file=sys.stderr)
    gap = np.zeros(int(0.35 * SR), np.float32)
    ref = np.concatenate([np.concatenate([t["x"], gap]) for t in chosen])
    sf.write(OWNER / "ref_narration.wav", ref, SR, subtype="PCM_24")
    sf.write(OWNER / "cond_narration.wav", best_window(max(chosen, key=lambda t: t["score"])["x"]), SR, subtype="PCM_24")
    pick["narration"] = {"files": [Path(t["file"]).name for t in chosen], "seconds": round(tot, 1),
                         "snr_db": [round(float(t["snr"]), 1) for t in chosen]}
    if whisper_takes:
        w = [t for t in candidates(whisper_takes) if t["dur"] >= 3]
        if w:
            t = max(w, key=lambda t: t["score"])
            sf.write(OWNER / "cond_whisper.wav", best_window(t["x"]), SR, subtype="PCM_24")
            pick["whisper"] = {"file": Path(t["file"]).name, "snr_db": round(float(t["snr"]), 1)}
    (OWNER / "pick.json").write_text(json.dumps(pick, indent=1))
    return pick


CONSENT = ("This is my own voice, and I agree to it being copied to narrate these science channels: "
           "Reality Rulebook, One More Orbit, Body Backstage, Possibility Lab and Skin Sense.")
# The general sentence for a voice kept on file to narrate any of the owner's videos, on any subject.
CONSENT_GENERAL = ("This is my own voice, and I agree to it being copied to narrate my videos on any subject, "
                   "across all of my channels and projects.")
CONSENT_MIN = 0.8


def require_consent(dirs, models):
    """Refuse unless a take saved as consent.wav (line 01 of voice 1, saved at ingest) TRANSCRIBES to the
    consent sentence (>= 0.8 word similarity, Parakeet via align.py). The transcript is the gate, not the filename."""
    import difflib
    from align import recognizer, asr
    from scriptfile import norm
    f = next((Path(d) / "consent.wav" for d in dirs if (Path(d) / "consent.wav").exists()), None)
    if not f:
        sys.exit("NO consent.wav in --takes: save line 01 of voice 1 as consent.wav at ingest. Not cloning this voice")
    heard = [norm(w) for w, _, _ in asr(recognizer(models), load(f), SR)]
    # either sentence passes: the original channel list, or the general sentence; the better match counts
    sim = max(difflib.SequenceMatcher(None, heard, [norm(w) for w in c.split()]).ratio() for c in (CONSENT, CONSENT_GENERAL))
    print(f"consent check: word similarity {sim:.2f} (need {CONSENT_MIN}); heard: {' '.join(heard)}")
    if sim < CONSENT_MIN:
        sys.exit("CONSENT LINE DOES NOT MATCH: refusing to clone this voice")


def trim(a, db=-45.0, pad=0.02):
    e = np.abs(a) > np.abs(a).max() * 10 ** (db / 20)
    i, j = int(np.argmax(e)), len(a) - int(np.argmax(e[::-1]))
    p = int(pad * SR)
    return a[max(0, i - p):min(len(a), j + p)]


def deliver(a, lufs=-21.0, peak_db=-2.0):
    import pyloudnorm as pyln
    a = a.astype(np.float64)
    a = a * 10 ** ((lufs - pyln.Meter(SR).integrated_loudness(a)) / 20)
    pk = np.abs(a).max()
    lim = 10 ** (peak_db / 20)
    return (a * min(1.0, lim / pk)).astype(np.float32)


def model_dir(lock):
    d = Path(os.environ.get("CLONE_MODEL_DIR", CACHE / "models/chatterbox"))
    if not d.exists():
        sys.exit(f"model not found at {d}: run kits/cinema/voice/setup_clone.sh first")
    shas = {f: sha256(d / f) for f in lock["files"]}
    pinned = {f: v for f, v in lock["files"].items() if v}
    bad = [f for f, v in pinned.items() if shas[f] != v]
    if bad:
        sys.exit(f"model files differ from clone.lock.json: {bad}")
    if not pinned:
        print("WARNING: clone.lock.json has no pinned hashes yet (first run); recording what is on disk", file=sys.stderr)
    return d, shas


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("script"); ap.add_argument("out")
    ap.add_argument("--takes", action="append", required=True, help="polished takes dir (polish.py output); repeatable")
    ap.add_argument("--whisper-takes", action="append", default=[])
    ap.add_argument("--whisper-beats", default="", help="comma list of beat ids to voice with the whisper reference")
    ap.add_argument("--speaker", required=True, help="speaker id, e.g. female or male; refs go in ~/.cache/cinema-voice/<id>/")
    ap.add_argument("--theme", help="theme.json: narrator.voice 'clone-<id>' must match --speaker (guards a wrong-voice render)")
    ap.add_argument("--line-voice", action="append", default=[], metavar="BEAT=SPEAKER",
                    help="voice this beat with another already-prepared speaker (two-host formats later)")
    ap.add_argument("--models", default=str(CACHE / "models"), help="folder with parakeet/ (setup.sh)")
    ap.add_argument("--refresh-ref", action="store_true")
    ap.add_argument("--pick-only", action="store_true")
    ap.add_argument("--exaggeration", type=float, default=0.4, help="calm narrator ~0.35-0.5")
    ap.add_argument("--cfg", type=float, default=0.5)
    ap.add_argument("--temperature", type=float, default=0.7)
    ap.add_argument("--seed", type=int, default=1234)
    a = ap.parse_args()
    global OWNER
    OWNER = ROOT / a.speaker
    if a.theme:
        want = json.loads(Path(a.theme).read_text()).get("narrator", {}).get("voice")
        if want != f"clone-{a.speaker}":
            sys.exit(f"{a.theme} narrator.voice is {want!r}, but --speaker {a.speaker} would make 'clone-{a.speaker}'")
    if in_git(OWNER.parent if OWNER.parent.exists() else Path.home()):
        sys.exit(f"{OWNER} is inside a git work tree; refusing (owner voice data stays out of git)")
    if a.refresh_ref or not (OWNER / "cond_narration.wav").exists():
        require_consent(a.takes, a.models)
        pick = pick_reference(a.takes, a.whisper_takes)
        print("reference:", json.dumps(pick))
    if a.pick_only:
        return
    lock = json.loads(LOCK.read_text())
    mdir, shas = model_dir(lock)
    import torch, perth, chatterbox, importlib.metadata as md
    from chatterbox.tts import ChatterboxTTS
    torch.set_num_threads(os.cpu_count() or 4)
    model = ChatterboxTTS.from_local(mdir, "cpu")
    over = dict(x.split("=", 1) for x in a.line_voice)
    whisper_ids = {b for b in a.whisper_beats.split(",") if b}
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    meta = {"voice": f"clone-{a.speaker}", "speed": 1.0, "lang": "en-us",
            "model_sha256": hashlib.sha256(json.dumps(shas, sort_keys=True).encode()).hexdigest(),
            "model_files_sha256": shas, "voices_sha256": sha256(OWNER / "cond_narration.wav"),
            "chatterbox_tts": md.version("chatterbox-tts"), "torch": torch.__version__, "python": sys.version.split()[0],
            "watermark": "resemble-perth (imperceptible, survives re-encoding; do not strip)", "lines": []}
    for i, (beat, text, stars) in enumerate(script_lines(a.script), 1):
        whisper = beat in whisper_ids and (ROOT / over.get(beat, a.speaker) / "cond_whisper.wav").exists()
        spk = over.get(beat, a.speaker)
        ref = ROOT / spk / ("cond_whisper.wav" if whisper else "cond_narration.wav")
        if not ref.exists():
            ref = ROOT / spk / "cond_narration.wav"
        if not ref.exists():
            sys.exit(f"no prepared reference for speaker {spk!r}: run clone.py --pick-only --speaker {spk} first")
        torch.manual_seed(a.seed + i)
        t0 = time.time()
        wav = model.generate(text, audio_prompt_path=str(ref), exaggeration=a.exaggeration * (0.6 if whisper else 1),
                             cfg_weight=a.cfg, temperature=a.temperature)
        audio = deliver(trim(wav.squeeze().cpu().numpy().astype(np.float32)))
        sr = model.sr
        assert sr == SR, f"model sample rate {sr} != {SR}"
        f = out / f"{i:02d}.wav"
        sf.write(f, audio, SR, subtype="PCM_24")
        meta["lines"].append({"id": f"vo{i:02d}", "beat": beat, "text": text, "stars": stars, "phonemes": None,
                              "file": f.name, **({"voice": f"clone-{spk}"} if spk != a.speaker else {}), "dur": round(len(audio) / SR, 3), "sha256": sha256(f)})
        print(f"vo{i:02d} {beat:<8} {len(audio) / SR:5.2f} s  ({time.time() - t0:4.0f} s to make{', whisper' if whisper else ''})  {text[:50]}")
    (out / "lines.json").write_text(json.dumps(meta, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()
