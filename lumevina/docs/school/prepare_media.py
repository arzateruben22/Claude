"""Turn a Midjourney (or any) skin clip into the Skin School opening's footage.

Run:  python3 docs/school/prepare_media.py path/to/clip.mp4 [--fade 1.0] [--width 1920]

Writes, into the site's media/ folder (next to school.html):
  skin-top.webm   VP9, for Chrome, Firefox and Android
  skin-top.mp4    H.264, for Safari and iPhones
  skin-top.jpg    a still (the fallback, and what shows with reduced motion)

The clip is muted, scaled down to --width if it's larger (never up), and made
to loop seamlessly: its last --fade seconds crossfade into its start, so the
light keeps gliding with no jump. Needs ffmpeg (system, or `pip install
imageio-ffmpeg`).
"""
import argparse, json, os, shutil, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.normpath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(SITE, "media")


def ffmpeg():
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        sys.exit("ffmpeg not found: install it, or run `pip install imageio-ffmpeg`")


def duration(ff, path):
    # ffmpeg prints the duration while probing; read it from there (no ffprobe needed)
    r = subprocess.run([ff, "-i", path], capture_output=True, text=True)
    for line in r.stderr.splitlines():
        line = line.strip()
        if line.startswith("Duration:"):
            h, m, s = line.split(",")[0].split()[1].split(":")
            return int(h) * 3600 + int(m) * 60 + float(s)
    sys.exit("couldn't read the clip's length")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("clip")
    ap.add_argument("--fade", type=float, default=1.0, help="seconds of crossfade at the loop point")
    ap.add_argument("--width", type=int, default=1920, help="largest width to keep")
    ap.add_argument("--out", default=OUT)
    a = ap.parse_args()
    ff = ffmpeg()
    d = duration(ff, a.clip)
    fade = max(0.3, min(a.fade, d / 4))
    os.makedirs(a.out, exist_ok=True)
    scale = "scale='min(%d,iw)':-2:flags=lanczos" % a.width
    # body = the clip after its first `fade` seconds; head = its first `fade` seconds.
    # Crossfading the body's end into the head means the last frame leads straight into the first.
    graph = ("[0:v]%s,fps=30,format=yuv420p,split=2[a][b];"
             "[a]trim=%.3f:%.3f,setpts=PTS-STARTPTS,fps=30[body];"
             "[b]trim=0:%.3f,setpts=PTS-STARTPTS,fps=30[head];"
             "[body][head]xfade=transition=fade:duration=%.3f:offset=%.3f,format=yuv420p[v]") % (
        scale, fade, d, fade, fade, d - 2 * fade)
    base = os.path.join(a.out, "skin-top")
    common = [ff, "-y", "-loglevel", "error", "-i", a.clip, "-filter_complex", graph, "-map", "[v]", "-an"]
    subprocess.run(common + ["-c:v", "libx264", "-preset", "slow", "-crf", "25", "-maxrate", "6M", "-bufsize", "12M",
                             "-pix_fmt", "yuv420p", "-movflags", "+faststart", base + ".mp4"], check=True)
    subprocess.run(common + ["-c:v", "libvpx-vp9", "-b:v", "5M", "-crf", "37", "-row-mt", "1", "-pix_fmt", "yuv420p", base + ".webm"], check=True)
    subprocess.run([ff, "-y", "-loglevel", "error", "-ss", "%.2f" % min(1.0, d / 3), "-i", a.clip, "-frames:v", "1",
                    "-vf", scale, "-q:v", "3", base + ".jpg"], check=True)
    sizes = {os.path.basename(p): "%.1f MB" % (os.path.getsize(p) / 1e6) for p in (base + ".mp4", base + ".webm", base + ".jpg")}
    print(json.dumps({"loop seconds": round(d - fade, 2), "files": sizes}, indent=2))


if __name__ == "__main__":
    main()
