"""make_plates_v2.py: the owner's nine new paintings (11 Nov 2026, long01/art/owner/) -> the plates the engine reads.
Lanczos upscale + gentle sharpening. The originals stay in art/owner/. usage: python3 -I make_plates_v2.py [stills]"""
import os, re, sys
import numpy as np
from PIL import Image, ImageFilter, ImageDraw
ART = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "long01", "art")); OWN = ART + "/owner"
SRC = {1: "Lone figure on a moonless indigo beach-1.png", 2: "Painterly Earth-Facing Full Moon-2.png", 4: "Rising Tide, Indigo Night-4.png", 5: "At the new waterline-5.png",
       6: "Oversized Eclipse Over the Quiet Shore-6.png", 7: "Oversized Eclipse Over a Quiet Indigo Shore-7.png", 8: "Stretched Moon Over the Rising Sea-8.png",
       9: "Solitary Figure Beneath a Giant Moon-9.png", 10: "Quiet Beach Beneath a Planetary Ring-10.png"}
def src(n):
    for d in (OWN, ART):
        if os.path.exists(f"{d}/{SRC[n]}"): return Image.open(f"{d}/{SRC[n]}").convert("RGB")
    raise FileNotFoundError(SRC[n])
def up(im, size):
    return im.resize(size, Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=1.4, percent=55, threshold=3))
os.makedirs(OWN, exist_ok=True)
for n, f in SRC.items():                                   # keep the originals in art/owner/
    if os.path.exists(f"{ART}/{f}"): os.replace(f"{ART}/{f}", f"{OWN}/{f}")
# 16:9 plates (2560x1440)
up(src(4), (2560, 1440)).save(f"{ART}/plate-flood.png")        # painting 4: the rising tide
up(src(6), (2560, 1440)).save(f"{ART}/plate-eclipse.png")      # painting 6: the eclipse scene
up(src(9), (2560, 1440)).save(f"{ART}/plate-close.png")        # painting 9: the Moon about 9.6x wider
up(src(8), (2560, 1440)).save(f"{ART}/plate-breakup.png")      # painting 8: the stretch
up(src(10), (2560, 1440)).save(f"{ART}/plate-ring.png")        # painting 10: the ring
# 9:16 plates (1080x1920)
up(src(1), (1080, 1920)).save(f"{ART}/plate-beach-9x16.png"); up(src(5), (1080, 1920)).save(f"{ART}/plate-flood-9x16.png"); up(src(7), (1080, 1920)).save(f"{ART}/plate-eclipse-9x16.png")
# the Moon: painting 2 (near side, north up: Tycho at the bottom, Crisium on the right) keyed out of its black
m = src(2); a = np.asarray(m).astype(float).mean(axis=2); ys, xs = np.where(a > 24); x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
cx, cy, r = (x0 + x1) / 2, (y0 + y1) / 2, ((x1 - x0) + (y1 - y0)) / 4
side = int(2 * r) + 2; box = (int(cx - side / 2), int(cy - side / 2), int(cx - side / 2) + side, int(cy - side / 2) + side); crop = m.crop(box)
yy, xx = np.mgrid[0:side, 0:side]; dist = np.hypot(xx - side / 2, yy - side / 2) / (side / 2 - 1)
alpha = np.clip((1.0 - dist) / 0.012, 0, 1)                    # a soft 1.2% limb edge
rgba = np.dstack([np.asarray(crop), (alpha * 255).astype("uint8")]); disc = Image.fromarray(rgba, "RGBA")
disc.resize((2048, 2048), Image.LANCZOS).save(f"{ART}/moon-disc.png"); disc.resize((2560, 2560), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=2, percent=40, threshold=3)).save(f"{ART}/moon-disc-hi.png")
print("moon disc", side, "px;", "plates written")

# ---- the figure comes out of the plates that carry moving water (so the sea can ripple without bending it) and is drawn as its own upright layer
from scipy import ndimage as ndi
def remove_box(im, box):
    """paint the figure out with the neighbouring texture (the same rows, a figure-width to the right), feathered; the sea's foam lines carry on"""
    a = np.asarray(im).astype(float); x0, y0, x1, y1 = box; w = x1 - x0 + 8; dx = w + 10
    out = a.copy(); m = np.zeros(a.shape[:2]); m[y0 - 2:y1 + 3, x0 - 4:x1 + 5] = 1; m = ndi.gaussian_filter(m, 2.2)[..., None]
    shifted = np.roll(a, -dx, axis=1); shifted = shifted * 0.85 + ndi.uniform_filter(a, size=(1, 25, 1)) * 0.15
    # match the local brightness of the patch to what surrounds the hole, row by row
    for y in range(y0 - 2, y1 + 3):
        ref = a[y, [x0 - 9, x0 - 8, x0 - 7, x1 + 7, x1 + 8, x1 + 9]].mean(axis=0); got = shifted[y, [x0 - 9, x0 - 8, x0 - 7, x1 + 7, x1 + 8, x1 + 9]].mean(axis=0); shifted[y, x0 - 8:x1 + 9] += (ref - got) * 0.7
    out = a * (1 - m) + shifted * m
    return Image.fromarray(np.clip(out, 0, 255).astype("uint8"))
def figure_layer(orig, clean, box, size, scale):
    x0, y0, x1, y1 = box; o = np.asarray(orig).astype(float); c = np.asarray(clean).astype(float)
    d = np.abs(o - c).mean(axis=2); al = np.zeros(d.shape); al[y0:y1 + 1, x0 - 3:x1 + 4] = np.clip((d[y0:y1 + 1, x0 - 3:x1 + 4] - 5) / 16, 0, 1)
    al = ndi.gaussian_filter(al, 0.7); rgba = np.dstack([o, al * 255]).astype("uint8"); im = Image.fromarray(rgba, "RGBA")
    return im.resize((int(im.width * scale), int(im.height * scale)), Image.LANCZOS)
FIG = {1: (338, 1310, 380, 1399), 5: (316, 1484, 358, 1596), 7: (338, 1311, 380, 1399), 4: (544, 796, 584, 906)}
def clean_up(n, size):
    im = src(n); cl = remove_box(im, FIG[n]); return im, cl
# portrait: beach (1), flood (5), eclipse scene (7) cleaned; the figure layer from painting 1
im1, cl1 = clean_up(1, (1080, 1920)); up(cl1, (1080, 1920)).save(f"{ART}/beach-clean-9x16.png")
fl = figure_layer(im1, cl1, FIG[1], None, 1080 / 941); fp = Image.new("RGBA", (1080, 1920), (0, 0, 0, 0)); fp.alpha_composite(fl); fp.save(f"{ART}/figure-layer-9x16.png")
_, cl5 = clean_up(5, None); up(cl5, (1080, 1920)).save(f"{ART}/flood-clean-9x16.png")
_, cl4 = clean_up(4, None); up(cl4, (2560, 1440)).save(f"{ART}/flood-clean.png")
# the eclipse as a sprite (2048 px, the black disc's radius 512 px), cut from paintings 6 (16:9) and 7 (9:16): the engine puts it at its own Moon position and size
def eclipse_sprite(n, out):
    im = src(n); a = np.asarray(im).astype(float).mean(axis=2); lab, k = ndi.label(a < 26)
    sizes = ndi.sum(np.ones_like(a), lab, range(1, k + 1)); j = int(np.argmax(sizes)) + 1; ys, xs = np.where(lab == j)
    cx, cy, r = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2, ((xs.max() - xs.min()) + (ys.max() - ys.min())) / 4; s = 512 / r
    big = im.resize((int(im.width * s), int(im.height * s)), Image.LANCZOS).convert("RGBA"); sp = Image.new("RGBA", (2048, 2048), (0, 0, 0, 0)); sp.paste(big, (int(1024 - cx * s), int(1024 - cy * s)))
    # the painted black disc and its inner corona (the painting ends 1.3 disc-radii above the disc, so only that much is usable) over the code-made outer glow
    yy, xx = np.mgrid[0:2048, 0:2048]; d = np.hypot(xx - 1024, yy - 1024) / 512; al = np.clip((1.27 - d) / 0.17, 0, 1)
    arr = np.asarray(sp).copy(); arr[..., 3] = (arr[..., 3] * al).astype("uint8"); base = Image.open(f"{ART}/eclipse-code.png").convert("RGBA")
    base.alpha_composite(Image.fromarray(arr, "RGBA")); base.save(out); return cx, cy, r
print("eclipse 6:", eclipse_sprite(6, f"{ART}/eclipse.png"), "eclipse 7:", eclipse_sprite(7, f"{ART}/eclipse-9x16.png"))

# the code-made 16:9 beach has a painted moonglint on the water at the old Moon position: patch it out (the engine draws the glitter path under the Moon wherever it is)
bch = Image.open(f"{ART}/plate-beach.png").convert("RGB"); a = np.asarray(bch).astype(float); W2, H2 = bch.size
def patch_region(a, fx0, fx1, fy0, fy1, shift_frac, feather=14, match=0.6):
    x0, x1, y0, y1 = int(fx0 * W2), int(fx1 * W2), int(fy0 * H2), int(fy1 * H2); w = x1 - x0; dx = int(shift_frac * W2) if shift_frac else w + 40
    patch = np.roll(a, -dx, axis=1); m = np.zeros(a.shape[:2]); m[y0:y1, x0:x1] = 1; m = ndi.gaussian_filter(m, feather)[..., None]
    for y in range(y0, y1):
        ref = a[y, [x0 - 30, x0 - 20, x1 + 20, x1 + 30]].mean(axis=0); got = patch[y, [x0 - 30, x0 - 20, x1 + 20, x1 + 30]].mean(axis=0); patch[y, x0 - 30:x1 + 30] += (ref - got) * match
    return a * (1 - m) + patch * m
a = patch_region(a, 0.60, 0.775, 0.70, 0.975, 0)                  # the moonglint on the water
a = patch_region(a, 0.55, 0.77, 0.10, 0.46, -0.30, 40, 0.9)       # the faint ghost of the painted-out Moon (copy sky from the left)
Image.fromarray(np.clip(a, 0, 255).astype("uint8")).save(f"{ART}/beach-clean.png"); print("beach-clean written")
