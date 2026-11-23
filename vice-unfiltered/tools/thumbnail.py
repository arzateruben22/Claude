#!/usr/bin/env python3
"""Vice Unfiltered thumbnail templates (master prompt section 5).

Usage: python3 -I tools/thumbnail.py <job.json>      (run from vice-unfiltered/)

Three templates, all 1080x1920, built from REAL frames with programmatic type
(no generated faces, no AI lettering):
  poster  - Comic Pop poster (IMAGE-1 / Nightclub Chaos reference): big torn-paper
            portrait, cream + magenta headline strips, framed gameplay below.
  blocks  - Color Block cover (the six authentic KreekCraft covers): flat colour
            blocks, name and clip-number tags, two framed frames, outlined headline band.
  tabloid - Tabloid strip ("Bro Thought He Was Tuff" layout with clean type):
            full-bleed portrait, black torn headline slab, two-panel reaction strip.

Job JSON:
{
  "template": "poster" | "blocks" | "tabloid",
  "out": "thumbnails/Dom_01_BurningTruck_THUMBNAIL_V1",   # writes .png and .jpg
  "streamer": "DOM", "clip_no": 1, "subtitle": "THE BURNING TRUCK",
  "headline": ["STILL", "DRIVING"],        # 2 lines; the last line is the accent line
  "accent": "#B8285E",                     # optional
  "images": {                              # each: {"src": image or video, "t": seconds if video, "crop": [x,y,w,h]}
    "portrait": {...}, "main": {...}, "second": {...}   # tabloid uses main + second for the strip
  },
  "seed": 3
}
Refuses to overwrite an existing output.
"""
import json
import math
import os
import random
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

W, H = 1080, 1920
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS = os.path.join(ROOT, "assets", "fonts")
ANTON = os.path.join(FONTS, "anton-latin-400-normal.woff")
BEBAS = os.path.join(FONTS, "bebas-neue-latin-400-normal.woff")
OSWALD = os.path.join(FONTS, "oswald-latin-700-normal.woff")
OSWALD6 = os.path.join(FONTS, "oswald-latin-600-normal.woff")

INK = (21, 20, 19)
CREAM = (244, 236, 218)
PAPER = (236, 224, 200)
YELLOW = (255, 210, 26)
MAGENTA = (184, 40, 94)
NAVY = (29, 26, 43)
CYAN = (94, 214, 232)


def hexrgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def font(path, size):
    return ImageFont.truetype(path, size)


# ---------- sources ----------
def load_image(spec, tmp):
    src = spec["src"]
    if not os.path.isabs(src):
        src = os.path.join(ROOT, src)
    if os.path.splitext(src)[1].lower() in (".mp4", ".mov", ".mkv", ".webm"):
        out = os.path.join(tmp, f"frame_{abs(hash((src, spec.get('t', 0))))}.png")
        subprocess.run(["ffmpeg", "-hide_banner", "-v", "error", "-y", "-ss", str(spec.get("t", 0)),
                        "-i", src, "-frames:v", "1", out], check=True)
        src = out
    im = Image.open(src).convert("RGB")
    if spec.get("crop"):
        x, y, w, h = spec["crop"]
        im = im.crop((x, y, x + w, y + h))
    return im


def cover(im, w, h):
    """Scale and centre-crop to exactly w x h (no distortion)."""
    s = max(w / im.width, h / im.height)
    im = im.resize((max(w, round(im.width * s)), max(h, round(im.height * s))), Image.LANCZOS)
    x, y = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))


def photo_finish(im, rng):
    """Light print feel only: a touch of contrast and fine grain. Faces stay natural."""
    a = np.asarray(im).astype(np.float32)
    a = (a - 128) * 1.06 + 128
    a += np.random.default_rng(rng.randint(0, 1 << 30)).normal(0, 4.0, a.shape[:2])[..., None]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


# ---------- paper & print textures ----------
def paper(w, h, rng, base=PAPER):
    g = np.random.default_rng(rng.randint(0, 1 << 30))
    a = np.empty((h, w, 3), np.float32)
    a[:] = base
    low = Image.fromarray((g.random((h // 16, w // 16)) * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
    low = low.filter(ImageFilter.GaussianBlur(18))
    a += (np.asarray(low, np.float32)[..., None] - 128) * 0.10
    a += g.normal(0, 5.5, (h, w))[..., None]
    yy, xx = np.mgrid[0:h, 0:w]
    v = ((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2
    a *= (1 - 0.07 * np.clip(v, 0, 1.6))[..., None]
    img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    d = ImageDraw.Draw(img, "RGBA")
    for _ in range(int(w * h / 9000)):  # faint fibres
        x, y = rng.uniform(0, w), rng.uniform(0, h)
        ang, ln = rng.uniform(0, math.pi), rng.uniform(6, 22)
        d.line([(x, y), (x + ln * math.cos(ang), y + ln * math.sin(ang))], fill=(90, 70, 40, 18), width=1)
    return img


def halftone(w, h, color, spacing=14, rmax=6.0, direction=(1, 1), alpha=255):
    """Dot screen whose dot size ramps along `direction` (comic print look)."""
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    dx, dy = direction
    norm = math.hypot(dx, dy) or 1
    for j, y in enumerate(range(0, h + spacing, spacing)):
        off = spacing / 2 if j % 2 else 0
        for x in np.arange(-spacing + off, w + spacing, spacing):
            t = ((x / w) * dx + (y / h) * dy) / norm
            r = rmax * max(0.0, min(1.0, t))
            if r > 0.6:
                d.ellipse([x - r, y - r, x + r, y + r], fill=color + (alpha,))
    return layer


def torn_mask(w, h, rng, amp=(0, 0, 0, 0), step=14):
    """Mask with ragged edges. amp = jitter in px for (top, right, bottom, left)."""
    t, r, b, l = amp
    pts = []
    for x in range(0, w + 1, step):
        pts.append((x, rng.uniform(0, t) if t else 0))
    for y in range(0, h + 1, step):
        pts.append((w - (rng.uniform(0, r) if r else 0), y))
    for x in range(w, -1, -step):
        pts.append((x, h - (rng.uniform(0, b) if b else 0)))
    for y in range(h, -1, -step):
        pts.append((rng.uniform(0, l) if l else 0, y))
    m = Image.new("L", (w, h), 0)
    ImageDraw.Draw(m).polygon(pts, fill=255)
    return m


def place(canvas, layer, xy, angle=0.0, shadow=None):
    """Composite an RGBA layer at xy (top-left before rotation), optional hard shadow (dx, dy, alpha)."""
    if angle:
        layer = layer.rotate(angle, resample=Image.BICUBIC, expand=True)
    x, y = xy
    if shadow:
        dx, dy, a = shadow
        sh = Image.new("RGBA", layer.size, INK + (0,))
        sh.putalpha(layer.getchannel("A").point(lambda v: v * a // 255))
        canvas.alpha_composite(sh, (int(x + dx), int(y + dy)))
    canvas.alpha_composite(layer, (int(x), int(y)))


def framed(im, w, h, rng, border=12, border_color=(255, 255, 255), torn=None, finish=True):
    """Photo fitted to w x h inside a paper border; optional torn edges on the whole piece."""
    pic = cover(im, w, h)
    if finish:
        pic = photo_finish(pic, rng)
    piece = Image.new("RGBA", (w + 2 * border, h + 2 * border), border_color + (255,))
    piece.paste(pic, (border, border))
    if torn:
        piece.putalpha(torn_mask(piece.width, piece.height, rng, torn))
    return piece


# ---------- type ----------
def fit_font(path, text, max_w, max_size, min_size=40, tracking=0):
    size = max_size
    while size > min_size:
        f = font(path, size)
        if text_width(text, f, tracking) <= max_w:
            return f
        size -= 4
    return font(path, min_size)


def text_width(text, f, tracking=0):
    if not tracking:
        return f.getlength(text)
    return sum(f.getlength(c) for c in text) + tracking * (len(text) - 1)


def text_layer(text, f, fill, tracking=0, stroke=0, stroke_fill=INK, misreg=None):
    """Render text on its own transparent layer, tight to the ink box."""
    asc, desc = f.getmetrics()
    w = int(text_width(text, f, tracking) + 2 * stroke + 24)
    h = int(asc + desc + 2 * stroke + 12)
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)

    def draw(dd, ox, oy, col, sw):
        x = 12 + stroke + ox
        if tracking:
            for c in text:
                dd.text((x, 6 + stroke + oy), c, font=f, fill=col, stroke_width=sw, stroke_fill=stroke_fill)
                x += f.getlength(c) + tracking
        else:
            dd.text((x, 6 + stroke + oy), text, font=f, fill=col, stroke_width=sw, stroke_fill=stroke_fill)

    if misreg:  # print misregistration: a faint offset plate under the ink
        mx, my, col = misreg
        draw(d, mx, my, col, stroke)
    draw(d, 0, 0, fill, stroke)
    bbox = layer.getbbox()
    return layer.crop(bbox) if bbox else layer


def tag(text, f, fg, bg, pad=(18, 10), angle=0.0, rng=None, torn=False):
    t = text_layer(text, f, fg)
    piece = Image.new("RGBA", (t.width + 2 * pad[0], t.height + 2 * pad[1]), bg + (255,))
    piece.alpha_composite(t, (pad[0], pad[1]))
    if torn and rng:
        piece.putalpha(torn_mask(piece.width, piece.height, rng, (5, 5, 5, 5), step=10))
    return piece.rotate(angle, resample=Image.BICUBIC, expand=True) if angle else piece


# ---------- templates ----------
def t_poster(job, imgs, rng):
    acc = hexrgb(job.get("accent", "#B8285E"))
    c = paper(W, H, rng).convert("RGBA")
    c.alpha_composite(halftone(W, 640, acc, 15, 6.5, (1, -1), 200), (0, 0))
    c.alpha_composite(halftone(W, 700, YELLOW, 16, 7, (-1, 1), 230), (0, H - 700))
    # magenta torn strip down the right edge behind the portrait
    strip = Image.new("RGBA", (130, 900), acc + (255,))
    strip.putalpha(torn_mask(130, 900, rng, (0, 0, 0, 16)))
    place(c, strip, (W - 120, 380))
    # portrait
    pw, ph = 960, 900
    p = framed(imgs["portrait"], pw, ph, rng, border=14, border_color=CREAM, torn=(10, 10, 26, 10))
    place(c, p, (46, 54), angle=-1.2)
    # name tag
    nm = tag(job["streamer"].upper(), font(ANTON, 62), INK, CREAM, (22, 12), angle=2.0, rng=rng, torn=True)
    place(c, nm, (W - nm.width - 70, 70), shadow=(6, 6, 200))
    # headline strips
    l1, l2 = job["headline"][0].upper(), job["headline"][-1].upper()
    f1 = fit_font(ANTON, l1, 860, 190)
    t1 = text_layer(l1, f1, INK, misreg=(6, 5, acc + (110,)))
    s1 = Image.new("RGBA", (t1.width + 64, t1.height + 46), (242, 232, 210, 255))
    s1.alpha_composite(t1, (32, 23))
    s1.putalpha(torn_mask(s1.width, s1.height, rng, (8, 12, 8, 12), step=12))
    place(c, s1, (48, 860), angle=-1.5, shadow=(8, 8, 120))
    f2 = fit_font(ANTON, l2, 880, 200)
    t2 = text_layer(l2, f2, CREAM)
    s2 = Image.new("RGBA", (t2.width + 70, t2.height + 50), acc + (255,))
    s2.alpha_composite(t2, (35, 25))
    s2.putalpha(torn_mask(s2.width, s2.height, rng, (6, 10, 6, 10), step=12))
    place(c, s2, (96, 860 + s1.height - 4), angle=1.0, shadow=(10, 10, 230))
    # gameplay frame
    g = framed(imgs["main"], 880, 400, rng, border=12)
    place(c, g, (90, 1408), angle=1.2, shadow=(12, 12, 235))
    # brand footer
    bt = tag("VICE UNFILTERED", font(BEBAS, 44), YELLOW, INK, (16, 8))
    place(c, bt, (W - bt.width - 60, 1858))
    return c


BLOCK_ACCENTS = ["#F2558F", "#F5C842", "#C6F04A", "#D873F0", "#FF6B5E", "#FF8A3D"]


def t_blocks(job, imgs, rng):
    acc = hexrgb(job.get("accent") or BLOCK_ACCENTS[(int(job.get("clip_no", 1)) - 1) % len(BLOCK_ACCENTS)])
    c = Image.new("RGBA", (W, H), NAVY + (255,))
    d = ImageDraw.Draw(c)
    d.polygon([(0, 0), (W, 0), (W, 420), (0, 760)], fill=acc)
    d.polygon([(W, 1250), (W, H), (380, H)], fill=CYAN)
    d.polygon([(0, 1500), (0, H), (520, H)], fill=acc)
    d.polygon([(W - 260, 560), (W, 470), (W, 980), (W - 140, 1010)], fill=YELLOW)
    c.alpha_composite(halftone(260, 300, (255, 255, 255), 18, 3.2, (1, 0), 160), (18, 760))
    c.alpha_composite(halftone(240, 280, acc, 18, 3.2, (0, 1), 200), (W - 250, 1040))
    # top tags
    nm = tag(job["streamer"].upper(), font(OSWALD, 38), CREAM, INK, (20, 8))
    place(c, nm, (42, 36))
    no = tag(f'{int(job.get("clip_no", 1)):02d}', font(OSWALD, 38), INK, CREAM, (18, 8))
    place(c, no, (W - no.width - 42, 36))
    # frame 1 (reaction)
    f1 = framed(imgs["portrait"], 920, 640, rng, border=10)
    place(c, f1, (70, 128), angle=-1.6, shadow=(12, 12, 255))
    # headline band
    band = Image.new("RGBA", (W + 40, 340), acc + (255,))
    band_y = 818
    place(c, band, (-20, band_y), angle=-1.2, shadow=(0, 10, 255))
    l1, l2 = job["headline"][0].upper(), job["headline"][-1].upper()
    for i, line in enumerate((l1, l2)):
        f = fit_font(ANTON, line, 900, 160)
        t = text_layer(line, f, (255, 246, 229), stroke=9, stroke_fill=INK)
        place(c, t, ((W - t.width) // 2, band_y + 22 + i * 158), angle=-1.2)
    # frame 2 (gameplay)
    f2 = framed(imgs["main"], 880, 520, rng, border=10)
    place(c, f2, (92, 1196), angle=1.4, shadow=(12, 12, 255))
    # footer bar
    bar = Image.new("RGBA", (W - 84, 78), INK + (255,))
    bd = ImageDraw.Draw(bar)
    bd.text((22, 14), "VICE UNFILTERED", font=font(OSWALD, 36), fill=CREAM)
    sub = job.get("subtitle", "").upper()
    if sub:
        fs = font(OSWALD6, 30)
        bd.text((bar.width - 22 - fs.getlength(sub), 19), sub, font=fs, fill=acc)
    place(c, bar, (42, 1790))
    return c


def t_tabloid(job, imgs, rng):
    acc = hexrgb(job.get("accent", "#C8202A"))
    c = paper(W, H, rng).convert("RGBA")
    c.alpha_composite(halftone(W, 1000, acc, 13, 6.0, (0, 1), 170), (0, 820))
    # portrait full-bleed with torn bottom, cream tear line underneath
    under = Image.new("RGBA", (W, 930), CREAM + (255,))
    under.putalpha(torn_mask(W, 930, rng, (0, 0, 30, 0), step=12))
    place(c, under, (0, 0))
    p = cover(imgs["portrait"], W, 900)
    p = photo_finish(p, rng).convert("RGBA")
    p.putalpha(torn_mask(W, 900, rng, (0, 0, 34, 0), step=12))
    place(c, p, (0, 0))
    # brand stamp (set "brand": false for campaigns that ban logos, e.g. SypherPK)
    if job.get("brand", True):
        st = Image.new("RGBA", (300, 150), CREAM + (255,))
        sd = ImageDraw.Draw(st)
        sd.text((22, 8), "VICE", font=font(ANTON, 78), fill=INK)
        sd.rectangle([18, 104, 282, 142], fill=acc)
        sd.text((28, 101), "UNFILTERED", font=font(ANTON, 34), fill=CREAM)
        st.putalpha(torn_mask(300, 150, rng, (6, 6, 6, 6), step=10))
        place(c, st, (W - 330, 46), angle=4, shadow=(6, 6, 200))
    # headline slab
    slab = Image.new("RGBA", (W - 40, 360), INK + (255,))
    slab.putalpha(torn_mask(slab.width, slab.height, rng, (14, 10, 14, 10), step=12))
    place(c, slab, (20, 840), angle=-1.0)
    l1, l2 = job["headline"][0].upper(), job["headline"][-1].upper()
    t1 = text_layer(l1, fit_font(ANTON, l1, 900, 160), CREAM)
    place(c, t1, (60, 872), angle=-1.0)
    t2 = text_layer(l2, fit_font(ANTON, l2, 940, 190), YELLOW, misreg=(5, 5, acc + (160,)))
    place(c, t2, (54, 872 + t1.height + 18), angle=-1.0)
    # two-panel strip
    a = framed(imgs["main"], 460, 470, rng, border=11)
    b = framed(imgs.get("second", imgs["main"]), 460, 470, rng, border=11)
    place(c, a, (40, 1238), angle=-2.0, shadow=(10, 10, 235))
    place(c, b, (560, 1250), angle=2.0, shadow=(10, 10, 235))
    # name tag + small brand
    nm = tag(job["streamer"].upper(), font(ANTON, 64), CREAM, acc, (22, 10))
    place(c, nm, (48, 1770), angle=-2.0, shadow=(6, 6, 220))
    return c


# ---------- Hype Reaction (owner's style reference, 2026-11-23) ----------
MONT = os.path.join(FONTS, "montserrat-latin-900-italic.woff")
EMOJI_FONT = "/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf"
BIREFNET = os.path.join(ROOT, "assets", "models", "birefnet_lite.onnx")
HYPE_FILLS = {"green": ((150, 255, 70), (40, 205, 20)), "yellow": ((255, 245, 60), (255, 176, 0)),
              "pink": ((255, 120, 200), (230, 30, 130)), "white": ((255, 255, 255), (230, 230, 230))}
_SESS = None


BIREFNET_PORTRAIT = os.path.join(ROOT, "assets", "models", "birefnet_portrait.onnx")
_SESSIONS = {}


def person_matte(im, erase=None):
    """Real-frame person cut-out. BiRefNet-portrait (MIT) when present: people only, chairs excluded.
    Then: keep the largest shape, fill holes, choke the edge 1 px, and apply any `erase` rules
    (portrait-crop pixels) for hand cleanup: [x,y,w,h] or {"box":[x,y,w,h], "dark_below":75, "keep_ellipse":[cx,cy,rx,ry]}."""
    import onnxruntime as ort
    from scipy import ndimage
    path = BIREFNET_PORTRAIT if os.path.exists(BIREFNET_PORTRAIT) else BIREFNET
    if path not in _SESSIONS:
        _SESSIONS[path] = ort.InferenceSession(path)
    sess = _SESSIONS[path]
    name = sess.get_inputs()[0].name
    x = np.asarray(im.convert("RGB").resize((1024, 1024), Image.BICUBIC), np.float32) / 255.0
    x = ((x - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]).astype(np.float32).transpose(2, 0, 1)[None]
    y = sess.run(None, {name: x})[-1][0, 0]
    if y.min() < 0 or y.max() > 1:
        y = 1 / (1 + np.exp(-y))
    m = np.asarray(Image.fromarray((np.clip(y, 0, 1) * 255).astype(np.uint8)).resize(im.size, Image.BICUBIC), np.float32) / 255
    lab, n = ndimage.label(m > 0.5)
    if n > 1:
        sizes = ndimage.sum(np.ones_like(m), lab, range(1, n + 1))
        keep = ndimage.binary_dilation(lab == (int(np.argmax(sizes)) + 1), iterations=4)
        m = m * keep
    m = np.maximum(m, ndimage.binary_fill_holes(m > 0.5).astype(np.float32))
    if erase:
        rgb = np.asarray(im.convert("RGB"), np.float32)
        luma = rgb @ np.array([0.299, 0.587, 0.114], np.float32)
        yy, xx = np.mgrid[0:m.shape[0], 0:m.shape[1]]
        kill = np.zeros_like(m, bool)
        for e in erase:
            e = {"box": e} if isinstance(e, (list, tuple)) else e
            bx, by, bw, bh = e["box"]
            sel = (xx >= bx) & (xx < bx + bw) & (yy >= by) & (yy < by + bh)
            if "dark_below" in e:            # only near-black pixels (chairs), never skin or clothes
                sel &= luma < e["dark_below"]
            if "keep_ellipse" in e:          # protect a rounded shape such as a headphone cup
                cx, cy, rx, ry = e["keep_ellipse"]
                sel &= ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 > 1
            kill |= sel
        kill = ndimage.binary_opening(kill, iterations=1)
        soft = ndimage.gaussian_filter(kill.astype(np.float32), 1.2)
        m = m * (1 - np.clip(soft * 1.6, 0, 1))
        lab, n = ndimage.label(m > 0.5)
        if n > 1:
            sizes = ndimage.sum(np.ones_like(m), lab, range(1, n + 1))
            m = m * ndimage.binary_dilation(lab == (int(np.argmax(sizes)) + 1), iterations=3)
    m = np.clip((m - 0.12) / 0.76, 0, 1)                       # crisper edge, no faint halo
    m = np.minimum(m, ndimage.grey_erosion(m, size=(3, 3)) + 0.25)  # choke ~1 px
    return Image.fromarray((np.clip(m, 0, 1) * 255).astype(np.uint8))


def decontaminate(rgb, matte, sigma=4.0):
    """Replace edge colours with colours pulled from inside the subject, so no background tint stays in the fringe."""
    from scipy import ndimage
    a = np.asarray(matte, np.float32) / 255
    core = (a > 0.97).astype(np.float32)
    img = np.asarray(rgb.convert("RGB"), np.float32)
    num = np.stack([ndimage.gaussian_filter(img[..., k] * core, sigma) for k in range(3)], -1)
    den = ndimage.gaussian_filter(core, sigma)[..., None]
    fg = np.where(den > 1e-3, num / np.maximum(den, 1e-3), img)
    w = np.clip((0.97 - a) / 0.97, 0, 1)[..., None] * (a > 0.01)[..., None]
    out = img * (1 - w) + fg * w
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


def gradient_text(text, f, top, bottom, stroke, misreg=None):
    base = text_layer(text, f, (255, 255, 255), stroke=0)
    w, h = base.size
    grad = Image.new("RGBA", (w, h))
    gd = ImageDraw.Draw(grad)
    for yy in range(h):
        t = yy / max(1, h - 1)
        gd.line([(0, yy), (w, yy)], fill=tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)) + (255,))
    grad.putalpha(base.getchannel("A"))
    outl = text_layer(text, f, INK, stroke=stroke, stroke_fill=INK)
    out = Image.new("RGBA", outl.size, (0, 0, 0, 0))
    out.alpha_composite(outl)
    out.alpha_composite(grad, ((outl.width - w) // 2, (outl.height - h) // 2))
    return out


def drop_shadow(layer, dx=8, dy=12, blur=6, a=170):
    pad = blur * 3 + max(abs(dx), abs(dy))
    out = Image.new("RGBA", (layer.width + 2 * pad, layer.height + 2 * pad), (0, 0, 0, 0))
    sh = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    sh.putalpha(layer.getchannel("A").point(lambda v: v * a // 255))
    out.alpha_composite(sh, (pad + dx, pad + dy))
    out = out.filter(ImageFilter.GaussianBlur(blur))
    out.alpha_composite(layer, (pad, pad))
    return out, pad


def emoji_layer(ch, px):
    f = ImageFont.truetype(EMOJI_FONT, 109)
    tmp = Image.new("RGBA", (160, 160), (0, 0, 0, 0))
    ImageDraw.Draw(tmp).text((8, 8), ch, font=f, embedded_color=True)
    tmp = tmp.crop(tmp.getbbox())
    return tmp.resize((px, round(tmp.height * px / tmp.width)), Image.LANCZOS)


def brush(w, h, color, rng):
    """Tapered marker swoosh, slightly curved, for under the key word."""
    layer = Image.new("RGBA", (w, h + 20), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    top, bot = [], []
    for i in range(0, 41):
        t = i / 40
        x = t * w
        yc = h * 0.55 - math.sin(t * math.pi) * h * 0.18 + rng.uniform(-1.5, 1.5)
        half = (h * 0.5) * (0.25 + 0.75 * math.sin(min(1, t * 1.15) * math.pi * 0.95)) * (1 - 0.65 * t)
        top.append((x, yc - half))
        bot.append((x, yc + half * 0.7))
    d.polygon(top + bot[::-1], fill=color + (255,))
    return layer


def arrow(c, start, end, color=(235, 25, 35), width=26, bend=0.35):
    sx, sy = start
    ex, ey = end
    mx, my = (sx + ex) / 2, (sy + ey) / 2
    nx, ny = -(ey - sy), (ex - sx)
    cx, cy = mx + nx * bend, my + ny * bend
    pts = [((1 - t) ** 2 * sx + 2 * (1 - t) * t * cx + t * t * ex, (1 - t) ** 2 * sy + 2 * (1 - t) * t * cy + t * t * ey)
           for t in [i / 40 for i in range(41)]]
    ang = math.atan2(ey - pts[-4][1], ex - pts[-4][0])
    head = width * 2.4
    tri = [(ex + math.cos(ang) * head * 0.5, ey + math.sin(ang) * head * 0.5),
           (ex + math.cos(ang + 2.5) * head, ey + math.sin(ang + 2.5) * head),
           (ex + math.cos(ang - 2.5) * head, ey + math.sin(ang - 2.5) * head)]
    d = ImageDraw.Draw(c)
    d.line(pts[:-3], fill=(255, 255, 255), width=width + 14, joint="curve")
    d.polygon(tri, fill=(255, 255, 255), outline=(255, 255, 255), width=14)
    d.line(pts[:-3], fill=color, width=width, joint="curve")
    d.polygon(tri, fill=color)


def bursts(c, x, y, color, rng, n=3, size=70, angle0=-150):
    d = ImageDraw.Draw(c)
    for k in range(n):
        a = math.radians(angle0 + k * 32 + rng.uniform(-4, 4))
        r0, r1 = size * 0.45, size * (1.15 + 0.12 * (k % 2))
        p0 = (x + math.cos(a) * r0, y + math.sin(a) * r0)
        p1 = (x + math.cos(a) * r1, y + math.sin(a) * r1)
        d.line([p0, p1], fill=INK, width=22)
        d.line([p0, p1], fill=color, width=14)


def speed_lines(w, h, center, rng, n=150, r_min=520):
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    cx, cy = center
    for _ in range(n):
        a = rng.uniform(0, 2 * math.pi)
        r0 = rng.uniform(r_min, r_min + 380)
        r1 = r0 + rng.uniform(160, 520)
        d.line([(cx + math.cos(a) * r0, cy + math.sin(a) * r0), (cx + math.cos(a) * r1, cy + math.sin(a) * r1)],
               fill=(255, 255, 255, rng.randint(70, 170)), width=rng.randint(2, 7))
    return layer.filter(ImageFilter.GaussianBlur(0.8))


def t_hype(job, imgs, rng):
    glow = hexrgb(job.get("glow", "#FF2A2A"))
    under = hexrgb(job.get("underline", "#FF2D8A"))
    top, bottom = HYPE_FILLS.get(job.get("fill", "yellow"), HYPE_FILLS["yellow"])
    main = imgs["main"]
    # background: the clip's own gameplay, blurred and darkened, with a colour glow
    bg = cover(main, W, H).filter(ImageFilter.GaussianBlur(16))
    bg = Image.blend(bg, Image.new("RGB", (W, H), (12, 8, 20)), 0.58).convert("RGBA")
    gl = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(gl).ellipse([-200, -260, W + 200, 1100], fill=glow + (80,))
    bg.alpha_composite(gl.filter(ImageFilter.GaussianBlur(160)))
    c = bg
    # sharp gameplay across the bottom, fading up into the background
    gh = 900
    g = photo_finish(cover(main, W, gh), rng).convert("RGBA")
    fade = Image.linear_gradient("L").resize((W, 260))
    a = Image.new("L", (W, gh), 255)
    a.paste(fade, (0, 0))
    g.putalpha(a)
    c.alpha_composite(g, (0, H - gh))
    c.alpha_composite(speed_lines(W, H, (W // 2, 1150), rng, n=120, r_min=640))
    # streamer cut-out with white outline and colour glow
    por = imgs["portrait"]
    m = person_matte(por, job.get("erase"))
    por = decontaminate(por, m)
    bb = m.point(lambda v: 255 if v > 40 else 0).getbbox() or (0, 0, por.width, por.height)
    por, m = por.crop(bb), m.crop(bb)
    target_h = int(job.get("portrait_height", 960))
    s = min(target_h / por.height, 1040 / por.width)
    por = photo_finish(por.resize((round(por.width * s), round(por.height * s)), Image.LANCZOS), rng)
    m = m.resize(por.size, Image.LANCZOS)
    pad = 60
    cut = Image.new("RGBA", (por.width + 2 * pad, por.height + 2 * pad), (0, 0, 0, 0))
    mm = Image.new("L", cut.size, 0)
    mm.paste(m, (pad, pad))
    rw = int(job.get("rim", 0))
    solid = mm.point(lambda v: 255 if v > 110 else 0)
    rim = solid.filter(ImageFilter.MaxFilter(2 * rw + 1)).filter(ImageFilter.GaussianBlur(0.8)) if rw else Image.new("L", mm.size, 0)
    halo = solid.filter(ImageFilter.MaxFilter(2 * rw + 21)).filter(ImageFilter.GaussianBlur(20))
    cut.paste(Image.new("RGBA", cut.size, glow + (255,)), (0, 0), halo)
    cut.paste(Image.new("RGBA", cut.size, (255, 255, 255, 255)), (0, 0), rim)
    body = Image.new("RGBA", cut.size, (0, 0, 0, 0))
    body.paste(por.convert("RGBA"), (pad, pad))
    body.putalpha(mm)
    cut.alpha_composite(body)
    logo_side = job.get("logo_side", "left") if job.get("logo") else None
    shift = job.get("portrait_shift", 70 if logo_side == "left" else (-70 if logo_side == "right" else 0))
    px = int((W - cut.width) / 2 + shift)
    py = int(job.get("portrait_top", 10)) - pad
    c.alpha_composite(cut, (px, py))
    if logo_side == "left":
        bursts(c, min(W - 150, px + cut.width - pad - int(cut.width * 0.10)), py + pad + 140, hexrgb(job.get("burst", "#FFD21A")), rng, size=95, angle0=-80)
    else:
        bursts(c, px + pad + int(cut.width * 0.10), py + pad + 140, hexrgb(job.get("burst", "#FFD21A")), rng, size=95)
    # optional user-supplied logo (never recreated here)
    if job.get("logo"):
        lg = Image.open(os.path.join(ROOT, job["logo"]) if not os.path.isabs(job["logo"]) else job["logo"]).convert("RGBA")
        lg = lg.crop(lg.getchannel("A").getbbox())
        lw = int(job.get("logo_width", 300))
        lg = lg.resize((lw, round(lg.height * lw / lg.width)), Image.LANCZOS)
        lg, lp = drop_shadow(lg, 0, 6, 10, 150)
        c.alpha_composite(lg, (36 - lp, 44 - lp) if logo_side == "left" else (W - lw - 36 - lp, 44 - lp))
    # headline
    l1, l2 = job["headline"][0].upper(), job["headline"][-1].upper()
    hy = int(job.get("headline_y", 900))
    f1 = fit_font(MONT, l1, 980, 150)
    t1, p1 = drop_shadow(text_layer(l1, f1, (255, 255, 255), stroke=12, stroke_fill=INK))
    emo = job.get("emoji", "")
    emo_w = 150 if emo else 0
    f2 = fit_font(MONT, l2, 980 - emo_w, 175)
    t2, p2 = drop_shadow(gradient_text(l2, f2, top, bottom, stroke=13))
    x1 = (W - (t1.width - 2 * p1)) // 2 - p1
    c.alpha_composite(t1, (x1, hy - p1))
    y2 = hy + t1.height - 2 * p1 + 10
    line2_w = t2.width - 2 * p2 + (emo_w + 10 if emo else 0)
    x2 = (W - line2_w) // 2 - p2
    br = brush(int((t2.width - 2 * p2) * 1.05), 46, under, rng)
    c.alpha_composite(br, (x2 + p2 - 10, y2 + t2.height - 2 * p2 - 20))
    c.alpha_composite(t2, (x2, y2 - p2))
    if emo:
        e = emoji_layer(emo, emo_w)
        c.alpha_composite(e, (x2 + t2.width - p2 + 4, y2 + (t2.height - 2 * p2 - e.height) // 2 + 6))
    # optional arrow from under the headline to a point on the gameplay (fractions of the canvas)
    if job.get("arrow"):
        a0 = job["arrow"].get("from", [0.62, 0.66])
        a1 = job["arrow"]["to"]
        arrow(c, (a0[0] * W, a0[1] * H), (a1[0] * W, a1[1] * H), bend=job["arrow"].get("bend", 0.3))
    # optional inset reaction box
    if "second" in imgs:
        box = framed(imgs["second"], 300, 300, rng, border=10, border_color=(235, 25, 35))
        place(c, box, (30, 1300), angle=-3, shadow=(0, 0, 0))
    return c


TEMPLATES = {"poster": t_poster, "blocks": t_blocks, "tabloid": t_tabloid, "hype": t_hype}


def main():
    job = json.load(open(sys.argv[1]))
    out = job["out"]
    if not os.path.isabs(out):
        out = os.path.join(ROOT, out)
    for ext in (".png", ".jpg"):
        if os.path.exists(out + ext):
            sys.exit(f"refusing to overwrite {out + ext}; bump the version")
    rng = random.Random(job.get("seed", 1))
    with tempfile.TemporaryDirectory() as tmp:
        imgs = {k: load_image(v, tmp) for k, v in job["images"].items()}
        img = TEMPLATES[job["template"]](job, imgs, rng).convert("RGB")
    assert img.size == (W, H)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    img.save(out + ".png", optimize=True)
    img.save(out + ".jpg", quality=92, subsampling=0)
    print(f"{job['template']}: {out}.png / .jpg  {img.size[0]}x{img.size[1]}  headline: {' / '.join(job['headline'])}")


if __name__ == "__main__":
    main()
