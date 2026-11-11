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
