"""Cover variants with OUR capsule mannequin instead of the owner's glossy figure (cover-options/pN-capsule.jpg): the glossy figure is segmented (GrabCut) and painted out (inpaint),
the capsule (art/capsule/*.png, from capsule.py) is composited at the same small size and spot with a contact shadow, a rim light from the picture's Sun and matched grain.
  python3 -I .../parts/capsule_cover.py [3 5 6 7]"""
import sys
from pathlib import Path
import cv2, numpy as np
from PIL import Image, ImageDraw, ImageFilter
sys.path.insert(0, str(Path(__file__).resolve().parent))
import art_cover as A
SPEC = {   # part: (source image, glossy figure box x0,y0,x1,y1 in source px, capsule png, rim colour or None, flip)
 3: ("storm", (385, 455, 580, 625), "lean", (170, 200, 240), False),
 5: ("storm", (385, 455, 580, 625), "lean", (170, 200, 240), False),
 6: ("arc1", (488, 846, 560, 1022), "stand", (255, 170, 70), False),
 7: ("arc2", (436, 905, 504, 1064), "stand", (255, 170, 70), False),
}
def variant(part):
    srcname, (x0, y0, x1, y1), pose, rim, flip = SPEC[part]; im = A.load({"storm": "storm-fury.png", "arc1": "sunrises-arc-1.png", "arc2": "sunrises-arc-2.png"}[srcname])
    a = cv2.cvtColor(np.asarray(im), cv2.COLOR_RGB2BGR); h, w = a.shape[:2]
    mask = np.zeros((h, w), np.uint8); gc = np.zeros((h, w), np.uint8); gc[:] = cv2.GC_BGD
    gc[y0:y1, x0:x1] = cv2.GC_PR_BGD; gc[y0 + 8:y1 - 4, (x0 + x1) // 2 - 6:(x0 + x1) // 2 + 6] = cv2.GC_FGD
    cv2.grabCut(a, gc, None, np.zeros((1, 65)), np.zeros((1, 65)), 6, cv2.GC_INIT_WITH_MASK)
    mask[(gc == cv2.GC_FGD) | (gc == cv2.GC_PR_FGD)] = 255; mask = cv2.dilate(mask, np.ones((5, 5), np.uint8), iterations=2)
    clean = cv2.inpaint(a, mask, 7, cv2.INPAINT_TELEA)
    base = Image.fromarray(cv2.cvtColor(clean, cv2.COLOR_BGR2RGB)).convert("RGBA")
    cap = Image.open(A.ES / f"art/capsule/{pose}.png").convert("RGBA")
    if flip: cap = cap.transpose(Image.FLIP_LEFT_RIGHT)
    H = int((y1 - y0) * 0.95); cap = cap.resize((int(cap.width * H / cap.height), H), Image.LANCZOS)
    arr = np.asarray(cap).astype(np.float32); al = arr[..., 3:] / 255.0
    yy = np.linspace(1, 0, cap.height)[:, None, None]                                  # warm rim from the Sun above the figure
    arr[..., :3] = np.clip(arr[..., :3] * (0.78 + 0.1 * (1 - yy)) + np.array(rim, np.float32) * 0.22 * (yy ** 2) * 1.0, 0, 255)
    cap = Image.fromarray(np.dstack([arr[..., :3], al[..., 0] * 255]).astype(np.uint8), "RGBA").filter(ImageFilter.GaussianBlur(0.7))
    fx, fy = (x0 + x1) // 2, y1 - 6                                                     # the feet where the glossy figure stood
    sh = Image.new("RGBA", base.size, (0, 0, 0, 0)); sw = int(cap.width * 1.1)
    ell = Image.new("L", base.size, 0);     ImageDraw.Draw(ell).ellipse((fx - sw // 2, fy - 4, fx + sw // 2, fy + 8), fill=120); ell = ell.filter(ImageFilter.GaussianBlur(4))
    base.alpha_composite(Image.merge("RGBA", (Image.new("L", base.size, 0),) * 3 + (ell,)))
    base.alpha_composite(cap, (fx - cap.width // 2, fy - cap.height))
    out = np.asarray(base.convert("RGB")).astype(np.float32); out += np.random.default_rng(3).normal(0, 2.2, out.shape)       # grain like the photo
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))
if __name__ == "__main__":
    for n in [int(x) for x in sys.argv[1:]] or list(SPEC):
        im2 = variant(n); _, box, lines = A.BOXES[n]
        out = A.cover(n, im2, box, lines, save_to=False); d = A.W / f"ep{12 + n}/out/cover-options"; A.save(out, d / f"p{n}-capsule.jpg")
        out.crop((0, 240, 1080, 1680)).save(d / f"p{n}-capsule-grid-3x4.jpg", quality=90); print("p", n, "capsule cover ->", d)
