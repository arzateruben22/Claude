#!/usr/bin/env python3
"""Render a Vice Unfiltered clip from a job file, then QC it.

Usage (from the vice-unfiltered folder):
    python3 -I tools/render_clip.py work/<job>.json

Job schema (paths relative to vice-unfiltered/; a bare SFX filename resolves to
assets/CORE_2026-11-22/SFX/MP3/<name>; image paths may be relative to
assets/CORE_2026-11-22/):
{
 "streamer": "KreekCraft", "slug": "kreekcraft", "clip_no": 1, "moment": "Nightclub", "version": 1,
 "source": "sources/KreekCraft/x.mp4",
 "segments": [{"in": 12.3, "out": 20.1}],          # source cuts; concatenated = BASE timeline
 "layout": {"mode": "fit"}  |  {"mode": "split", "facecam": [x,y,w,h], "gameplay": [x,y,w,h], "face_h": 640}
           |  {"mode": "crop", "rect": [x,y,w,h], "y": 0.5}   # rect fit to 1080 wide, centred at y (fraction of 1920),
                                                             # over a blurred fill of the SAME rect (nothing outside leaks in)
 "fps": 30,
 "events": [                                       # at/from/to are BASE times (before insertions)
   {"type": "insert_image", "file": "IMAGES/Reaction_Inserts/bro.jpg", "at": 7.0, "dur": 1.5,
    "sfx": "CapCut_Explosion_Sound.mp3", "sfx_gain_db": -6},
   {"type": "static", "at": 10.0, "dur": 0.4},     # synthesized static = SUBSTITUTE, not the Myinstants sample
   {"type": "freeze", "at": 12.0, "dur": 3.0, "bw": true,
    "rose": "IMAGES/Reaction_Inserts/original_apple_rose_transparent.png", "rose_width": 300,
    "caption": "this sht aint tuff gng", "sfx": "Sad_Violin_Meme.mp3", "sfx_gain_db": 0, "extend_to_sfx": false},
   {"type": "sfx", "file": "Undertaker_Bell.mp3", "at": 3.2, "gain_db": -3, "duck_db": -8, "len": 4.2},
   {"type": "caption", "text": "HE WALKED UP?!", "from": 0.0, "to": 2.0, "y": 0.38, "size": 110, "font": "anton"},
   {"type": "zoom", "from": 15.0, "to": 17.0, "scale": 1.15, "center": [0.5, 0.3]}
 ],
 "overlay": {"file": "IMAGES/Brand/KreekCraft Overlay.png", "y": 0.30, "width": 700}
}
Caption/overlay "y" = vertical CENTRE as a fraction of 1920. Insertions (insert_image,
static, freeze) add time at their base point; everything after shifts later.
"""
import csv
import json
import math
import os
import re
import shutil
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CORE = os.path.join(ROOT, "assets", "CORE_2026-11-22")
SFX_DIR = os.path.join(CORE, "SFX", "MP3")
FONTS = {
    "anton": os.path.join(ROOT, "assets/fonts/anton-latin-400-normal.woff"),
    "oswald": os.path.join(ROOT, "assets/fonts/oswald-latin-700-normal.woff"),
    "bebas": os.path.join(ROOT, "assets/fonts/bebas-neue-latin-400-normal.woff"),
}
W, H, SR = 1080, 1920, 48000
INSERTS = ("insert_image", "static", "freeze", "deal_with_it")
SFX_TARGET_LUFS = -14.0


def sh(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        sys.stderr.write(r.stderr[-3000:])
        raise SystemExit(f"command failed: {' '.join(cmd[:8])} ...")
    return r


def ff(*args):
    return sh(["ffmpeg", "-hide_banner", "-v", "error", "-y", *args])


def resolve(path, kind="image"):
    if kind == "sfx" and os.sep not in path and "/" not in path:
        p = os.path.join(SFX_DIR, path)
    else:
        p = path if os.path.isabs(path) else os.path.join(ROOT, path)
        if not os.path.exists(p):
            p = os.path.join(CORE, path)
    if not os.path.isfile(p):
        raise SystemExit(f"missing {kind} asset: {path}")
    return p


def decode_audio(path, start=None, dur=None):
    """Decode to float32 stereo 48 kHz numpy array (n, 2)."""
    cmd = ["ffmpeg", "-hide_banner", "-v", "error"]
    if start is not None:
        cmd += ["-ss", f"{start:.6f}"]
    cmd += ["-i", path]
    if dur is not None:
        cmd += ["-t", f"{dur:.6f}"]
    cmd += ["-vn", "-ac", "2", "-ar", str(SR), "-f", "f32le", "-"]
    r = subprocess.run(cmd, capture_output=True)
    return np.frombuffer(r.stdout, dtype=np.float32).reshape(-1, 2).copy()


def has_audio(path):
    r = sh(["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", path])
    return bool(r.stdout.strip())


def lufs(path_or_array):
    """Integrated loudness via ebur128 (accepts a file or a numpy array)."""
    if isinstance(path_or_array, np.ndarray):
        r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "-",
                            "-af", "ebur128", "-f", "null", "-"], input=path_or_array.astype(np.float32).tobytes(),
                           capture_output=True)
        txt = r.stderr.decode(errors="ignore")
    else:
        txt = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path_or_array, "-af", "ebur128",
                              "-f", "null", "-"], capture_output=True, text=True).stderr
    m = re.findall(r"I:\s+(-?[\d.]+) LUFS", txt)
    return float(m[-1]) if m else None


def onset_seconds(arr, thresh_db=-45.0):
    mono = np.abs(arr).max(axis=1)
    idx = np.argmax(mono > 10 ** (thresh_db / 20)) if (mono > 10 ** (thresh_db / 20)).any() else 0
    return idx / SR


# ---------------------------------------------------------------- graphics
def fit_font(text, font, size, max_w):
    f = ImageFont.truetype(FONTS[font], size)
    d = ImageDraw.Draw(Image.new("RGBA", (10, 10)))
    while size > 20:
        widest = max(d.textlength(line, font=f) for line in text.split("\n"))
        if widest <= max_w:
            break
        size -= 4
        f = ImageFont.truetype(FONTS[font], size)
    return f, size


def draw_caption(canvas, text, y_frac, size=110, font="anton", fill=(255, 255, 255), max_w=960):
    """Flat ink with a clean outline, centred, exact text (\\n = manual line break)."""
    f, size = fit_font(text, font, size, max_w)
    d = ImageDraw.Draw(canvas)
    stroke = max(3, round(size * 0.075))
    bbox = d.multiline_textbbox((0, 0), text, font=f, spacing=int(size * 0.08), align="center", stroke_width=stroke)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (W - tw) / 2 - bbox[0]
    y = y_frac * H - th / 2 - bbox[1]
    d.multiline_text((x, y), text, font=f, fill=fill, spacing=int(size * 0.08), align="center",
                     stroke_width=stroke, stroke_fill=(0, 0, 0))
    return (y + bbox[1], y + bbox[3])


def caption_png(text, y, size, font, out, fill="#FFFFFF"):
    c = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    fill = tuple(int(fill.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4)) if isinstance(fill, str) else tuple(fill)
    draw_caption(c, text, y, size, font, fill=fill)
    c.save(out)


def insert_png(src, out):
    """Supplied image, contain-fit, over a blurred cover-fill of the SAME image (alpha preserved)."""
    im = Image.open(src).convert("RGBA")
    s = max(W / im.width, H / im.height)
    bg = im.convert("RGB").resize((math.ceil(im.width * s), math.ceil(im.height * s)), Image.LANCZOS)
    bg = bg.crop(((bg.width - W) // 2, (bg.height - H) // 2, (bg.width - W) // 2 + W, (bg.height - H) // 2 + H))
    bg = bg.filter(ImageFilter.GaussianBlur(40)).point(lambda v: int(v * 0.6))
    s2 = min(W / im.width, (H * 0.62) / im.height)
    fg = im.resize((round(im.width * s2), round(im.height * s2)), Image.LANCZOS)
    canvas = bg.convert("RGBA")
    canvas.alpha_composite(fg, ((W - fg.width) // 2, (H - fg.height) // 2))
    canvas.convert("RGB").save(out)
    return s2


def overlay_png(spec, out):
    im = Image.open(resolve(spec["file"])).convert("RGBA")
    w = int(spec.get("width", 700))
    im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    c = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    c.alpha_composite(im, ((W - w) // 2, round(spec.get("y", 0.3) * H - im.height / 2)))
    c.save(out)


# ---------------------------------------------------------------- layout
def src_to_canvas(job, src_w, src_h, x, y):
    """Map a source-pixel point to the 1080x1920 canvas produced by layout_filter (crop / fit / 9:16)."""
    lay = job.get("layout", {"mode": "fit"})
    if lay["mode"] == "crop":
        rx, ry, rw, rh = lay["rect"]
        s = W / rw
        yc = int(round(float(lay.get("y", 0.5)) * H))
        h2 = round(rh * s / 2) * 2
        return (x - rx) * s, (y - ry) * s + yc - h2 / 2
    if lay["mode"] == "split":
        fx, fy, fw, fh = lay["facecam"]
        face_h = int(lay.get("face_h", 640))
        s = max(W / fw, face_h / fh)
        return (x - fx) * s - (fw * s - W) / 2, (y - fy) * s - (fh * s - face_h) / 2
    if abs(src_w / src_h - W / H) < 0.01:
        return x * W / src_w, y * H / src_h
    s = min(W / src_w, H / src_h)
    return x * s + (W - src_w * s) / 2, y * s + (H - src_h * s) / 2


def deal_with_it_frames(base_img, e, eyes_canvas, n, fps, outdir):
    """Frozen frame + pixel glasses dropping from above the top edge onto the eyes (ease-out with a small
    settle), then black & white with the glasses kept black. Writes n PNG frames; returns info."""
    (lx, ly), (rx, ry) = eyes_canvas
    g = Image.open(resolve(e.get("glasses", "assets/stickers/deal_with_it_glasses.png"))).convert("RGBA")
    ax, ay, bx, by = e.get("lens_centers", [8 / 32, 4.5 / 7, 24 / 32, 4.5 / 7])  # fractions of the glasses PNG
    d_eye = math.hypot(rx - lx, ry - ly)
    scale = d_eye / ((bx - ax) * g.width) * float(e.get("fit", 1.0))
    gw, gh = max(2, round(g.width * scale)), max(2, round(g.height * scale))
    g = g.resize((gw, gh), Image.NEAREST)                      # nearest-neighbour keeps pixel edges crisp
    ang = math.degrees(math.atan2(ry - ly, rx - lx))
    pivot = ((ax + bx) / 2 * gw, (ay + by) / 2 * gh)           # midpoint between the lens centres
    pad = int(max(gw, gh))
    canvas_g = Image.new("RGBA", (gw + 2 * pad, gh + 2 * pad), (0, 0, 0, 0))
    canvas_g.alpha_composite(g, (pad, pad))
    rot = canvas_g.rotate(-ang, resample=Image.NEAREST, center=(pad + pivot[0], pad + pivot[1]))
    pcx, pcy = pad + pivot[0], pad + pivot[1]                  # pivot location inside rot
    tx, ty = (lx + rx) / 2, (ly + ry) / 2                      # landing point = eye midpoint
    bbox = rot.getchannel("A").getbbox()
    start_y = -(bbox[3] - pcy) - 10                            # whole glasses above the top edge
    drop, c1 = float(e.get("drop", 0.7)), float(e.get("settle", 0.9))
    color = base_img.convert("RGB")
    gray = color.convert("L").convert("RGB")
    for k in range(n):
        t = k / fps
        if t < drop:
            p_ = t / drop
            ease = 1 + (c1 + 1) * (p_ - 1) ** 3 + c1 * (p_ - 1) ** 2   # ease-out-back: tiny overshoot, settles
            y = start_y + (ty - start_y) * ease
            frame = color.copy()
        else:
            y = ty
            frame = (gray if e.get("bw_after", True) else color).copy()
        fr_ = frame.convert("RGBA")
        fr_.alpha_composite(rot, (int(round(tx - pcx)), int(round(y - pcy))))
        fr_.convert("RGB").save(os.path.join(outdir, f"dwi_{k:04d}.png"))
    return {"width": gw, "height": gh, "angle": ang, "eye_dist": d_eye, "land": (tx, ty)}


def layout_filter(job, src_w, src_h):
    lay = job.get("layout", {"mode": "fit"})
    fps = job["fps"]
    if lay["mode"] == "split":
        fx, fy, fw, fh = lay["facecam"]
        gx, gy, gw, gh = lay["gameplay"]
        face_h = int(lay.get("face_h", 640))
        game_h = H - face_h
        return (f"[0:v]fps={fps},split[a][b];"
                f"[a]crop={fw}:{fh}:{fx}:{fy},scale={W}:{face_h}:force_original_aspect_ratio=increase,crop={W}:{face_h}[f];"
                f"[b]crop={gw}:{gh}:{gx}:{gy},scale={W}:{game_h}:force_original_aspect_ratio=increase,crop={W}:{game_h}[g];"
                f"[f][g]vstack,setsar=1")
    if lay["mode"] == "crop":
        x, y, w, h = lay["rect"]
        yc = int(round(float(lay.get("y", 0.5)) * H))
        return (f"[0:v]fps={fps},crop={w}:{h}:{x}:{y},split[a][b];"
                f"[a]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},boxblur=40:3,eq=brightness=-0.14[bg];"
                f"[b]scale={W}:-2:flags=lanczos[fg];"
                f"[bg][fg]overlay=0:{yc}-h/2,setsar=1")
    if abs(src_w / src_h - W / H) < 0.01:
        return f"[0:v]fps={fps},scale={W}:{H},setsar=1"
    return (f"[0:v]fps={fps},split[a][b];"
            f"[a]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},boxblur=30:2,eq=brightness=-0.08[bg];"
            f"[b]scale={W}:{H}:force_original_aspect_ratio=decrease[fg];"
            f"[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1")


def zoom_filter(z, t0):
    """Eased punch-in for a chunk; z on base time, t0 = chunk base start."""
    a, b, S = z["from"] - t0, z["to"] - t0, float(z.get("scale", 1.15))
    cx, cy = z.get("center", [0.5, 0.5])
    if z.get("push"):  # slow linear push-in from 1.0 to S across [from, to], held only until the next cut
        Z = f"(1+{S - 1:.4f}*clip((t-{a:.4f})/{max(0.001, b - a):.4f},0,1))"
    else:
        r = min(0.25, (z["to"] - z["from"]) / 2)
        e = f"clip((t-{a:.4f})/{r:.4f},0,1)*clip(({b:.4f}-t)/{r:.4f},0,1)"
        Z = f"(1+{S - 1:.4f}*({e})*({e})*(3-2*({e})))"
    return (f",scale=w='trunc({W}*{Z}/2)*2':h='trunc({H}*{Z}/2)*2':eval=frame,"
            f"crop={W}:{H}:x='(iw-{W})*{cx}':y='(ih-{H})*{cy}'")


# ---------------------------------------------------------------- main
def main():
    job_path = sys.argv[1]
    job = json.load(open(job_path))
    fps = int(job.get("fps", 30))
    job["fps"] = fps
    name = f'{job["streamer"]}_{int(job["clip_no"]):02d}_{job["moment"]}'
    export = os.path.join(ROOT, "exports", f'{name}_V{int(job["version"])}.mp4')
    if os.path.exists(export):
        raise SystemExit(f"refusing to overwrite existing export: {export}")
    work = os.path.join(ROOT, "work", name, f'V{int(job["version"])}')
    tmp = os.path.join(work, "tmp")
    if os.path.isdir(tmp):
        shutil.rmtree(tmp)
    os.makedirs(tmp, exist_ok=True)
    src = resolve(job["source"], "source")
    probe = json.loads(sh(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                           "stream=width,height", "-of", "json", src]).stdout)["streams"][0]
    src_audio = has_audio(src)
    notes = [f"Job: {os.path.relpath(job_path, ROOT)}", f"Source: {os.path.relpath(src, ROOT)} "
             f"({probe['width']}x{probe['height']}, audio={'yes' if src_audio else 'NO'})"]

    # --- base timeline on the frame grid
    segs, B = [], 0
    for s in job["segments"]:
        n = round((s["out"] - s["in"]) * fps)
        segs.append({"in": s["in"], "B": B, "N": n})
        B += n
    base_frames = B
    fr = lambda t: round(t * fps)  # noqa: E731

    events = job.get("events", [])
    inserts = sorted([e for e in events if e["type"] in INSERTS], key=lambda e: e["at"])
    sfx_cache = {}

    def load_sfx(fname):
        if fname not in sfx_cache:
            p = resolve(fname, "sfx")
            arr = decode_audio(p)
            on = onset_seconds(arr)
            L = lufs(p)
            sfx_cache[fname] = (p, arr, on, L)
        return sfx_cache[fname]

    for e in inserts:
        e["f"] = fr(e["at"])
        if not 0 <= e["f"] <= base_frames:
            raise SystemExit(f'{e["type"]} at {e["at"]}s is outside the base timeline ({base_frames / fps:.3f}s)')
        if e["type"] == "deal_with_it" and "dur" not in e:
            e["dur"] = float(e.get("drop", 0.7)) + float(e.get("hold", 0.8))
        if e["type"] == "freeze" and e.get("extend_to_sfx") and e.get("sfx"):
            _, arr, on, _ = load_sfx(e["sfx"])
            e["dur"] = len(arr) / SR - on
        e["n"] = round(e["dur"] * fps)

    def out_frame(f):  # base frame -> output frame (an insert at f plays before base frame f)
        return f + sum(i["n"] for i in inserts if i["f"] <= f)

    # --- cut points: segment starts + insert points
    cuts = sorted({0, base_frames, *[s["B"] for s in segs], *[i["f"] for i in inserts]})
    pieces = []  # ordered output pieces
    ins_by_f = {}
    for i in inserts:
        ins_by_f.setdefault(i["f"], []).append(i)
    for a, b in zip(cuts, cuts[1:] + [None]):
        for i in ins_by_f.get(a, []):
            pieces.append({"kind": i["type"], "ev": i, "n": i["n"], "base_f": a})
        if b is not None and b > a:
            pieces.append({"kind": "base", "f0": a, "f1": b, "n": b - a})

    def seg_of(f):
        for s in reversed(segs):
            if f >= s["B"]:
                return s
        return segs[0]

    def src_time(f):
        s = seg_of(min(f, base_frames - 1))
        return s["in"] + (f - s["B"]) / fps

    lay = layout_filter(job, probe["width"], probe["height"])
    captions = [e for e in events if e["type"] == "caption"]
    zooms = [e for e in events if e["type"] == "zoom"]
    stickers = [e for e in events if e["type"] == "sticker"]  # timed image pops over base footage
    for k, st in enumerate(stickers):
        st["png"] = os.path.join(tmp, f"sticker_{k}.png")
        im = Image.open(resolve(st["file"])).convert("RGBA")
        sz = int(st.get("size", 240))
        im.resize((sz, round(im.height * sz / im.width)), Image.LANCZOS).save(st["png"])
    for k, c in enumerate(captions):
        c["png"] = os.path.join(tmp, f"caption_{k}.png")
        caption_png(c["text"], c.get("y", 0.38), c.get("size", 110), c.get("font", "anton"), c["png"], c.get("fill", "#FFFFFF"))

    vlist, edl = [], []
    venc = ["-c:v", "libx264", "-crf", "8", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-r", str(fps),
            "-video_track_timescale", str(fps * 512), "-an"]
    out_f = 0
    for k, p in enumerate(pieces):
        path = os.path.join(tmp, f"piece_{k:03d}.mp4")
        n = p["n"]
        if p["kind"] == "base":
            t0, t1 = p["f0"] / fps, p["f1"] / fps
            chain = lay
            for z in zooms:
                if z["from"] < t1 and z["to"] > t0:
                    chain += zoom_filter(z, t0)
            chain += ",tpad=stop_mode=clone:stop_duration=2[v0]"
            inputs, last = ["-ss", f"{src_time(p['f0']):.6f}", "-i", src], "v0"
            for j, c in enumerate([c for c in captions if c["from"] < t1 and c["to"] > t0]):
                inputs += ["-loop", "1", "-framerate", str(fps), "-i", c["png"]]
                a_, b_ = max(0, c["from"] - t0), min(t1, c["to"]) - t0
                chain += f";[{last}][{j + 1}:v]overlay=0:0:enable='between(t,{a_:.4f},{b_:.4f})'[v{j + 1}]"
                last = f"v{j + 1}"
            n_in = sum(1 for x in inputs if x == "-i") - 1  # inputs so far after the source
            for q, st in enumerate([st for st in stickers if st["from"] < t1 and st["to"] > t0]):
                idx = n_in + 1 + q
                inputs += ["-loop", "1", "-framerate", str(fps), "-i", st["png"]]
                a_, b_ = max(0, st["from"] - t0), min(t1, st["to"]) - t0
                X, Y = float(st.get("x", 0.5)) * W, float(st.get("y", 0.4)) * H
                if st.get("pop", True) and st["from"] >= t0:  # scale-in pop with a small overshoot over ~0.18 s
                    pe = f"clip((t-{a_:.4f})/0.18,0,1)"
                    K = f"if(lt({pe},0.6),0.55+0.6*{pe}/0.6,1.15-0.15*({pe}-0.6)/0.4)"
                    chain += (f";[{idx}:v]format=rgba,scale=w='max(2,trunc(iw*{K}/2)*2)':h=-1:eval=frame[s{q}]"
                              f";[{last}][s{q}]overlay=x='{X:.1f}-w/2':y='{Y:.1f}-h/2':eval=frame:"
                              f"enable='between(t,{a_:.4f},{b_:.4f})'[t{q}]")
                else:
                    chain += (f";[{idx}:v]format=rgba[s{q}];[{last}][s{q}]overlay=x='{X:.1f}-w/2':y='{Y:.1f}-h/2':"
                              f"enable='between(t,{a_:.4f},{b_:.4f})'[t{q}]")
                last = f"t{q}"
            ff(*inputs, "-filter_complex", chain, "-map", f"[{last}]", "-frames:v", str(n), *venc, path)
            edl.append(["base", f"{t0:.3f}", f"{t1:.3f}", f"{out_f / fps:.3f}", f"{(out_f + n) / fps:.3f}",
                        f"source {src_time(p['f0']):.3f}-{src_time(p['f0']) + n / fps:.3f}s"])
        elif p["kind"] == "insert_image":
            e = p["ev"]
            img = resolve(e["file"])
            png = os.path.join(tmp, f"insert_{k}.png")
            scale = insert_png(img, png)
            ff("-loop", "1", "-framerate", str(fps), "-i", png, "-frames:v", str(n), "-vf", "format=yuv420p,setsar=1",
               *venc, path)
            edl.append(["insert_image", f'{e["at"]:.3f}', f'{e["at"]:.3f}', f"{out_f / fps:.3f}",
                        f"{(out_f + n) / fps:.3f}", os.path.relpath(img, CORE)])
            notes.append(f'Insert {os.path.relpath(img, CORE)} at output {out_f / fps:.3f}s for {n / fps:.3f}s '
                         f'(supplied file, contain-fit x{scale:.2f} over blurred fill of itself)')
        elif p["kind"] == "static":
            ff("-f", "lavfi", "-i", f"color=c=gray:s={W}x{H}:r={fps}", "-frames:v", str(n), "-vf",
               "noise=alls=100:allf=t+u,hue=s=0,eq=contrast=1.4,format=yuv420p,setsar=1", *venc, path)
            edl.append(["static", f'{p["ev"]["at"]:.3f}', f'{p["ev"]["at"]:.3f}', f"{out_f / fps:.3f}",
                        f"{(out_f + n) / fps:.3f}", "SYNTHESIZED static (substitute)"])
            notes.append(f"TV static at output {out_f / fps:.3f}s for {n / fps:.3f}s: SYNTHESIZED SUBSTITUTE video+audio, "
                         "not the Myinstants sample")
        elif p["kind"] == "freeze":
            e = p["ev"]
            ff_ = p["base_f"] if p["base_f"] < base_frames else base_frames - 1
            frame = os.path.join(tmp, f"freeze_src_{k}.png")
            ff("-ss", f"{src_time(ff_):.6f}", "-i", src, "-filter_complex", lay + "[v]", "-map", "[v]",
               "-frames:v", "1", frame)
            im = Image.open(frame).convert("RGB")
            if e.get("bw", True):
                im = im.convert("L").convert("RGB")
            canvas = im.convert("RGBA")
            cap_top = None
            if e.get("caption"):
                cap_top, _ = draw_caption(canvas, e["caption"], e.get("caption_y", 0.66), e.get("caption_size", 84),
                                          e.get("caption_font", "oswald"))
            if e.get("rose"):
                rp = resolve(e["rose"])
                rose = Image.open(rp).convert("RGBA")
                rw = int(e.get("rose_width", 300))
                up = rw / rose.width
                rose = rose.resize((rw, round(rose.height * up)), Image.LANCZOS)
                ry = e.get("rose_y")
                y = round(ry * H - rose.height / 2) if ry is not None else round((cap_top or H * 0.6) - rose.height - 24)
                canvas.alpha_composite(rose, ((W - rw) // 2, y))
                notes.append(f"Rose {os.path.relpath(rp, CORE)} (full colour, alpha kept) {rw}px wide = x{up:.2f} upscale"
                             + (" -- WARNING: more than 1.5x upscale, may look soft" if up > 1.5 else ""))
            png = os.path.join(tmp, f"freeze_{k}.png")
            canvas.convert("RGB").save(png)
            ff("-loop", "1", "-framerate", str(fps), "-i", png, "-frames:v", str(n), "-vf", "format=yuv420p,setsar=1",
               *venc, path)
            edl.append(["freeze", f'{e["at"]:.3f}', f'{e["at"]:.3f}', f"{out_f / fps:.3f}", f"{(out_f + n) / fps:.3f}",
                        f'frame at base {ff_ / fps:.3f}s (source {src_time(ff_):.3f}s); bw={e.get("bw", True)}; '
                        f'caption="{e.get("caption", "")}"'])
            notes.append(f'Freeze at output {out_f / fps:.3f}s for {n / fps:.3f}s, caption "{e.get("caption", "")}"')
        elif p["kind"] == "deal_with_it":
            e = p["ev"]
            frame = os.path.join(tmp, f"dwi_src_{k}.png")
            ff("-ss", f'{float(e["freeze_src"]):.6f}', "-i", src, "-filter_complex", lay + "[v]", "-map", "[v]",
               "-frames:v", "1", frame)
            lx, ly, rx, ry = e["eyes"]
            ec = [src_to_canvas(job, probe["width"], probe["height"], lx, ly),
                  src_to_canvas(job, probe["width"], probe["height"], rx, ry)]
            fdir = os.path.join(tmp, f"dwi_{k}")
            os.makedirs(fdir, exist_ok=True)
            info = deal_with_it_frames(Image.open(frame), e, ec, n, fps, fdir)
            ff("-framerate", str(fps), "-i", os.path.join(fdir, "dwi_%04d.png"), "-frames:v", str(n),
               "-vf", "format=yuv420p,setsar=1", *venc, path)
            edl.append(["deal_with_it", f'{e["at"]:.3f}', f'{e["at"]:.3f}', f"{out_f / fps:.3f}", f"{(out_f + n) / fps:.3f}",
                        f'freeze source {float(e["freeze_src"]):.3f}s; glasses drop {e.get("drop", 0.7)}s then B/W hold '
                        f'{e.get("hold", 0.8)}s; audio from source {e.get("audio_src", "none")}'])
            notes.append(f'Deal-with-it freeze at output {out_f / fps:.3f}s for {n / fps:.3f}s: frame at source '
                         f'{float(e["freeze_src"]):.3f}s; eyes (source px) {e["eyes"]} -> canvas '
                         f'({ec[0][0]:.0f},{ec[0][1]:.0f}) / ({ec[1][0]:.0f},{ec[1][1]:.0f}); glasses {info["width"]}x'
                         f'{info["height"]}px (nearest-neighbour), tilt {info["angle"]:.2f} deg, land at output '
                         f'{(out_f + round(float(e.get("drop", 0.7)) * fps)) / fps:.3f}s, then B/W; audio '
                         + (f'continues from source {e["audio_src"]}s' if e.get("audio_src") is not None else "silent"))
        p["out0"] = out_f
        vlist.append(path)
        out_f += n

    total_frames = out_f
    inserted = sum(i["n"] for i in inserts)
    assert total_frames == base_frames + inserted, "duration math mismatch"
    math_line = (f"base {base_frames / fps:.3f}s ({base_frames}f) + inserted {inserted / fps:.3f}s ({inserted}f) "
                 f"= output {total_frames / fps:.3f}s ({total_frames}f @ {fps}fps)")
    print(math_line)
    notes.append("Duration: " + math_line)

    # --- audio timeline
    spf = SR / fps
    total_s = round(total_frames * spf)
    orig = np.zeros((total_s, 2), np.float32)
    fade = int(0.008 * SR)
    for p in pieces:
        if p["kind"] != "base" or not src_audio:
            continue
        a0, ns = round(p["out0"] * spf), round(p["n"] * spf)
        chunk = decode_audio(src, src_time(p["f0"]), p["n"] / fps)[:ns]
        if len(chunk) < ns:
            chunk = np.vstack([chunk, np.zeros((ns - len(chunk), 2), np.float32)])
        ramp = np.linspace(0, 1, fade, dtype=np.float32)[:, None]
        chunk[:fade] *= ramp
        chunk[-fade:] *= ramp[::-1]
        orig[a0:a0 + ns] += chunk[: total_s - a0]

    for p in pieces:  # optional original audio under a deal-with-it freeze (audio keeps running, picture frozen)
        if p["kind"] != "deal_with_it" or p["ev"].get("audio_src") is None or not src_audio:
            continue
        a0, ns = round(p["out0"] * spf), round(p["n"] * spf)
        chunk = decode_audio(src, float(p["ev"]["audio_src"]), p["n"] / fps)[:ns]
        if len(chunk) < ns:
            chunk = np.vstack([chunk, np.zeros((ns - len(chunk), 2), np.float32)])
        fo = int(0.03 * SR)
        chunk[:fade] *= np.linspace(0, 1, fade, dtype=np.float32)[:, None]
        chunk[-fo:] *= np.linspace(1, 0, fo, dtype=np.float32)[:, None]
        orig[a0:a0 + ns] += chunk[: total_s - a0]

    # sfx placements: (output_time_s, file, gain_db, max_len_s, duck_db)
    places = []
    for p in pieces:
        e = p.get("ev")
        if p["kind"] == "insert_image" and e.get("sfx"):
            places.append((p["out0"] / fps, e["sfx"], e.get("sfx_gain_db", 0), p["n"] / fps, None, "insert"))
        if p["kind"] == "freeze" and e.get("sfx"):
            places.append((p["out0"] / fps, e["sfx"], e.get("sfx_gain_db", 0), p["n"] / fps, None, "freeze"))
    for e in events:
        if e["type"] == "sfx":
            t = out_frame(fr(e["at"])) / fps
            places.append((t, e["file"], e.get("gain_db", 0), e.get("len"), e.get("duck_db"), "sfx"))

    mix = orig.copy()
    gain_db = np.zeros(total_s, np.float32)
    seen = set()
    for t, fname, gdb, maxlen, duck, why in places:
        key = (round(t, 3), fname)
        if key in seen:
            notes.append(f"Skipped duplicate trigger of {fname} at {t:.3f}s")
            continue
        seen.add(key)
        p_, arr, on, L = load_sfx(fname)
        clip = arr[int(on * SR):]
        if maxlen:
            clip = clip[: int(maxlen * SR)]
        g = (SFX_TARGET_LUFS - L if L is not None else 0) + gdb
        clip = clip * (10 ** (g / 20))
        fi, fo = int(0.005 * SR), int(min(0.15, len(clip) / SR * 0.2) * SR)
        clip[:fi] *= np.linspace(0, 1, fi, dtype=np.float32)[:, None]
        if fo:
            clip[-fo:] *= np.linspace(1, 0, fo, dtype=np.float32)[:, None]
        s0 = round(t * SR)
        e0 = min(total_s, s0 + len(clip))
        mix[s0:e0] += clip[: e0 - s0]
        if duck:
            r = int(0.08 * SR)
            env = np.zeros(total_s, np.float32)
            idx = np.arange(total_s)
            up = np.clip((idx - (s0 - r)) / r, 0, 1)
            down = np.clip(((e0 + r) - idx) / r, 0, 1)
            env = duck * np.minimum(up, down)
            gain_db = np.minimum(gain_db, env.astype(np.float32))
        notes.append(f"SFX {fname} ({why}) at output {t:.3f}s: leading silence {on:.3f}s trimmed so the audible onset "
                     f"lands on that frame; {len(clip) / SR:.2f}s used of {len(arr) / SR:.2f}s; level {L} LUFS -> "
                     f"{SFX_TARGET_LUFS:+.0f} LUFS ref {gdb:+.1f} dB" + (f"; ducks original {duck} dB" if duck else ""))
    for p in pieces:
        if p["kind"] == "static":
            n = round(p["n"] * spf)
            r = subprocess.run(["ffmpeg", "-hide_banner", "-v", "error", "-f", "lavfi", "-i",
                                f"anoisesrc=d={p['n'] / fps:.4f}:c=white:a=0.35:r={SR},highpass=f=250,lowpass=f=7000,"
                                f"afade=t=in:d=0.02,afade=t=out:st={max(0, p['n'] / fps - 0.06):.4f}:d=0.06",
                                "-ac", "2", "-f", "f32le", "-"], capture_output=True)
            noise = np.frombuffer(r.stdout, np.float32).reshape(-1, 2)[:n]
            s0 = round(p["out0"] * spf)
            mix[s0:s0 + len(noise)] += noise
    # apply ducking to the original stream only
    duck_lin = (10 ** (gain_db / 20))[:, None]
    mix = mix - orig + orig * duck_lin

    raw = os.path.join(tmp, "mix.f32")
    mix.astype(np.float32).tofile(raw)
    meas = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", raw,
                           "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"],
                          capture_output=True, text=True).stderr
    m = json.loads(meas[meas.rindex("{"):meas.rindex("}") + 1])
    norm = os.path.join(tmp, "mix_norm.wav")
    aac = os.path.join(tmp, "mix.m4a")
    ceiling_db, enc_tp = -1.7, None
    for attempt in range(4):
        ff("-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", raw, "-af",
           f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
           f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true,"
           f"aresample={SR},alimiter=limit={10 ** (ceiling_db / 20):.4f}:attack=1:release=50:level=false",
           "-c:a", "pcm_f32le", "-ar", str(SR), norm)
        ff("-i", norm, "-c:a", "aac", "-b:a", "256k", "-ar", str(SR), "-ac", "2", aac)
        txt = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", aac, "-af", "ebur128=peak=true",
                              "-f", "null", "-"], capture_output=True, text=True).stderr
        tp = re.findall(r"Peak:\s+(-?[\d.]+|-inf) dBFS", txt)
        enc_tp = float(tp[-1]) if tp and tp[-1] != "-inf" else -99.0
        if enc_tp <= -1.2:
            break
        ceiling_db -= (enc_tp + 1.2) + 0.3   # pull the limiter down by the encoder overshoot, plus margin
    notes.append(f"Mix loudness before normalize {m['input_i']} LUFS / {m['input_tp']} dBTP -> target -14 LUFS; "
                 f"limiter ceiling {ceiling_db:.2f} dBFS; encoded AAC 256k true peak {enc_tp} dBTP")

    # --- final mux
    lst = os.path.join(tmp, "pieces.txt")
    with open(lst, "w") as f:
        f.writelines(f"file '{p}'\n" for p in vlist)
    final_in = ["-f", "concat", "-safe", "0", "-i", lst, "-i", aac]
    fc = "[0:v]setpts=N/FRAME_RATE/TB[v0]"
    last = "v0"
    if job.get("overlay"):
        ov = os.path.join(tmp, "overlay.png")
        overlay_png(job["overlay"], ov)
        final_in += ["-loop", "1", "-framerate", str(fps), "-i", ov]
        fc += f";[v0][2:v]overlay=0:0:shortest=0[v1]"
        last = "v1"
        notes.append(f'Overlay {job["overlay"]["file"]} visible for the whole output (incl. inserts/freezes), '
                     f'{job["overlay"].get("width", 700)}px wide centred at y={job["overlay"].get("y", 0.3)}')
    fc += f";[{last}]format=yuv420p[vout]"
    os.makedirs(os.path.dirname(export), exist_ok=True)
    ff(*final_in, "-filter_complex", fc, "-map", "[vout]", "-map", "1:a", "-frames:v", str(total_frames),
       "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-pix_fmt", "yuv420p", "-r", str(fps),
       "-c:a", "copy", "-movflags", "+faststart", export)

    with open(os.path.join(work, "EDL.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["kind", "base_in", "base_out", "out_in", "out_out", "file_or_notes"])
        w.writerows(edl)
    qc_times = []
    for p in pieces:
        if p["kind"] == "deal_with_it":
            dn = round(float(p["ev"].get("drop", 0.7)) * fps)
            qc_times += [round((p["out0"] + 2) / fps, 3), round((p["out0"] + dn // 2) / fps, 3),
                         round((p["out0"] + dn) / fps, 3), round((p["out0"] + (dn + p["n"]) // 2) / fps, 3)]
        if p["kind"] in INSERTS:
            qc_times.append(round((p["out0"] + min(3, p["n"] // 2)) / fps, 3))
            if p["kind"] == "freeze":
                qc_times.append(round((p["out0"] + p["n"] - 2) / fps, 3))
    for c in captions:
        qc_times.append(round(out_frame(fr((c["from"] + c["to"]) / 2)) / fps, 3))
    for t, *_ in places:
        qc_times.append(round(t + 0.1, 3))
    for z in zooms:
        qc_times.append(round(out_frame(fr((z["from"] + z["to"]) / 2)) / fps, 3))
    for st in stickers:
        qc_times.append(round(out_frame(fr(st["from"] + 0.4)) / fps, 3))
        notes.append(f'Sticker {st["file"]} at output {out_frame(fr(st["from"])) / fps:.3f}-{out_frame(fr(st["to"])) / fps:.3f}s, '
                     f'{st.get("size", 240)}px centred at ({st.get("x", 0.5)}, {st.get("y", 0.4)}), pop={st.get("pop", True)}')
    qc_times = sorted(set(t for t in qc_times if t < total_frames / fps))
    with open(os.path.join(work, "EDIT_NOTES.txt"), "w") as f:
        f.write(f"{os.path.basename(export)}\n\n" + "\n".join(notes) + "\n\nQC frame times: "
                + ", ".join(f"{t:.2f}" for t in qc_times) + "\n")
    if not os.environ.get("VU_KEEP_TMP"):
        shutil.rmtree(tmp)
    print("export:", os.path.relpath(export, ROOT))
    r = subprocess.run([sys.executable, "-I", os.path.join(ROOT, "tools", "qc.py"), export, os.path.join(work, "qc"),
                        "--at", ",".join(str(t) for t in qc_times)], text=True)
    sys.exit(r.returncode)


if __name__ == "__main__":
    main()
