"""The cover hook: hand-drawn marks on a cover or thumbnail hero (owner's rule, 12 Nov 2026; films/channels/PACKAGING.md).

One loose marker circle and/or a curved arrow at the one surprising thing, plus a 1-3 word handwritten question
("that's it?!", "your ring?!"), in the channel's own hand and accent colour. Drawn supersampled, with a soft dark
shadow so the marks read over a busy picture; the picture itself is only lit (--glow, --halo), never changed.

    python3 -I kits/cinema/film/hook.py <hero.png> <out.png> --font <hand.ttf> --color "#EB63FF" \
        [--note "that's|it?!" --note-at 44,640 --note-size 150 [--note-weight 700]] \
        [--circle cx,cy,rx,ry] [--arrow x0,y0:x1,y1[:bend]] ... [--glow cx,cy,r[:#4682FF]] [--halo cx,cy,rx,ry[:#FFC450]]

Coordinates are pixels of the hero as given. "|" breaks the note into lines. --arrow and the light flags can repeat.
The channel hands: Possibility Lab Caveat 700 in marker #E862FF; One More Orbit Permanent Marker in teal #4FE3C6.
Reality Rulebook and Skin Sense pick their own hand and accent at their first hook cover (PACKAGING.md).

As a module: `from hook import marks; img = marks(img, font=..., color=..., note=..., circle=..., arrows=[...])`.
"""
import argparse, math, random

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont


def _rgb(h):
    h = h.lstrip("#"); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def _font(path, size, weight=None):
    f = ImageFont.truetype(path, size)
    if weight is not None:
        try:
            f.set_variation_by_axes([min(max(weight, a["minimum"]), a["maximum"]) if a["name"] == b"Weight" else a["default"]
                                     for a in f.get_variation_axes()])
        except Exception:
            pass                                                     # a static face (one weight) has no axes
    return f


def _dot(d, q, w, col):
    d.ellipse((q[0] - w / 2, q[1] - w / 2, q[0] + w / 2, q[1] + w / 2), fill=col)


def loop(d, c, rx, ry, width, col, seed=5, tilt_deg=-8):
    """A hand-drawn marker loop: a little wobbly, tilted, thin at both ends, overshooting where it closes."""
    rnd = random.Random(seed); ph = [rnd.uniform(0, 6.28) for _ in range(2)]
    a0, turns, n, tilt = math.radians(-120), 1.12, 240, math.radians(tilt_deg); pts = []
    for i in range(n + 1):
        a = a0 + 2 * math.pi * turns * i / n
        wob = 1 + 0.035 * math.sin(3 * a + ph[0]) + 0.02 * math.sin(5 * a + ph[1]) + 0.05 * (i / n)
        x, y = rx * wob * math.cos(a), ry * wob * math.sin(a)
        pts.append((c[0] + x * math.cos(tilt) - y * math.sin(tilt), c[1] + x * math.sin(tilt) + y * math.cos(tilt)))
    for i in range(n):
        t = i / n; w = width * (0.55 + 0.45 * math.sin(math.pi * min(1, t * 1.15)))
        d.line([pts[i], pts[i + 1]], fill=col, width=max(2, round(w))); _dot(d, pts[i], w, col)


def arrow(d, p0, p1, bend, width, col, head=None):
    """A curved marker arrow from p0 to p1, bent sideways by `bend` px (sign picks the side), with an open head."""
    head = head or width * 3.4
    mx, my = (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2; dx, dy = p1[0] - p0[0], p1[1] - p0[1]; L = math.hypot(dx, dy) or 1
    cx, cy = mx - dy / L * bend, my + dx / L * bend
    pts = [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * cx + t * t * p1[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * cy + t * t * p1[1])
           for t in [i / 80 for i in range(81)]]
    for i in range(80): d.line([pts[i], pts[i + 1]], fill=col, width=width); _dot(d, pts[i], width, col)
    ex, ey = pts[-1]; ax, ay = pts[-6]; ang = math.atan2(ey - ay, ex - ax)
    for s in (+1, -1):
        hx, hy = ex - head * math.cos(ang + s * 0.5), ey - head * math.sin(ang + s * 0.5)
        d.line([(ex, ey), (hx, hy)], fill=col, width=width); _dot(d, (ex, ey), width, col); _dot(d, (hx, hy), width, col)


def light(img, shape, col, strength=0.55):
    """Light only: a soft halo screened onto the picture so the eye lands on the subject. shape: ("disc", cx, cy, r) or
    ("ring", cx, cy, rx, ry)."""
    L = Image.new("L", img.size, 0); d = ImageDraw.Draw(L)
    if shape[0] == "disc":
        _, cx, cy, r = shape; d.ellipse((cx - r * 1.9, cy - r * 1.9, cx + r * 1.9, cy + r * 1.9), fill=int(255 * strength)); blur = r * 0.9
    else:
        _, cx, cy, rx, ry = shape; d.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), outline=int(255 * strength), width=max(2, int(rx * 0.16))); blur = rx * 0.12
    L = L.filter(ImageFilter.GaussianBlur(blur))
    return ImageChops.screen(img.convert("RGB"), Image.composite(Image.new("RGB", img.size, col), Image.new("RGB", img.size, 0), L))


def marks(img, font, color, note=None, note_at=(40, 40), note_size=120, note_weight=None, circle=None, arrows=(),
          stroke=None, shadow=(8, 9, 12), ss=2):
    """Draw the hook on img (a PIL image) and return the result. circle: (cx, cy, rx, ry); arrows: [((x0, y0), (x1, y1), bend)]."""
    col = _rgb(color) + (255,) if isinstance(color, str) else tuple(color) + (255,)
    stroke = stroke or max(4, round(note_size / 14))
    W, H = img.size; lay = Image.new("RGBA", (W * ss, H * ss), (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    if circle:
        cx, cy, rx, ry = circle; loop(d, (cx * ss, cy * ss), rx * ss, ry * ss, stroke * ss, col)
    for p0, p1, bend in arrows:
        arrow(d, (p0[0] * ss, p0[1] * ss), (p1[0] * ss, p1[1] * ss), bend * ss, round(stroke * 0.92 * ss), col)
    if note:
        f = _font(font, round(note_size * ss), note_weight); y = note_at[1]
        for line in note.split("|"):
            d.text((note_at[0] * ss, y * ss), line, font=f, fill=col); y += note_size * 0.86
    lay = lay.resize((W, H), Image.LANCZOS)
    sh = Image.new("RGBA", (W, H), tuple(shadow) + (0,))
    sh.putalpha(lay.getchannel("A").filter(ImageFilter.GaussianBlur(7)).point(lambda v: int(v * 0.85)))
    out = img.convert("RGBA"); out.alpha_composite(sh); out.alpha_composite(lay)
    return out.convert("RGB")


def _nums(s, n=None):
    v = [float(x) for x in s.split(",")]
    if n and len(v) != n: raise argparse.ArgumentTypeError(f"expected {n} numbers, got {s!r}")
    return v


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("hero"); ap.add_argument("out")
    ap.add_argument("--font", required=True); ap.add_argument("--color", required=True)
    ap.add_argument("--note"); ap.add_argument("--note-at", default="40,40"); ap.add_argument("--note-size", type=float, default=120)
    ap.add_argument("--note-weight", type=float); ap.add_argument("--stroke", type=float)
    ap.add_argument("--circle"); ap.add_argument("--arrow", action="append", default=[])
    ap.add_argument("--glow", action="append", default=[]); ap.add_argument("--halo", action="append", default=[])
    a = ap.parse_args()
    img = Image.open(a.hero).convert("RGB")
    for g in a.glow:
        p, _, c = g.partition(":"); cx, cy, r = _nums(p, 3); img = light(img, ("disc", cx, cy, r), _rgb(c or "#4682FF"))
    for g in a.halo:
        p, _, c = g.partition(":"); cx, cy, rx, ry = _nums(p, 4); img = light(img, ("ring", cx, cy, rx, ry), _rgb(c or "#FFC450"), 0.5)
    arrows = []
    for s in a.arrow:
        parts = s.split(":"); arrows.append((_nums(parts[0], 2), _nums(parts[1], 2), float(parts[2]) if len(parts) > 2 else 40.0))
    img = marks(img, a.font, a.color, note=a.note, note_at=_nums(a.note_at, 2), note_size=a.note_size, note_weight=a.note_weight,
                circle=_nums(a.circle, 4) if a.circle else None, arrows=arrows, stroke=a.stroke)
    img.save(a.out); print("hook →", a.out)
