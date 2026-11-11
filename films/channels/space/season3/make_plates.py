"""make_plates.py: builds the code-made plates behind the fixed file names in films/channels/space/long01/art/ (see art/README.md):
plate-beach(.png/-9x16), plate-flood(.png/-9x16), moon-disc.png, eclipse.png, ring.png, plate-tonight / plate-close / plate-breakup (the owner's paintings, upscaled).
A new painting dropped over any of these names replaces only that scene; the engine reads the files, nothing else."""
import math, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
ART = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "long01", "art"); S = float(sys.argv[1]) if len(sys.argv) > 1 else 1.0
SCR = "/tmp/claude-0/-home-user-claude/d2319708-075e-564f-9ac4-badc9d86ce7f/scratchpad/art/"
rng = np.random.default_rng(7)
def up(im, w=2560, h=1440): return im.resize((w, h), Image.LANCZOS)
# ---- the owner's paintings (1672x941), upscaled for the 2560x1440 master
for src, dst in (("moon-01-tonight.webp", "plate-tonight.png"), ("moon-02-close.webp", "plate-close.png"), ("moon-03-breakup.webp", "plate-breakup.png")):
    up(Image.open(f"{ART}/{src}").convert("RGB")).save(f"{ART}/{dst}")
# ---- plate-beach: moon-01 with its painted Moon painted out (the Moon is its own layer in the engine)
base_full = Image.open(SCR + "beach_nomoon.png").convert("RGB")        # 1672x941, the figure still in it (the sprite layer is cut from this)
_b = np.asarray(base_full).astype(float).copy()
for y in range(740, 824):                                              # the figure comes out of the plate (the engine draws it as its own upright layer)
    L = _b[y, 546:550].mean(axis=0); Rr = _b[y, 594:598].mean(axis=0)
    for x in range(550, 595): u = (x - 550) / 44.0; _b[y, x] = L * (1 - u) + Rr * u
base = Image.fromarray(np.clip(_b, 0, 255).astype("uint8"))
up(base).save(f"{ART}/plate-beach.png")
# ---- plate-flood: the same beach with the sea over the sand (the engine wipes it up the beach between stages)
a = np.asarray(base).astype(float); H, W, _ = a.shape; fl = a.copy(); y_sea0, y_sea1 = 690, 744
for y in range(744, H):
    k = (y - 744) * 0.33; ph = (y_sea0 + (k % (2 * (y_sea1 - y_sea0)))) if (k % (2 * (y_sea1 - y_sea0))) < (y_sea1 - y_sea0) else (y_sea1 - ((k % (2 * (y_sea1 - y_sea0))) - (y_sea1 - y_sea0)))
    row = a[int(ph)]; shift = int(14 * math.sin(y / 23.0)); fl[y] = np.roll(row, shift, axis=0) * (1.0 - 0.00055 * (y - 744)) + 6 * math.sin(y / 9.0)
fx0, fx1, fy0, fy1 = 548, 596, 742, 822                                  # the small figure stays (standing in the water now)
fx0, fx1 = 555, 588
sub = a[fy0:fy1, fx0:fx1]; lum = sub.mean(axis=2); fm = (lum < 46).astype(float); fm = np.asarray(Image.fromarray((fm * 255).astype("uint8")).filter(ImageFilter.GaussianBlur(1.1))).astype(float)[..., None] / 255
fl[fy0:fy1, fx0:fx1] = fl[fy0:fy1, fx0:fx1] * (1 - fm) + sub * fm
fl[806:fy1, fx0 - 8:fx1 + 8] = fl[806:fy1, fx0 - 8:fx1 + 8] * 0.8 + np.array([12, 44, 56]) * 0.2
fl = np.clip(fl + rng.normal(0, 1.2, fl.shape), 0, 255).astype("uint8"); flood = Image.fromarray(fl); up(flood).save(f"{ART}/plate-flood.png")
# ---- the small figure as its own layer (alpha from its dark silhouette), so the engine can keep it un-warped on top of the moving sea
fa = np.zeros((941, 1672, 4)); sub0 = np.asarray(base_full).astype(float)[742:822, 555:588]; lum0 = sub0.mean(axis=2); m0 = (lum0 < 46).astype(float)
m0 = np.asarray(Image.fromarray((m0 * 255).astype("uint8")).filter(ImageFilter.GaussianBlur(0.9))).astype(float)
fa[742:822, 555:588, :3] = sub0; fa[742:822, 555:588, 3] = m0
fig = Image.fromarray(fa.astype("uint8"), "RGBA"); fig.resize((2560, 1440), Image.LANCZOS).save(f"{ART}/figure-layer.png")
sc0 = 1000 / 941; fr = fig.resize((int(1672 * sc0), 1000), Image.LANCZOS).crop((150, 0, 1230, 1000)); fp = Image.new("RGBA", (1080, 1920), (0, 0, 0, 0)); fp.paste(fr, (0, 475)); fp.save(f"{ART}/figure-layer-9x16.png")
# ---- portrait versions (own composition): the painting in the middle, sky and sea extended in code
def portrait(img, name):
    sc = 1000 / img.height; w = int(img.width * sc); r = img.resize((w, 1000), Image.LANCZOS); x0 = 150
    r = r.crop((x0, 0, x0 + 1080, 1000)); out = Image.new("RGB", (1080, 1920)); px = np.asarray(r).astype(float)
    top = px[:6].mean(axis=(0, 1)); bot = px[-6:].mean(axis=(0, 1)); arr = np.zeros((1920, 1080, 3))
    y0 = 475; arr[y0:y0 + 1000] = px
    for y in range(0, y0): t = y / y0; arr[y] = top * (0.55 + 0.45 * t)
    for y in range(y0 + 1000, 1920):                                       # the sea/sand goes on below the painting: its last rows, mirrored and rolled, darkening a little
        t = (y - y0 - 1000); k = int(t * 0.55) % 80; src = (y0 + 999 - k) if (int(t * 0.55) // 80) % 2 == 0 else (y0 + 999 - (79 - k))
        sh = int(18 * math.sin(y / 31.0)); row = np.roll(arr[src], sh, axis=0)
        if sh > 0: row[:sh] = row[sh]
        elif sh < 0: row[sh:] = row[sh - 1]
        arr[y] = row * (1.0 - 0.0002 * t)
    ext = Image.fromarray(np.clip(arr[y0 + 1000:], 0, 255).astype("uint8")).filter(ImageFilter.GaussianBlur(2.2)); arr[y0 + 1000:] = np.asarray(ext).astype(float)
    arr[y0:y0 + 1000] = px
    for i in range(70):                                                  # feather the seams
        t = i / 70.0; arr[y0 + i] = arr[y0 + i] * t + arr[y0 - 1] * (1 - t) * (1 - t) + arr[y0 + i] * (1 - t) * (1 - t) * 0 if False else arr[y0 + i]
    g = rng.normal(0, 1.3, arr.shape); arr = np.clip(arr + g, 0, 255).astype("uint8"); im = Image.fromarray(arr)
    st = ImageDraw.Draw(im)
    for _ in range(140):                                                 # stars in the extended sky
        x, y = rng.random() * 1080, rng.random() * (y0 - 20); s = rng.choice([1, 1, 1.5, 2]); st.ellipse((x - s, y - s, x + s, y + s), fill=(225, 232, 255))
    m = Image.new("L", (1080, 1920), 0); md = ImageDraw.Draw(m); md.rectangle((0, y0 - 40, 1080, y0 + 60), fill=255); im2 = im.filter(ImageFilter.GaussianBlur(14)); im.paste(im2, (0, 0), m)
    im.save(f"{ART}/{name}")
portrait(base, "plate-beach-9x16.png"); portrait(flood, "plate-flood-9x16.png")
# ---- moon-disc.png (+ a 4096 version for when the Moon fills the sky): the near side with its real pattern of dark seas, in the paintings' teal and violet
def make_moon(N, name):
    R = N / 2 - 8; k = N / 2048.0; yy, xx = np.mgrid[0:N, 0:N]; u = (xx - N / 2) / R; v = -(yy - N / 2) / R; rr = np.hypot(u, v); inside = rr <= 1.0
    light = np.zeros((N, N, 3)); lit = (0.74 + 0.26 * (1 - rr ** 2)) * (0.96 + 0.08 * (rng.random((N, N)) if False else 0.5)); base_c = np.array([206, 232, 226.0]); light[:] = base_c
    mare = np.zeros((N, N))
    LF = np.asarray(Image.fromarray((np.random.default_rng(5).random((14, 14)) * 255).astype('uint8')).resize((N, N), Image.BICUBIC)).astype(float) / 255 - 0.5
    for (cx, cy, rx, ry, ang, s) in ((-0.42, 0.40, 0.30, 0.24, 0.2, 1.0), (0.14, 0.50, 0.15, 0.13, 0, 0.9), (0.33, 0.20, 0.22, 0.15, -0.2, 0.9), (0.66, 0.34, 0.12, 0.09, 0.3, 1.0), (0.56, -0.08, 0.13, 0.17, 0.2, 0.7), (-0.78, 0.05, 0.22, 0.52, 0.1, 0.95), (-0.28, -0.38, 0.22, 0.14, 0, 0.8), (-0.60, -0.40, 0.12, 0.11, 0, 0.9), (0.0, 0.84, 0.36, 0.06, 0, 0.6), (-0.52, 0.55, 0.12, 0.08, 0, 0.7), (0.18, -0.16, 0.10, 0.08, 0, 0.7)):
        ca, sa = math.cos(ang), math.sin(ang); du, dv = u - cx, v - cy; e = ((du * ca + dv * sa) / rx) ** 2 + ((-du * sa + dv * ca) / ry) ** 2
        mare = np.maximum(mare, s * np.clip(1.15 - e + 0.9 * LF, 0, 1) ** 0.6)
    noise = Image.fromarray((rng.random((64, 64)) * 255).astype("uint8")).resize((N, N), Image.BICUBIC); nz = (np.asarray(noise).astype(float) / 255 - 0.5)
    mare = np.clip(mare * (0.85 + 0.5 * nz), 0, 1); mare_c = np.array([92, 120, 152.0])
    light = light * (1 - mare[..., None] * 0.80) + mare_c * (mare[..., None] * 0.80)
    spk = np.asarray(Image.fromarray((np.random.default_rng(9).random((N // 4, N // 4)) * 255).astype('uint8')).resize((N, N), Image.BICUBIC)).astype(float) / 255 - 0.5
    img = Image.fromarray(np.clip(light * lit[..., None] * (1 + 0.10 * spk[..., None]) * (0.9 if N > 3000 else 1.0), 0, 255).astype("uint8")).convert("RGB"); d = ImageDraw.Draw(img, "RGBA")
    cr = np.random.default_rng(11)
    for _ in range(int(260 * k * k)):                                                    # craters (soft dark floor, light rim)
        t = cr.random() ** 1.7; rcrat = (6 + t * 70) * k; ang = cr.random() * 6.283; rad = math.sqrt(cr.random()) * 0.97; cx = N / 2 + math.cos(ang) * rad * R; cy = N / 2 + math.sin(ang) * rad * R
        d.ellipse((cx - rcrat, cy - rcrat, cx + rcrat, cy + rcrat), fill=(96, 116, 146, 12)); d.ellipse((cx - rcrat, cy - rcrat, cx + rcrat, cy + rcrat), outline=(240, 252, 248, 34), width=max(1, int(rcrat / 14)))
    for (bx, by, br) in ((-0.20, -0.80, 60), (-0.35, 0.18, 42), (-0.55, 0.45, 30)):    # Tycho, Copernicus, Kepler: bright, small
        cx = N / 2 + bx * R; cy = N / 2 - by * R; d.ellipse((cx - br, cy - br, cx + br, cy + br), fill=(244, 252, 250, 120))
        for k in range(14): a2 = k * 0.449; d.line((cx, cy, cx + math.cos(a2) * br * 7, cy + math.sin(a2) * br * 7), fill=(240, 250, 248, 22), width=max(1, int(3 * k)))
    arr = np.asarray(img).astype(float); vio = np.clip((u * -0.5 + v * -0.6 + 0.2), 0, 1) ** 1.4; arr = arr * (1 - 0.30 * vio[..., None]) + np.array([112, 92, 190.0]) * 0.30 * vio[..., None]
    alpha = np.clip((1.0 - rr) * R / 3.0, 0, 1) * 255
    Image.fromarray(np.dstack([np.clip(arr, 0, 255), alpha]).astype("uint8"), "RGBA").save(f"{ART}/{name}")

make_moon(2048, 'moon-disc.png'); make_moon(4096, 'moon-disc-hi.png')
# ---- eclipse.png: the corona glow around a dark disc (the engine draws the disc; this is the faint light at its edge)
E = 2048; yy, xx = np.mgrid[0:E, 0:E]; r = np.hypot(xx - E / 2, yy - E / 2) / (E / 2 * 0.5)
glow = np.clip(1.6 - np.abs(r - 1.0) * 5.0, 0, 1) ** 2.2 * 0.5 + np.clip(1.4 - r, 0, 1) ** 3 * 0.12 * (r > 1)
rays = (0.5 + 0.5 * np.cos(np.arctan2(yy - E / 2, xx - E / 2) * 9 + 1.0)) * np.clip(1.5 - r, 0, 1) * (r > 1.0) * 0.08
c = np.clip(glow + rays, 0, 1); Image.fromarray(np.dstack([np.full((E, E), 235), np.full((E, E), 242), np.full((E, E), 255), c * 255]).astype("uint8"), "RGBA").save(f"{ART}/eclipse.png")
# ---- ring.png: the ring seen from the ground, a thin silver band from horizon to horizon (long film only)
RW, RH = 2560, 1440; ring = Image.new("RGBA", (RW, RH), (0, 0, 0, 0)); rd = ImageDraw.Draw(ring)
pts = [(int(x), int(760 - 520 * math.sin(math.pi * max(0, min(RW, x)) / RW) ** 0.8)) for x in range(-20, RW + 21, 8)]
for k, (wid, al) in enumerate(((70, 20), (40, 40), (18, 90), (6, 200))): rd.line(pts, fill=(205, 236, 244, al), width=wid, joint="curve")
ring = ring.filter(ImageFilter.GaussianBlur(2)); rg = np.asarray(ring).astype(float); rg[..., 3] *= (0.85 + 0.15 * rng.random(rg.shape[:2])); Image.fromarray(rg.astype("uint8"), "RGBA").save(f"{ART}/ring.png")
print("plates written to", os.path.abspath(ART))
