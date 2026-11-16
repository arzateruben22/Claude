"""Builds the recording guide: the finished picture + the scratch voice (+ music and sfx) + a teleprompter strip at the bottom (line number, the line, its window).
  python3 -I films/channels/whatif/longform/gravity-doubles/part1_guide.py <picture.mp4> <out guide.mp4>"""
import json, subprocess, sys, textwrap
from pathlib import Path
HERE = Path(__file__).resolve().parent; D = HERE / "part1v2"; D1 = HERE / "part1"
pic, out = Path(sys.argv[1]), Path(sys.argv[2])
Wn = json.loads((D1 / "windows.json").read_text()); n = len(Wn["lines"]); tmp = D / "build/guide-txt"; tmp.mkdir(parents=True, exist_ok=True)
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"; FONTR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
vf = ["drawbox=x=0:y=ih-330:w=iw:h=330:color=black@0.78:t=fill"]
for i, l in enumerate(Wn["lines"], 1):
    head = tmp / f"h{i:02d}.txt"; body = tmp / f"b{i:02d}.txt"
    head.write_text(f"LINE {i} OF {n}   ·   speak within {l['speak_window']:.1f} s   (window {l['window']:.1f} s)")
    body.write_text("\n".join(textwrap.wrap(l["text"], 32)))
    en = f"between(t\\,{l['t0']}\\,{l['t1']})"
    vf.append(f"drawtext=fontfile={FONTR}:textfile={head}:fontcolor=0xEB63FF:fontsize=34:x=(w-text_w)/2:y=h-312:enable='{en}'")
    vf.append(f"drawtext=fontfile={FONT}:textfile={body}:fontcolor=white:fontsize=50:line_spacing=8:x=(w-text_w)/2:y=h-262:enable='{en}'")
# the cue "speak now" bar: a thin bar that fills across the speaking window, so the owner sees when to start and the limit
for i, l in enumerate(Wn["lines"], 1):
    a, b = l["speech_t0"], l["speech_t0"] + l["speak_window"]
    vf.append(f"drawbox=x=60:y=ih-24:w='(iw-120)*clip((t-{a})/{b - a:.3f}\\,0\\,1)':h=10:color=0xEB63FF@0.95:t=fill:enable='between(t\\,{l['t0']}\\,{l['t1']})'")
vf.append(f"drawbox=x=60:y=ih-24:w=iw-120:h=10:color=white@0.18:t=fill")
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(pic), "-i", str(D / "audio/guide-mix.m4a"), "-vf", ",".join(vf), "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-crf", "20", "-preset", "medium", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-shortest", str(out)], check=True)
print("guide", out, round(out.stat().st_size / 1e6, 1), "MB")
