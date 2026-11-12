"""The YouTube cut of a part says 'subscribe' where the Shorts cut says 'follow'.
Re-voices only the CTA sentence (same voice, speed and lexicon as the part), stretches it to the old sentence's length, splices it into the
line's WAV, mixes the part's audio again with that WAV, and puts the new audio under the existing 1440p video (video copied, not re-encoded).
  $CINEMA_VOICE/venv/bin/python -I lf01/tools/ytvoice.py N        # N = 13..20 (the episode folder ep13..ep20)
The spoken 'like' stays in the sentence ("tap like and subscribe"), so the app's like pop-up still lands 0.25 s before it."""
import json, os, re, shutil, subprocess, sys, tempfile
from pathlib import Path
import numpy as np, soundfile as sf
CH = Path("/home/user/claude/films/channels/physics"); ROOT = CH.parent.parent.parent
n = int(sys.argv[1]); ep = CH / f"ep{n}"; part = n - 12
lines = json.loads((ep / "vo/lines.json").read_text()); words = json.loads((ep / "vo/words.json").read_text())
L = next(x for x in lines["lines"] if re.search(r"\bfollow\b", x["text"], re.I)); W = next(x for x in words["lines"] if x["id"] == L["id"])["words"]
ix = next(i for i, w in enumerate(W) if re.match(r"follow", w["w"], re.I)); jx = ix
while jx > 0 and not re.search(r"[.!?]$", W[jx - 1]["w"]): jx -= 1
# the sentence runs from W[jx] to W[ix]
text_new = " ".join(w["w"] for w in W[jx:ix + 1]); text_new = re.sub(r"follow", "subscribe", text_new, flags=re.I)
s0, e0 = max(0.0, W[jx]["start"] - 0.02), W[ix]["end"] + 0.03
tmp = Path(tempfile.mkdtemp(prefix=f"ytvoice{n}_"))
(tmp / "mini").mkdir(); (tmp / "mini/script.md").write_text("# mini\n\n## body {chapter: x} (0.0–5.0 s)\nvo: " + text_new + "\n")
env = dict(os.environ); voice = lines["voice"]; speed = lines["speed"]
subprocess.run([sys.executable, "-I", str(ROOT / "kits/cinema/voice/tts.py"), str(tmp / "mini/script.md"), str(tmp / "mini/vo"), "--voice", voice, "--speed", str(speed), "--lexicon", str(ep / "pron.json")], check=True, capture_output=True)
new, sr = sf.read(tmp / "mini/vo/01.wav"); old, sr0 = sf.read(ep / "vo" / L["file"]); assert sr == sr0
if new.ndim > 1: new = new.mean(1)
if old.ndim > 1: old = old.mean(1)
a, b = int(s0 * sr), int(e0 * sr); d_old = (b - a) / sr; d_new = len(new) / sr
f = d_new / d_old
if abs(f - 1) > 0.02:
    sf.write(tmp / "new.wav", new, sr); fl = []; ff = f
    while ff > 2.0: fl.append("atempo=2.0"); ff /= 2.0
    while ff < 0.5: fl.append("atempo=0.5"); ff /= 0.5
    fl.append(f"atempo={ff:.5f}"); subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(tmp / "new.wav"), "-af", ",".join(fl), str(tmp / "new2.wav")], check=True); new, _ = sf.read(tmp / "new2.wav")
    if new.ndim > 1: new = new.mean(1)
# the new sentence fills the old one's slot (trim or pad to the slot), at the old sentence's loudness
seg = old[a:b]; rms_old = np.sqrt(np.mean(seg ** 2) + 1e-12); rms_new = np.sqrt(np.mean(new ** 2) + 1e-12); new = new * (rms_old / rms_new)
if len(new) > b - a: new = new[:b - a]
else: new = np.pad(new, (0, (b - a) - len(new)))
x = int(0.012 * sr); ramp = np.linspace(0, 1, x)
out = old.copy(); out[a:b] = new; out[a:a + x] = old[a:a + x] * (1 - ramp) + new[:x] * ramp; out[b - x:b] = new[-x:] * (1 - ramp) + old[b - x:b] * ramp
d = tmp / "ep"; (d / "vo").mkdir(parents=True)
for fl_ in (ep / "vo").glob("*.wav"): (d / "vo" / fl_.name).symlink_to(fl_)
(d / "vo" / L["file"]).unlink(); sf.write(d / "vo" / L["file"], out, sr)
shutil.copy(ep / "sheet.json", d / "sheet.json")
subprocess.run(["python3", "-I", str(ROOT / "kits/cinema/studio/render.py"), "sheet.json", "build/audio", "--root", "."], cwd=d, check=True)
mix = d / "build/audio/mix.wav"; yt = ep / "out" / f"reality-rulebook-s3p{part}-9x16-youtube.mp4"; new_yt = tmp / "yt.mp4"
subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(yt), "-i", str(mix), "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "320k", "-shortest", str(new_yt)], check=True)
shutil.copy(new_yt, yt)
meta = {"line": L["id"], "was": " ".join(w["w"] for w in W[jx:ix + 1]), "now": text_new, "slot_s": [round(s0, 3), round(e0, 3)], "stretch": round(f, 3)}
(ep / "out" / "youtube-cta.json").write_text(json.dumps(meta, indent=1)); print(json.dumps(meta))
shutil.rmtree(tmp, ignore_errors=True)
