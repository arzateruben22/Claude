"""Add the like/follow moment to a finished Season 2 short WITHOUT re-rendering its picture.

  python3 -I films/channels/whatif/cta/remix.py ep07 L4     # lines: L3 or L4 (see script.md)

The end card's last frame is held a little longer when the tail after the spoken tease is too short for the line
(the picture is otherwise untouched), the master's sound is ducked 7 dB from the end of the tease, and the
narrator's line (AI voice for now) plays over the end card. The 1080 master says "follow"; the -youtube file says
"subscribe". The captions file gets the line as one more cue. Run youtube1440.py-style upscale for the YouTube file.
"""
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
CH = HERE.parent
ep, L = sys.argv[1], sys.argv[2]
d = CH / ep
film = json.loads((d / "film.json").read_text())
out = d / "out"
master = next(p for p in out.glob("*-9x16.mp4"))
stem = master.name[:-4]
orig = out / ".orig"
orig.mkdir(exist_ok=True)
if not (orig / master.name).exists():
    (orig / master.name).write_bytes(master.read_bytes())
src = orig / master.name
lines = json.loads((HERE / "vo" / "lines.json").read_text())["lines"]
wav = {l["id"]: HERE / "vo" / l["file"] for l in lines}
dur_of = {l["id"]: l["dur"] for l in lines}
ids = {"L3": ("vo01", "vo02"), "L4": ("vo03", "vo04")}[L]
v = film["voice"][-1]
tease_end = v["t"] + v["dur"]
GAP, PAD = 0.10, 0.20
total = film["dur"]
need = max(tease_end + GAP + max(dur_of[i] for i in ids) + PAD, total)
ext = round(need - total, 3)
assert need <= 75.0, f"{ep}: {need:.2f} s would pass 1:15"
sh = lambda *a: subprocess.run(a, check=True, capture_output=True, text=True)
tmp = out / ".tmp"
tmp.mkdir(exist_ok=True)
# picture: hold the last frame ext seconds (re-encoded alike: x264 slow, CRF 12)
new_v = tmp / "v.mp4"
sh("ffmpeg", "-v", "error", "-y", "-i", str(src), "-an", "-vf", f"tpad=stop_mode=clone:stop_duration={ext}" if ext > 0 else "null",
   "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-maxrate", "2600k", "-bufsize", "5200k", "-x264-params", "aq-mode=3:deblock=-1,-1", "-pix_fmt", "yuv420p", "-profile:v", "high", "-r", "30",
   "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-color_range", "tv", str(new_v))
t0 = round(tease_end + GAP, 3)
def audio(line_id, name):
    cta = tmp / f"{name}-cta.wav"
    sh("ffmpeg", "-v", "error", "-y", "-i", str(wav[line_id]), "-af", "loudnorm=I=-14:TP=-2:LRA=7,aresample=48000", "-ac", "2", str(cta))
    o = tmp / f"{name}.m4a"
    dt = tease_end
    fc = (f"[0:a]aformat=sample_rates=48000:channel_layouts=stereo,apad=whole_dur={need},atrim=0:{need},"
          f"volume='if(lt(t,{dt}),1,if(lt(t,{dt + 0.25}),1-(t-{dt})/0.25*0.55,0.45))':eval=frame[m];"
          f"[1:a]adelay={int(t0 * 1000)}|{int(t0 * 1000)},apad=whole_dur={need},atrim=0:{need}[c];"
          f"[m][c]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.84:level=false[a]")
    sh("ffmpeg", "-v", "error", "-y", "-i", str(src), "-i", str(cta), "-filter_complex", fc, "-map", "[a]", "-c:a", "aac", "-b:a", "320k", "-ar", "48000", "-ac", "2", str(o))
    return o
a_follow, a_sub = audio(ids[0], "follow"), audio(ids[1], "sub")
sh("ffmpeg", "-v", "error", "-y", "-i", str(new_v), "-i", str(a_follow), "-map", "0:v", "-map", "1:a", "-c", "copy", "-movflags", "+faststart", str(master))
# YouTube: the upscale of the new master with the "subscribe" sound
yt = out / f"{stem}-youtube.mp4"
sh("python3", "-I", str(HERE.parents[3] / "kits/cinema/film/youtube1440.py"), str(d), "--force")
y2 = tmp / "yt.mp4"
sh("ffmpeg", "-v", "error", "-y", "-i", str(yt), "-i", str(a_sub), "-map", "0:v", "-map", "1:a", "-c", "copy", "-movflags", "+faststart", str(y2))
y2.replace(yt)
# captions: the line as one more cue
srt = out / f"{stem}.srt"
if srt.exists():
    txt = srt.read_text().rstrip("\n")
    n = max(int(x) for x in txt.split("\n") if x.strip().isdigit()) + 1
    ts = lambda s: f"{int(s // 3600):02d}:{int(s % 3600 // 60):02d}:{int(s % 60):02d},{int(round((s % 1) * 1000)):03d}"
    text = {"L3": "If your brain's doing the math with me, tap like and follow.", "L4": "Real quick: like and follow. The next what-if is even stranger."}[L]
    if text not in txt:
        srt.write_text(txt + f"\n\n{n}\n{ts(t0)} --> {ts(t0 + dur_of[ids[0]])}\n{text}\n")
print(f"{ep}: {L} at {t0:.2f} s, picture held {ext:.2f} s, length {need:.2f} s")
