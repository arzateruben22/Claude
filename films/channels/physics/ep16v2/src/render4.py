"""Reality Rulebook S3 Part 4 (a clap crossing the kitchen: 1,000x, then 10,000x): one-pass picture render from the
owner's key images K1, K2, K4 (K3 is used for the cover). Animated here: the clap, the skin ripples, the drawn sound
ring crossing the kitchen, the camera moves, the counter / captions / "Sound wave (drawn)" card / end card.
  python3 -I render4.py full out.mp4      render the whole picture
  python3 -I render4.py frames t1,t2,...  write check PNGs
"""
import math, subprocess, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = Path(__file__).parent  # the K images live in ../../reference/clips/ep4 (copy them next to this file to run)
FB = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FPS, W, H = 30, 1080, 1920
TOTAL = 49.0

# ---- timeline (placeholder windows, about 0.36 s a word; the owner's recording retimes them) ----
CAPS = [
    ("One clap. Let's watch the sound…\ncross the kitchen.", 0.4, 3.9),
    ("First, a thousand\ntimes slower.", 4.4, 6.9),
    ("That clap sound? It's air,\nsqueezed out from between your palms.", 7.4, 11.7),
    ("And off it goes. Sound moves\nabout 767 miles an hour.", 12.2, 16.1),
    ("But a thousand times slower,\nit's barely creeping:", 16.6, 19.4),
    ("about a foot every second.", 19.5, 22.0),
    ("Look at the window. The hummingbird?\nFrozen mid-wingbeat.", 22.5, 26.1),
    ("Let's slow it ten times more.\nTen thousand.", 26.6, 29.8),
    ("Now the sound crawls\nabout an inch a second.", 30.3, 33.9),
    ("In real life, it crossed\nthis whole kitchen", 34.4, 37.2),
    ("in about a hundredth\nof a second.", 37.3, 40.1),
    ("And sound is the slowpoke.\nNext time… a bullet.", 40.6, 43.8),
]
COUNTER = [("1×", "real time", "one clap", 0.0, 4.6), ("1,000×", "slower", "one clap", 4.6, 28.0),
           ("10,000×", "slower", "one clap", 28.0, 41.5), ("10,000×", "up next", "a bullet", 41.5, TOTAL)]
CARD = (12.3, 18.6)
END = (44.0, TOTAL)             # end card (even part: the owner's closer C4 plays here)
T_CLAP = 1.3
T_FLASH = (1.3, 1.45)
T_RING0 = 12.4


def ease(x):
    x = min(max(x, 0.0), 1.0)
    return 0.5 - 0.5 * math.cos(math.pi * x)


def lerp(a, b, x):
    return a + (b - a) * x


def load(name):
    return np.asarray(Image.open(HERE / name).convert("RGB")).astype(np.float32)


K1 = load("K1-hands-before-clap.png")
K2 = load("K2-palms-meet.png")
K4 = load("K4-window-frozen-hummingbird.webp")
SH, SW = K1.shape[:2]
if K4.shape[:2] != (SH, SW):
    K4 = np.asarray(Image.fromarray(K4.astype(np.uint8)).resize((SW, SH), Image.LANCZOS)).astype(np.float32)
YY, XX = np.mgrid[0:SH, 0:SW].astype(np.float32)

CLAP_K1 = (460.0, 900.0)        # where the hands meet, in K1
CONTACT_K2 = (534.0, 835.0)     # the seam between the palms, in K2


def remap(img, sx, sy):
    sx = np.clip(sx, 0, SW - 1.001); sy = np.clip(sy, 0, SH - 1.001)
    x0 = sx.astype(np.int32); y0 = sy.astype(np.int32); fx = (sx - x0)[..., None]; fy = (sy - y0)[..., None]
    a = img[y0, x0]; b = img[y0, x0 + 1]; c = img[y0 + 1, x0]; d = img[y0 + 1, x0 + 1]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def ring(base, c, r, sigma, amp, glow, shimmer_t, fade=1.0):
    """a thin ring of squeezed air: a lens-like warp across the band plus a faint highlight"""
    if r <= 1 or fade <= 0.01:
        return base
    dx, dy = XX - c[0], YY - c[1]
    d = np.sqrt(dx * dx + dy * dy) + 1e-6
    u = (d - r) / sigma
    g = np.exp(-u * u)
    ang = np.arctan2(dy, dx)
    g = g * (1 + 0.18 * np.sin(9 * ang + 2.2 * shimmer_t) + 0.10 * np.sin(23 * ang - 1.3 * shimmer_t))
    off = amp * fade * u * np.exp(-u * u)                      # push outward on one side, pull inward on the other
    out = remap(base, XX - off * dx / d, YY - off * dy / d)
    return out + (glow * fade) * g[..., None] * np.array([1.0, 0.99, 0.95], np.float32)


def cam_crop(arr, cx, cy, z):
    w, h = SW / z, SH / z
    x0 = min(max(cx - w / 2, 0), SW - w); y0 = min(max(cy - h / 2, 0), SH - h)
    im = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).resize((W, H), Image.LANCZOS, box=(x0, y0, x0 + w, y0 + h))
    im = im.filter(ImageFilter.UnsharpMask(radius=1.4, percent=50, threshold=2))
    return np.asarray(im).astype(np.float32)


def k1_frame(t, c, z):
    base = K1
    if t >= T_RING0:
        r = 47.0 * (t - T_RING0)
        fade = min(1.0, (t - T_RING0) / 0.6) * (1.0 if r < 700 else max(0.0, 1 - (r - 700) / 500))
        base = ring(base, CLAP_K1, r, 12.0, 13.0, 78.0, t, fade)
        if r > 70:                                             # a second, fainter ring trailing behind
            base = ring(base, CLAP_K1, r - 80, 9.0, 6.0, 32.0, t + 1.7, fade * 0.8)
    return cam_crop(base, c[0], c[1], z)


def k2_frame(t, z, c=(534.0, 800.0)):
    base = K2
    t0 = 4.9
    for i in range(4):                                          # skin ripples spreading out from the seam
        ti = t0 + 1.9 * i
        if t > ti:
            r = 95.0 * (t - ti)
            if r < 900:
                base = ring(base, CONTACT_K2, r, 34.0, 5.0, 0.0, t, 1.0 - r / 900)
    return cam_crop(base, c[0], c[1], z)


def k4_frame(t):
    u = (t - 24.6) / (TOTAL - 24.6)
    z = lerp(1.0, 1.32, ease(u * 1.0))
    return cam_crop(K4, lerp(470, 560, u), lerp(835, 640, u), z)


def picture(t):
    if t < T_FLASH[0]:                                           # K1, hands apart, real time
        return k1_frame(t, (470, 836), lerp(1.0, 1.05, t / T_FLASH[0]))
    if t < T_FLASH[1]:                                           # the clap: one frame-ish of the palms meeting
        f = (t - T_FLASH[0]) / (T_FLASH[1] - T_FLASH[0])
        return k2_frame(t, lerp(1.18, 1.0, f), (534, 836)) * 1.0 + 40 * (1 - f)
    if t < 4.4:
        return k1_frame(t, (470, 836), lerp(1.05, 1.10, (t - 1.45) / 2.95))
    if t < 5.3:                                                  # dissolve to the palms (1,000x slower)
        a = ease((t - 4.4) / 0.9)
        return k1_frame(t, (470, 836), 1.10) * (1 - a) + k2_frame(t, 1.0) * a
    if t < 12.0:
        return k2_frame(t, lerp(1.0, 1.22, (t - 4.4) / 7.6))
    if t < 12.9:                                                 # pull back out to the kitchen
        a = ease((t - 12.0) / 0.9)
        return k2_frame(t, 1.22) * (1 - a) + k1_frame(t, (470, 1000), 1.1) * a
    if t < 24.6:
        u = ease((t - 12.9) / (24.6 - 12.9))
        return k1_frame(t, (lerp(470, 545, u), lerp(1000, 430, u)), lerp(1.1, 1.45, u))
    if t < 25.4:                                                 # through the window to the hummingbird
        a = ease((t - 24.6) / 0.8)
        return k1_frame(t, (545, 430), 1.45) * (1 - a) + k4_frame(t) * a
    return k4_frame(t)


# ---------- overlays ----------
def _patch(im):
    a = np.asarray(im).astype(np.float32)
    al = a[..., 3] / 255.0
    ys, xs = np.nonzero(al > 0.003)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    return dict(x0=x0, y0=y0, x1=x1, y1=y1, rgb=a[y0:y1, x0:x1, :3], al=al[y0:y1, x0:x1])


def counter_img(num, l1, l2):
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    x = 640
    d.text((x, 378), num, font=ImageFont.truetype(FB, 78), fill=(18, 28, 40, 255), anchor="ls", stroke_width=3, stroke_fill=(255, 255, 255, 170))
    d.rectangle((x, 404, x + 64, 408), fill=(47, 85, 255, 255))
    f = ImageFont.truetype(FR, 26)
    d.text((x, 446), l1, font=f, fill=(24, 36, 52, 255), anchor="ls", stroke_width=2, stroke_fill=(255, 255, 255, 190))
    d.text((x, 486), l2, font=f, fill=(24, 36, 52, 255), anchor="ls", stroke_width=2, stroke_fill=(255, 255, 255, 190))
    return _patch(im)


def caption_img(text):
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    f = ImageFont.truetype(FB, 40)
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0)); ds = ImageDraw.Draw(sh)
    ds.multiline_text((W // 2 + 2, 1376 + 3), text, font=f, fill=(0, 0, 0, 170), anchor="mm", align="center", spacing=14, stroke_width=4, stroke_fill=(0, 0, 0, 170))
    sh = sh.filter(ImageFilter.GaussianBlur(2.0))
    im = Image.alpha_composite(im, sh); d = ImageDraw.Draw(im)
    d.multiline_text((W // 2, 1376), text, font=f, fill=(255, 255, 255, 255), anchor="mm", align="center", spacing=14, stroke_width=2, stroke_fill=(10, 14, 20, 235))
    return _patch(im)


def card_img():
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0)); ImageDraw.Draw(sh).rounded_rectangle((64, 1488, 700, 1800), 28, fill=(0, 0, 0, 90))
    im = Image.alpha_composite(im, sh.filter(ImageFilter.GaussianBlur(10)))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((56, 1478, 692, 1788), 28, fill=(252, 250, 246, 238))
    d.text((92, 1522), "SOUND WAVE (DRAWN)", font=ImageFont.truetype(FB, 27), fill=(62, 74, 92, 255), anchor="ls")
    cx, cy = 180, 1654
    for r, wd in ((26, 5), (52, 5), (78, 5)):
        d.arc((cx - r, cy - r, cx + r, cy + r), start=-60, end=60, fill=(47, 85, 255, 255), width=wd)
    d.ellipse((cx - 12, cy - 12, cx + 12, cy + 12), fill=(21, 23, 28, 255))
    d.line((cx + 96, cy, cx + 170, cy), fill=(47, 85, 255, 255), width=7)
    d.polygon([(cx + 188, cy), (cx + 160, cy - 15), (cx + 160, cy + 15)], fill=(47, 85, 255, 255))
    d.text((400, 1636), "767 mph", font=ImageFont.truetype(FB, 40), fill=(18, 28, 40, 255), anchor="ls")
    d.text((400, 1682), "in real life", font=ImageFont.truetype(FR, 27), fill=(78, 90, 108, 255), anchor="ls")
    return _patch(im)


def endcard_img():
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    g = Image.new("L", (W, H), 0); gd = ImageDraw.Draw(g)
    for y in range(1100, H):
        gd.line((0, y, W, y), fill=int(150 * min(1.0, (y - 1100) / 380)))
    im.putalpha(g)
    d = ImageDraw.Draw(im)
    d.text((90, 1480), "REALITY RULEBOOK", font=ImageFont.truetype(FB, 46), fill=(255, 255, 255, 255), anchor="ls")
    d.text((90, 1550), "PART 4 OF 8", font=ImageFont.truetype(FB, 38), fill=(190, 210, 255, 255), anchor="ls")
    d.text((90, 1618), "NEXT: A BULLET", font=ImageFont.truetype(FB, 38), fill=(255, 255, 255, 255), anchor="ls")
    return _patch(im)


def build_overlays():
    return dict(counter=[(s, e, counter_img(n, a, b)) for (n, a, b, s, e) in COUNTER],
                caps=[(s, e, caption_img(tx)) for (tx, s, e) in CAPS], card=(CARD[0], CARD[1], card_img()),
                end=(END[0], END[1], endcard_img()))


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
    s, e, p = ov["end"]
    paste(frame, p, min(1.0, max(0.0, (t - s) / 0.6)))


def compose(t, ov, overlays=True):
    f = picture(t).copy()
    f += np.random.normal(0, 1.1, (H, W, 1)).astype(np.float32)
    if overlays:
        overlay_frame(f, t, ov)
    return np.clip(f, 0, 255).astype(np.uint8)


def main():
    mode = sys.argv[1]
    ov = build_overlays() if mode != "plain" else None
    if mode == "plain":
        Image.fromarray(compose(float(sys.argv[2]), None, False)).save(sys.argv[3]); return
    if mode == "frames":
        out = HERE / "chk"; out.mkdir(exist_ok=True)
        for t in [float(x) for x in sys.argv[2].split(",")]:
            Image.fromarray(compose(t, ov)).save(out / f"t{t:06.2f}.png"); print("ok", t)
        return
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                            "-c:v", "libx264", "-crf", "14", "-preset", "medium", "-pix_fmt", "yuv420p", "-r", str(FPS), "-an", sys.argv[2]], stdin=subprocess.PIPE)
    n = int(round(TOTAL * FPS))
    for i in range(n):
        enc.stdin.write(compose(i / FPS, ov).tobytes())
        if i % 60 == 0:
            print("frame", i, "/", n, flush=True)
    enc.stdin.close(); enc.wait(); print("done", sys.argv[2])


main()
