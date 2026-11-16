"""Post for a v3 part: sound bed + sfx, ladder counter overlay, mux, 1440 file, guide clip (stand-in voice + teleprompter strip), windows.json.
  python3 -I post.py N video_noaudio.mp4        (run with the voice venv python: needs soundfile)"""
import json, math, subprocess, sys
from pathlib import Path
import numpy as np, soundfile as sf
from PIL import Image, ImageDraw, ImageFont
HERE = Path(__file__).resolve().parent; CH = HERE.parents[1]
sys.path.insert(0, str(HERE)); from spec import CUES, lin  # noqa
N = int(sys.argv[1]); VID = Path(sys.argv[2]); D = CH / f"ep{12 + N}v3"; OUT = D / "out"; OUT.mkdir(exist_ok=True); WK = HERE / "work" / f"p{N}"
f = json.loads((D / "film.json").read_text()); win = json.loads((D / "windows.json").read_text()); END = win["end"]; SR = 48000
S = lambda k: win["lines"][k - 1]["t0"]; E = lambda k: win["lines"][k - 1]["t1"]
# 1. sound: sfx stem + a soft room-tone bed
cues = CUES[N](f, win, S, E, END); (D / "sfx.json").write_text(json.dumps({"palette": "kitchen", "cues": [dict(c, seed=300 + i) for i, c in enumerate(cues)]}, indent=1))
subprocess.run([sys.executable, "-I", str(HERE / "tools/sfx.py"), str(D / "film.json"), str(D / "sfx.json"), str(WK / "stem.wav")], check=True, capture_output=True)
stem, sr = sf.read(WK / "stem.wav"); assert sr == SR
n = int(END * SR); rng = np.random.default_rng(5)
def lp(x, hz):
    X = np.fft.rfft(x); fr = np.fft.rfftfreq(len(x), 1 / SR); X *= 1 / (1 + (fr / hz) ** 2); return np.fft.irfft(X, len(x))
room = lp(rng.standard_normal(n), 900) * 0.5 + lp(rng.standard_normal(n), 120) * 1.2
room = room / np.abs(room).max() * 10 ** (-38 / 20); t = np.arange(n) / SR
room += 0.0025 * np.sin(2 * np.pi * 118 * t) * 0.3
bed = np.stack([room, np.roll(room, 240)], 1)
if len(stem) < n: stem = np.pad(stem, ((0, n - len(stem)), (0, 0)))
mix = bed + stem[:n]
fi = int(0.4 * SR); mix[:fi] *= np.linspace(0, 1, fi)[:, None]; fo = int(1.2 * SR); mix[-fo:] *= np.linspace(1, 0, fo)[:, None]
sf.write(WK / "mix_raw.wav", mix, SR)
# loudness: -19 LUFS integrated (a bed under the owner's voice), peak <= -1.5 dBTP
subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(WK / "mix_raw.wav"), "-af", "loudnorm=I=-19:TP=-2.0:LRA=9", "-ar", "48000", str(WK / "mix.wav")], check=True)
# 2. ladder counter overlay (the owner's Part 1-3 look)
FB = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"; FR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
def counter_png(num, l1, l2, p):
    im = Image.new("RGBA", (1080, 1920), (0, 0, 0, 0)); d = ImageDraw.Draw(im); x = 700
    d.text((x, 378), num, font=ImageFont.truetype(FB, min(78, int(370 / (0.64 * len(num))))), fill=(18, 28, 40, 255), anchor="ls", stroke_width=3, stroke_fill=(255, 255, 255, 170))
    d.rectangle((x, 404, x + 64, 408), fill=(47, 85, 255, 255)); ff = ImageFont.truetype(FR, 26)
    d.text((x, 446), l1, font=ff, fill=(24, 36, 52, 255), anchor="ls", stroke_width=2, stroke_fill=(255, 255, 255, 190))
    d.text((x, 486), l2, font=ff, fill=(24, 36, 52, 255), anchor="ls", stroke_width=2, stroke_fill=(255, 255, 255, 190)); im.save(p)
lad = f["_ladder"]; ins, flt, last = [], [], "[0:v]"
for k, (num, l1, l2, a, b) in enumerate(lad):
    p = WK / f"ctr{k}.png"; counter_png(num, l1, l2, p); ins += ["-i", str(p)]
    flt.append(f"{last}[{k+1}:v]overlay=enable='between(t,{a},{b})'[v{k}]"); last = f"[v{k}]"
noaud = WK / "with_counter.mp4"
subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(VID)] + ins + ["-filter_complex", ";".join(flt), "-map", last, "-c:v", "libx264", "-preset", "slow", "-crf", "14", "-pix_fmt", "yuv420p", "-r", "30", str(noaud)], check=True)
name = f"reality-rulebook-s3p{N}"
final = OUT / f"{name}-9x16.mp4"
subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(noaud), "-i", str(WK / "mix.wav"), "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-t", str(END), "-movflags", "+faststart", str(final)], check=True)
subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(final), "-vf", "scale=1440:2560:flags=lanczos+accurate_rnd+full_chroma_int", "-c:v", "libx264", "-preset", "slow", "-crf", "15", "-maxrate", "30000k", "-bufsize", "60000k", "-pix_fmt", "yuv420p", "-c:a", "copy", "-movflags", "+faststart", str(OUT / f"{name}-9x16-youtube.mp4")], check=True)
# 3. the guide clip: the picture, the stand-in voice at each window (a placeholder: never the owner's voice), and a teleprompter strip
ln = win["lines"]
for k, w in enumerate(ln):
    im = Image.new("RGBA", (1080, 1920), (0, 0, 0, 0)); d = ImageDraw.Draw(im); d.rounded_rectangle((40, 1440, 1040, 1800), 30, fill=(10, 14, 22, 215))
    d.text((70, 1478), f"LINE {k+1} of {len(ln)}   •   {w['t0']:.1f}-{w['t1']:.1f} s   •   STAND-IN VOICE, TIMING ONLY", font=ImageFont.truetype(FB, 24), fill=(255, 214, 90, 255), anchor="ls")
    words = w["text"].split(); rows, cur = [], ""
    for wd in words:
        if len(cur) + len(wd) > 30: rows.append(cur); cur = wd
        else: cur = (cur + " " + wd).strip()
    rows.append(cur)
    for r, row in enumerate(rows[:4]): d.text((70, 1545 + r * 52), row, font=ImageFont.truetype(FB, 44), fill=(255, 255, 255, 255), anchor="ls")
    if k + 1 < len(ln): d.text((70, 1770), "next: " + ln[k + 1]["text"][:48], font=ImageFont.truetype(FR, 26), fill=(160, 175, 200, 255), anchor="ls")
    im.save(WK / f"tp{k}.png")
ins2, flt2, last = [], [], "[0:v]"
for k, w in enumerate(ln):
    ins2 += ["-i", str(WK / f"tp{k}.png")]; a = max(0, w["t0"] - 0.5) if k else 0.0; b = (ln[k + 1]["t0"] - 0.5) if k + 1 < len(ln) else END
    flt2.append(f"{last}[{k+1}:v]overlay=enable='between(t,{a},{b})'[g{k}]"); last = f"[g{k}]"
vo_in, vo_f = [], []
for k, w in enumerate(ln):
    vo_in += ["-i", str(WK / f"vo/{k+1:02d}.wav")]; vo_f.append(f"[{len(ln)+1+k}:a]adelay={int(w['t0']*1000)}|{int(w['t0']*1000)}[a{k}]")
amix = "".join(f"[a{k}]" for k in range(len(ln))) + f"amix=inputs={len(ln)}:normalize=0[sv]"
subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(noaud)] + ins2 + vo_in + ["-filter_complex", ";".join(flt2 + vo_f + [amix]), "-map", last, "-map", "[sv]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-t", str(END), str(OUT / f"{name}-guide.mp4")], check=True)
print("done", final)
