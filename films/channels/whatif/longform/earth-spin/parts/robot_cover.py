"""Covers and the long-film thumbnail with the visor robot lit into the owner's images (CHARACTER.md): the glossy figure is segmented (GrabCut) and painted out (inpaint),
the robot is rendered (robot/render.mjs, transparent, 4x) with the light of that image, and composited at the figure's spot. Same words, 3:4-safe layout, AI-illustration line in the posting copy.
  python3 -I .../parts/robot_cover.py [1 2 3 ... thumb]      (old covers are kept as cover-options/pN-glossy.jpg)"""
import json, os, shutil, subprocess, sys
from pathlib import Path
import cv2, numpy as np
from PIL import Image, ImageDraw, ImageFilter
sys.path.insert(0, str(Path(__file__).resolve().parent))
import art_cover as A
SRC = {"storm": "storm-fury.png", "arc1": "sunrises-arc-1.png", "arc2": "sunrises-arc-2.png", "sun": "sun-streak-90-minute-day.png", "sea": "oceans-bulge-equator.png", "float": "float-8x-lighter.png", "earth": "earth-spin-figure.png"}
STORM = dict(key=[2, 2.5, 3], keyK=2.4, rim=[-3, 1.5, -2.5], rimColor="#5aa0ff", rimK=3.2, warm=[3, 1.2, -1], warmK=0.8, warmColor="#ffc890", env=dict(top="#02050b", bot="#10203a"))
ARC = dict(key=[0.4, 3.5, 2.8], keyK=1.7, keyColor="#fff4e6", rim=[0, 2.2, -3], rimColor="#ffa24a", rimK=3.0, warm=[0, 1, -3], warmK=1.2, warmColor="#ffb060", fillK=0.9, env=dict(top="#1d1d22", bot="#34343a", key="#ffffff", rim="#ffb060", warmK=1.0))
SUN = dict(key=[2.6, 3, 2.4], keyK=2.4, rim=[-3, 1.6, -2.5], rimColor="#8fb8ff", rimK=2.4, env=dict(top="#0a1222", bot="#222a38"))
# part: (source, glossy figure bbox, feet (x,y) in source px, cover box, lines, robot pose/expr, robot height as a fraction of the output height, light, ground shadow)
SPEC = {   # robot heights: P2 and the thumbnail small (about 18-22 %)

 1: ("earth", (400, 484, 540, 624), (470, 618), (0, -300, 941, 1372), ["17 SUNRISES", "A DAY"], dict(pose="armsOut", expr="happy"), 0.17, STORM, False),
 2: ("sun", (455, 372, 565, 716), (510, 708), (350, -40, 910, 956), ["Sunset in", "6 hours"], dict(pose="lookUp", expr="awe"), 0.18, SUN, True),
 3: ("storm", (385, 455, 580, 625), (505, 614), (0, -250, 941, 1422), ["1,670 km/h", "wind"], dict(pose="lean", expr="squint"), 0.18, STORM, False),
 4: ("sea", None, (836, 38), (236, -900, 1436, 1233), ["Seas pile", "up here"], dict(pose="hips", expr="wide"), 0.14, STORM, False),
 5: ("storm", (385, 455, 580, 625), (505, 614), (60, -260, 881, 1327), ["Calm afternoons", "end"], dict(pose="lean", expr="squint"), 0.19, STORM, False),
 6: ("arc1", (488, 846, 560, 1022), (524, 1016), (103, 0, 947, 1500), ["6,000 days", "a year"], dict(pose="lookUp", expr="awe"), 0.17, ARC, True),
 7: ("arc2", (436, 905, 504, 1064), (470, 1058), (0, 0, 941, 1672), ["Sunset", "in 1 hour"], dict(pose="lookUp", expr="awe"), 0.17, ARC, True),
 8: ("float", (815, 70, 1215, 660), (990, 652), (536, -446, 1483, 1238), ["Jump 4", "meters high"], dict(pose="float", expr="happy"), 0.22, SUN, False),
}
def clean(img, bbox, refl=None, pink=None):
    a = cv2.cvtColor(np.asarray(img), cv2.COLOR_RGB2BGR); h, w = a.shape[:2]
    if bbox is None: return img
    x0, y0, x1, y1 = bbox; gc = np.zeros((h, w), np.uint8); gc[:] = cv2.GC_BGD; gc[y0:y1, x0:x1] = cv2.GC_PR_BGD
    gc[y0 + 8:y1 - 4, (x0 + x1) // 2 - 6:(x0 + x1) // 2 + 6] = cv2.GC_FGD
    cv2.grabCut(a, gc, None, np.zeros((1, 65)), np.zeros((1, 65)), 6, cv2.GC_INIT_WITH_MASK)
    m = np.where((gc == cv2.GC_FGD) | (gc == cv2.GC_PR_FGD), 255, 0).astype(np.uint8); m = cv2.dilate(m, np.ones((5, 5), np.uint8), iterations=2)
    if refl:                                                    # the figure's reflection on a glossy floor: saturated blue pixels under the feet
        rx0, ry0, rx1, ry1 = refl; blue = (a[..., 0].astype(int) > a[..., 2].astype(int) + 22) & (a[..., 0] > 60); r = np.zeros((h, w), bool); r[ry0:ry1, rx0:rx1] = True
        m[(blue & r)] = 255; m = cv2.dilate(m, np.ones((5, 5), np.uint8), iterations=2)
    if pink:                                                    # magenta residue (rim glow, specks) near the figure
        qx0, qy0, qx1, qy1 = pink; pk = (a[..., 2].astype(int) > a[..., 1].astype(int) + 25) & (a[..., 0].astype(int) > a[..., 1].astype(int) + 25) & (a[..., 2] > 70); q = np.zeros((h, w), bool); q[qy0:qy1, qx0:qx1] = True
        m[pk & q] = 255; m = cv2.dilate(m, np.ones((5, 5), np.uint8), iterations=2)
    return Image.fromarray(cv2.cvtColor(cv2.inpaint(a, m, 7, cv2.INPAINT_TELEA), cv2.COLOR_BGR2RGB))
def render_robot(name, pose, expr, light, px, over=None):
    out = f"/tmp/robot-cov-{name}.png"; job = [dict(out=out, w=1000, h=1400, pose=pose["pose"], expr=expr["expr"] if isinstance(expr, dict) else expr, dist=4.2, look=[0, 0.62, 0], light=light, az=0.12, over=over or {})]
    json.dump(job, open(f"/tmp/robot-cov-{name}.json", "w")); subprocess.run(["node", str(A.W / "robot/render.mjs"), f"/tmp/robot-cov-{name}.json"], check=True, capture_output=True, env={**os.environ, "NODE_PATH": "/opt/node22/lib/node_modules"})
    im = Image.open(out).convert("RGBA"); box = im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox(); return im.crop(box)
def compose(base, bot, feet, H, shadow):
    bot = bot.resize((int(bot.width * H / bot.height), H), Image.LANCZOS).filter(ImageFilter.GaussianBlur(0.6)); fx, fy = int(feet[0]), int(feet[1])
    base = base.convert("RGBA")
    if shadow:
        ell = Image.new("L", base.size, 0); sw = int(bot.width * 1.2); ImageDraw.Draw(ell).ellipse((fx - sw // 2, fy - 8, fx + sw // 2, fy + 16), fill=130); ell = ell.filter(ImageFilter.GaussianBlur(10))
        base.alpha_composite(Image.merge("RGBA", (Image.new("L", base.size, 0),) * 3 + (ell,)))
    base.alpha_composite(bot, (fx - bot.width // 2, fy - bot.height))
    arr = np.asarray(base.convert("RGB")).astype(np.float32); arr += np.random.default_rng(5).normal(0, 2.0, arr.shape)
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
def make(n):
    srcname, bbox, feet, box, lines, pz, frac, light, shadow = SPEC[n]
    src = A.load(SRC[srcname]); base = A.cover(n, clean(src, bbox, (430, 705, 600, 941) if srcname == 'sun' else None, (780, 40, 1300, 700) if srcname == 'float' else None), box, lines, save_to=False)
    s = 1080 / (box[2] - box[0]); fx, fy = (feet[0] - box[0]) * s, (feet[1] - box[1]) * s
    bot = render_robot(f"p{n}", dict(pose=pz["pose"]), pz["expr"], light, 0); out = compose(base, bot, (fx, fy), int(frac * 1920), shadow)
    d = A.W / f"ep{12 + n}/out"; p = A.ES / f"parts/part{n}/out"; (d / "cover-options").mkdir(parents=True, exist_ok=True)
    old = d / f"possibility-lab-s3p{n}-cover.jpg"
    if old.exists() and not (d / "cover-options" / f"p{n}-glossy.jpg").exists(): shutil.copy(old, d / "cover-options" / f"p{n}-glossy.jpg")
    for b in (d, p):
        A.save(out, b / f"possibility-lab-s3p{n}-cover.jpg"); out.resize((480, 853), Image.LANCZOS).save(b / f"possibility-lab-s3p{n}-cover-480.jpg", quality=90)
        out.crop((0, 240, 1080, 1680)).save(b / f"possibility-lab-s3p{n}-cover-grid-3x4.jpg", quality=90)
    print("cover", n, "robot")
def thumb():
    src = A.load(SRC["sun"]); base = A.words(A.finish(clean(src, (455, 372, 565, 716), (430, 705, 600, 941)), (1920, 1080)), "", 70, 60, 190, lines=["90-MINUTE", "DAY"])
    s = 1920 / 1672; bot = render_robot("thumb", dict(pose="heroHips"), "awe", SUN, 0, over={"head": {"x": -0.45, "z": 0.06}}); out = compose(base, bot, (510 * s, 708 * s), int(0.22 * 1080), True)
    t = A.W / "compilations/s3"; A.save(out, t / "thumbnail.jpg", t / "thumb-options/D-90-minute-day-robot.jpg"); print("thumbnail robot")
if __name__ == "__main__":
    for a in (sys.argv[1:] or [str(k) for k in SPEC] + ["thumb"]): thumb() if a == "thumb" else make(int(a))
