"""Reality Rulebook S3 Part 3: one-pass picture render.
  seg1.mp4 (the owner's kernel clip with a speed ramp) -> dissolve -> the owner's two stills with a camera push and a
  bubble-pop reveal (start still -> end still), plus counter / captions / schematic card in Episode 1-2's look.
  python3 -I render.py full out.mp4        render the whole picture
  python3 -I render.py frames t1,t2,...    write check PNGs
"""
import math, random, subprocess, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

sys.path.insert(0, str(Path(__file__).parent))
from cfg import *

HERE = Path(__file__).parent
ST = HERE.parent.parent / "reference/clips/ep3"
FB = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

S_IM = Image.open(ST / "p3-start-kernels-bubble.webp").convert("RGB")
E_IM = Image.open(ST / "p3-end-droplet-ring.webp").convert("RGB")
SW, SH = S_IM.size                      # 941 x 1672
SA = np.asarray(S_IM).astype(np.float32)
EA = np.asarray(E_IM).astype(np.float32)

BX, BY, BR = 448.0, 804.0, 190.0        # bubble centre / radius in the start still
PX, PY = 436.0, 975.0                   # where the popcorn touches the bubble: the hole opens here
R_END = 780.0
T_REVEAL = 7.0                          # seconds for the hole to sweep the frame (1,000x slower)
YY, XX = np.mgrid[0:SH, 0:SW].astype(np.float32)
D_P = np.sqrt((XX - PX) ** 2 + (YY - PY) ** 2)
D_B = np.sqrt((XX - BX) ** 2 + (YY - BY) ** 2)
DISK = np.clip((BR + 3 - D_B) / 3.0, 0, 1)
SOFT = 2.5 + (1 - DISK) * 90.0
ANG = (np.arctan2(YY - BY, XX - BX) / (2 * math.pi) + 0.5)


def hsv2rgb(h, s, v):
    i = np.floor(h * 6).astype(np.int32) % 6
    f = h * 6 - np.floor(h * 6)
    p, q, t = v * (1 - s), v * (1 - f * s), v * (1 - (1 - f) * s)
    r = np.choose(i, [v, q, p, p, t, v]); g = np.choose(i, [t, v, v, q, p, p]); b = np.choose(i, [p, p, t, v, v, q])
    return np.stack([r, g, b], -1)


RAINBOW = hsv2rgb((ANG * 2.0 + 0.55) % 1.0, np.full_like(ANG, 0.55), np.full_like(ANG, 1.0)) * 255.0


def ease(x):
    x = min(max(x, 0.0), 1.0)
    return 0.5 - 0.5 * math.cos(math.pi * x)


def lerp(a, b, x):
    return a + (b - a) * x


def cam(t):
    """camera on the still: centre (cx, cy) and zoom z"""
    c0, cB, c1 = (SW / 2, SH / 2), (445.0, 880.0), (440.0, 892.0)
    if t < T_POP:
        u = ease((t - 19.3) / (T_POP - 19.3))
        return lerp(c0[0], cB[0], u), lerp(c0[1], cB[1], u), lerp(1.0, 1.45, u)
    if t < T_POP + T_REVEAL:
        u = (t - T_POP) / T_REVEAL
        return lerp(cB[0], c1[0], u), lerp(cB[1], c1[1], u), lerp(1.45, 1.55, u)
    u = ease((t - T_POP - T_REVEAL) / (TOTAL - T_POP - T_REVEAL))
    return lerp(c1[0], c0[0], u), lerp(c1[1], c0[1], u), lerp(1.55, 1.0, u)


# droplets the film sheds as the hole sweeps (they sit on the revealed still's own frozen droplets)
rng = random.Random(7)
PARTS = []
while len(PARTS) < 150:
    ts = rng.uniform(0.9, 6.3)                      # seconds after the pop
    u = ts / T_REVEAL
    r = R_END * (u ** 0.85)
    th = rng.uniform(0, 2 * math.pi)
    x, y = PX + r * math.cos(th), PY + r * math.sin(th)
    if math.hypot(x - BX, y - BY) > BR - 6:
        continue
    ox, oy = x - BX, y - BY
    n = math.hypot(ox, oy) or 1.0
    sp = rng.uniform(14, 34)
    PARTS.append(dict(ts=ts, x=x, y=y, vx=ox / n * sp + rng.uniform(-6, 6), vy=oy / n * sp + rng.uniform(-9, 3),
                      s=rng.uniform(1.3, 3.2), life=rng.uniform(2.2, 3.4)))


def still_frame(t):
    """the start/end stills with the hole reveal, at time t, as a float image in still space"""
    ta = t - T_POP
    if ta <= 0:
        base = SA
    elif ta >= T_REVEAL:
        base = EA
    else:
        u = ta / T_REVEAL
        r = R_END * (u ** 0.85)
        m = np.clip((r - D_P) / SOFT + 0.5, 0, 1)[..., None]   # crisp edge inside the bubble, feathered over the rest of the kitchen
        base = SA * (1 - m) + EA * m
        band = np.exp(-(((D_P - r) / 3.2) ** 2)) * DISK * min(1.0, 4 * (1 - u) + 0.15)
        a = (0.62 * band)[..., None]
        base = base * (1 - a) + (RAINBOW * 0.55 + 255 * 0.45) * a
    if ta > 0.5:
        lay = Image.new("RGBA", (SW, SH), (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        for p in PARTS:
            age = ta - p["ts"]
            if age < 0 or age > p["life"]:
                continue
            x, y = p["x"] + p["vx"] * age, p["y"] + p["vy"] * age
            al = min(1.0, age / 0.25) * min(1.0, (p["life"] - age) / 0.8)
            s = p["s"]
            d.ellipse((x - s, y - s, x + s, y + s), fill=(235, 245, 255, int(150 * al)))
            d.ellipse((x - s * .45 - s * .2, y - s * .5 - s * .25, x + s * .05, y - s * .05), fill=(255, 255, 255, int(235 * al)))
        lay = lay.filter(ImageFilter.GaussianBlur(0.55))
        la = np.asarray(lay).astype(np.float32)
        a = (la[..., 3:4] / 255.0)
        base = base * (1 - a) + la[..., :3] * a
    return base


def render_still(t):
    cx, cy, z = cam(t)
    w, h = SW / z, SH / z
    x0 = min(max(cx - w / 2, 0), SW - w); y0 = min(max(cy - h / 2, 0), SH - h)
    fr = np.clip(still_frame(t), 0, 255).astype(np.uint8)
    im = Image.fromarray(fr).resize((W, H), Image.LANCZOS, box=(x0, y0, x0 + w, y0 + h))
    im = im.filter(ImageFilter.UnsharpMask(radius=1.4, percent=55, threshold=2))
    a = np.asarray(im).astype(np.float32)
    a += np.random.normal(0, 1.2, (H, W, 1)).astype(np.float32)      # the same grain as the clip
    return a


# ---------- overlays (counter, captions, schematic card) ----------
def _patch(im):
    a = np.asarray(im).astype(np.float32)
    al = a[..., 3] / 255.0
    ys, xs = np.nonzero(al > 0.003)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    return dict(x0=x0, y0=y0, x1=x1, y1=y1, rgb=a[y0:y1, x0:x1, :3], al=al[y0:y1, x0:x1])


def counter_img(num, l1, l2):
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    x = 700
    d.text((x, 378), num, font=ImageFont.truetype(FB, 78), fill=(18, 28, 40, 255), anchor="ls", stroke_width=3, stroke_fill=(255, 255, 255, 170))
    d.rectangle((x, 404, x + 64, 408), fill=(47, 85, 255, 255))
    f = ImageFont.truetype(FR, 26)
    d.text((x, 446), l1, font=f, fill=(24, 36, 52, 255), anchor="ls", stroke_width=2, stroke_fill=(255, 255, 255, 190))
    d.text((x, 486), l2, font=f, fill=(24, 36, 52, 255), anchor="ls", stroke_width=2, stroke_fill=(255, 255, 255, 190))
    return _patch(im)


def caption_img(text):
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    f = ImageFont.truetype(FB, 40)
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0)); ds = ImageDraw.Draw(sh)
    ds.multiline_text((W // 2 + 2, 1376 + 3), text, font=f, fill=(0, 0, 0, 170), anchor="mm", align="center", spacing=14, stroke_width=4, stroke_fill=(0, 0, 0, 170))
    sh = sh.filter(ImageFilter.GaussianBlur(2.0))
    im = Image.alpha_composite(im, sh); d = ImageDraw.Draw(im)
    d.multiline_text((W // 2, 1376), text, font=f, fill=(255, 255, 255, 255), anchor="mm", align="center", spacing=14, stroke_width=2, stroke_fill=(10, 14, 20, 235))
    return _patch(im)


def card_img():
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0)); ImageDraw.Draw(sh).rounded_rectangle((64, 1488, 640, 1800), 28, fill=(0, 0, 0, 90))
    im = Image.alpha_composite(im, sh.filter(ImageFilter.GaussianBlur(10)))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((56, 1478, 632, 1788), 28, fill=(252, 250, 246, 238))
    d.text((92, 1522), "HOLE EDGE", font=ImageFont.truetype(FB, 27), fill=(62, 74, 92, 255), anchor="ls")
    cx, cy, r = 190, 1650, 76
    d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=(150, 170, 200, 255), width=5)
    d.arc((cx - r, cy - r, cx + r, cy + r), start=200, end=470, fill=(47, 85, 255, 255), width=8)
    ex, ey = cx + r * math.cos(math.radians(470)), cy + r * math.sin(math.radians(470))
    ang = math.radians(470 + 90)
    tip = (ex + 22 * math.cos(ang), ey + 22 * math.sin(ang))
    l = (ex + 14 * math.cos(ang - 2.2), ey + 14 * math.sin(ang - 2.2)); rr = (ex + 14 * math.cos(ang + 2.2), ey + 14 * math.sin(ang + 2.2))
    d.polygon([tip, l, rr], fill=(47, 85, 255, 255))
    d.text((310, 1636), "about 16 mph", font=ImageFont.truetype(FB, 36), fill=(18, 28, 40, 255), anchor="ls")
    d.text((310, 1680), "in real life", font=ImageFont.truetype(FR, 27), fill=(78, 90, 108, 255), anchor="ls")
    return _patch(im)


def build_overlays():
    ov = dict(counter=[(s, e, _c) for (n, a, b, s, e) in COUNTER for _c in [counter_img(n, a, b)]],
              caps=[(s, e, caption_img(tx)) for (tx, s, e) in CAPS],
              card=(CARD[0], CARD[1], card_img()))
    return ov


def paste(frame, p, alpha):
    if alpha <= 0.002:
        return
    reg = frame[p["y0"]:p["y1"], p["x0"]:p["x1"]]
    a = (p["al"] * alpha)[..., None]
    reg[:] = reg * (1 - a) + p["rgb"] * a


def window(t, s, e, fade=0.22):
    return min(1.0, max(0.0, (t - s) / fade), max(0.0, (e - t) / fade))


def overlay_frame(frame, t, ov):
    for (s, e, p) in ov["counter"]:
        # a state is fully on in [s, e); crossfade with its neighbours over 0.25 s centred on the switch
        a = 1.0
        if s > 0:
            a = min(a, max(0.0, min(1.0, (t - s + 0.125) / 0.25)))
        if e < TOTAL:
            a = min(a, max(0.0, min(1.0, (e + 0.125 - t) / 0.25)))
        if t < s - 0.125 or t > e + 0.125:
            a = 0.0
        paste(frame, p, a)
    for (s, e, p) in ov["caps"]:
        paste(frame, p, window(t, s, e))
    s, e, p = ov["card"]
    paste(frame, p, window(t, s, e, 0.3))


def seg1_frames():
    cmd = ["ffmpeg", "-v", "error", "-i", str(HERE / "seg1.mp4"), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    pr = subprocess.Popen(cmd, stdout=subprocess.PIPE)
    n = W * H * 3
    while True:
        b = pr.stdout.read(n)
        if len(b) < n:
            break
        yield np.frombuffer(b, np.uint8).reshape(H, W, 3).astype(np.float32)


def seg1_at(t):
    r = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.3f}", "-i", str(HERE / "seg1.mp4"), "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True)
    return np.frombuffer(r.stdout, np.uint8).reshape(H, W, 3).astype(np.float32)


XF0, XF1 = 19.3, 20.0


def compose(t, s1, ov):
    if t < XF0:
        f = s1.copy()
    else:
        s2 = render_still(t)
        if t < XF1:
            al = ease((t - XF0) / (XF1 - XF0))
            f = s1 * (1 - al) + s2 * al
        else:
            f = s2
    overlay_frame(f, t, ov)
    return np.clip(f, 0, 255).astype(np.uint8)


def main():
    mode = sys.argv[1]
    if mode == "plain":     # one clean still-frame (no overlays) for the cover
        Image.fromarray(np.clip(render_still(float(sys.argv[2])), 0, 255).astype(np.uint8)).save(sys.argv[3]); return
    ov = build_overlays()
    if mode == "frames":
        out = Path(sys.argv[3]) if len(sys.argv) > 3 else HERE / "chk"
        out.mkdir(exist_ok=True)
        for t in [float(x) for x in sys.argv[2].split(",")]:
            s1 = seg1_at(min(t, 19.95)) if t < XF1 else None
            Image.fromarray(compose(t, s1, ov)).save(out / f"t{t:06.2f}.png")
            print("ok", t)
        return
    outp = sys.argv[2]
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                            "-c:v", "libx264", "-crf", "14", "-preset", "medium", "-pix_fmt", "yuv420p", "-r", str(FPS), "-an", outp], stdin=subprocess.PIPE)
    n = int(round(TOTAL * FPS))
    src = seg1_frames()
    last = None
    for i in range(n):
        t = i / FPS
        s1 = None
        if t < XF1:
            try:
                last = next(src)
            except StopIteration:
                pass
            s1 = last
        enc.stdin.write(compose(t, s1, ov).tobytes())
        if i % 60 == 0:
            print("frame", i, "/", n, flush=True)
    enc.stdin.close(); enc.wait()
    print("done", outp)


main()
