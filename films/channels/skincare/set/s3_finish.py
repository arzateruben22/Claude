"""Season 3 v2 finishing: join chunks (from one or two render builds), mux the mix, encode.
  python3 set/s3_finish.py ep16 --follow ep16v2:0-3,ep16v2b:4-7        # 1080x1920 CRF 17 from the 1440 master (the TikTok/Reels/Shorts file), plus a capped git preview
  python3 set/s3_finish.py ep16 --youtube ep16v2:0-6,ep16v2y:7-7       # 1440x2560 CRF 16 (the YouTube file, 'subscribe' take)
Each source is <folder>:<first>-<last> chunk indexes (chunks of 10 s of film) found in <folder>/build/final-plain-1440/9x16/chunks/. Outputs in <ep>v2/out/. Files over 100 MB are also split
(-b 90m) with SHA256SUMS into $MASTERS/<same path>/ (the claude/skincare-s3-masters branch worktree); git keeps the capped preview."""
import hashlib, subprocess, sys, os
from pathlib import Path
R = Path(__file__).resolve().parent.parent; ep = sys.argv[1]; mode = sys.argv[2].lstrip("-"); spec = sys.argv[3]; n = ep[2:].zfill(3)
out = R / f"{ep}v2/out"; out.mkdir(parents=True, exist_ok=True); work = R / f"{ep}v2/work"; work.mkdir(exist_ok=True)
def sh(*a): subprocess.run([str(x) for x in a], check=True)
lst = []
for part in spec.split(","):
    d, rng = part.split(":"); a, b = (int(v) for v in rng.split("-"))
    for k in range(a, b + 1):
        f = R / d / "build/final-plain-1440/9x16/chunks" / f"{k:03d}.mp4"; assert f.exists(), f; lst.append(f)
(work / "list.txt").write_text("".join(f"file '{f}'\n" for f in lst))
sh("ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", work / "list.txt", "-c", "copy", work / f"video-{mode}.mp4")
DUR = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(work / f"video-{mode}.mp4")], capture_output=True, text=True).stdout.strip()   # the picture sets the length (no -shortest)
mix = R / f"{ep}v2" / ("mix-yt.m4a" if mode == "youtube" else "mix.m4a")
if mode == "youtube":
    name = out / f"skin-sense-{n}-9x16-youtube-1440.mp4"
    sh("ffmpeg", "-y", "-loglevel", "error", "-i", work / f"video-{mode}.mp4", "-i", mix, "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-crf", "16", "-preset", "slow", "-pix_fmt", "yuv420p", "-c:a", "copy", "-t", DUR, "-movflags", "+faststart", name)
else:
    name = out / f"skin-sense-{n}-9x16-1080.mp4"
    sh("ffmpeg", "-y", "-loglevel", "error", "-i", work / f"video-{mode}.mp4", "-i", mix, "-map", "0:v", "-map", "1:a", "-vf", "scale=1080:1920:flags=lanczos", "-c:v", "libx264", "-crf", "17", "-preset", "slow", "-pix_fmt", "yuv420p", "-c:a", "copy", "-t", DUR, "-movflags", "+faststart", name)
    prev = out / f"skin-sense-{n}-9x16-1080-preview.mp4"                       # what git keeps: the same picture capped at about 5 Mbps
    sh("ffmpeg", "-y", "-loglevel", "error", "-i", name, "-c:v", "libx264", "-b:v", "5M", "-maxrate", "6M", "-bufsize", "12M", "-preset", "slow", "-c:a", "copy", "-movflags", "+faststart", prev)
size = name.stat().st_size; print(name.name, round(size / 1e6, 1), "MB")
if size > 100e6:
    md = Path(os.environ.get("MASTERS", "/home/user/masters")) / f"films/channels/skincare/{ep}v2/out"; md.mkdir(parents=True, exist_ok=True)
    [f.unlink() for f in md.glob(name.name + ".part*")]
    sh("split", "-b", "90m", "-d", "-a", "2", name, md / (name.name + ".part"))
    sums = [f"{hashlib.sha256(name.read_bytes()).hexdigest()}  {name.name}"]; (md / f"{name.name}.SHA256").write_text("\n".join(sums) + "\n"); print("split into", len(list(md.glob(name.name + ".part*"))), "parts in", md)
