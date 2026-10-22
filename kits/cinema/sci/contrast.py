"""contrast.py — one WCAG contrast and ΔE checker for the channel themes (kits/cinema/sci).

It reads every films/channels/<channel>/theme.json (the files kits/cinema/film/page.mjs renders with)
and checks three things:

  1. Contrast. Every text/background pair the theme can put on screen, with its WCAG 2.x ratio. Text
     needs 4.5:1. Large text (titles, counters) and lines (leader lines, label dots and borders, rings,
     the scale bar) need 3:1. A translucent layer (the caption plate, label pills, badges, the end-card
     scrim) is composited over each colour it may sit on (the theme's "behind" list, worst case first),
     the way a browser blends it: in 8-bit sRGB.
  2. Distance. Each chromatic colour of a palette (tokens plus 3D scene colours) against every
     chromatic colour of the sibling channels and of the identities these channels must not borrow:
     Lumevina (black, rose, gold), Los Güeros (espresso, amber) and Claude coral. Fail under ΔE76 10
     (the cross-check measured its collisions in CIE76: 1.6, 5.9, 9.4), warn under 20. Grounds are
     compared with each other too (fail under ΔE76 5). Inside one channel, two label colours closer
     than ΔE76 10 pass only if their marks or glyphs differ (colour is never the only cue).
  3. Consistency. The theme's descriptive blocks match the roles the page renders with: the plate's
     colour and opacity, the highlight colour, and every size in px against its role in vmin.
  4. Faces. No theme may use Lumevina's face (Inter) or Los Güeros' (Cormorant Garamond, Jost), and
     no two channels may share a family.

Exit status 1 when anything fails, so a script can gate on it.

  python3 -I kits/cinema/sci/contrast.py                 # every channel
  python3 -I kits/cinema/sci/contrast.py body space      # some channels (distances still use all)
  python3 -I kits/cinema/sci/contrast.py --json out.json # also write every number as JSON

Relative luminance and the ratio are WCAG 2.x's (sRGB, linearised with the 0.04045 threshold). ΔE76
is the Euclidean distance in CIELAB (D65); ΔE2000 is printed alongside for reference.
"""
import json
import math
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]          # the repo
CHANNELS = ROOT / "films" / "channels"

TEXT, LARGE, LINE = 4.5, 3.0, 3.0
NEED = {"text": TEXT, "large": LARGE, "line": LINE}
NEUTRAL_C = 12.0        # C*ab below this is a neutral (whites, greys, near-blacks): not an identity hue
FAIL_DE, WARN_DE, GROUND_DE = 10.0, 20.0, 5.0

# The identities the three channels must stay clear of (CLAUDE.md, the cross-check).
REFS = {
    "Lumevina": {"ink": "#000000", "rose": "#F4C9D6", "rose-2": "#EAB9C8", "gold": "#E3B48F"},
    "Los Güeros": {"espresso": "#100C09", "amber": "#E8A356"},
    "Claude": {"coral": "#D97757"},
}
REF_GROUNDS = {"Lumevina": "ink", "Los Güeros": "espresso"}
REF_FACES = {"inter": "Lumevina", "cormorant garamond": "Los Güeros", "jost": "Los Güeros"}


# ── colour maths ─────────────────────────────────────────────────────────────
def hex_rgb(h):
    h = h.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def rgb_hex(c):
    return "#%02X%02X%02X" % tuple(int(round(v)) for v in c)


def lin(v):
    v /= 255.0
    return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4


def luminance(c):
    r, g, b = (lin(v) for v in c)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def ratio(a, b):
    la, lb = luminance(a), luminance(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def lab(c):
    r, g, b = (lin(v) for v in c)
    x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047
    y = 0.2126729 * r + 0.7151522 * g + 0.0721750 * b
    z = (0.0193339 * r + 0.1191920 * g + 0.9503041 * b) / 1.08883
    f = lambda t: t ** (1 / 3) if t > 216 / 24389 else (24389 / 27 * t + 16) / 116
    fx, fy, fz = f(x), f(y), f(z)
    return 116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)


def chroma(c):
    _, a, b = lab(c)
    return math.hypot(a, b)


def de76(c1, c2):
    return math.dist(lab(c1), lab(c2))


def de2000(c1, c2):
    """CIEDE2000 (Sharma, Wu & Dalal 2005), kL = kC = kH = 1."""
    L1, a1, b1 = lab(c1)
    L2, a2, b2 = lab(c2)
    C1, C2 = math.hypot(a1, b1), math.hypot(a2, b2)
    Cm = (C1 + C2) / 2
    G = 0.5 * (1 - math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)))
    a1p, a2p = (1 + G) * a1, (1 + G) * a2
    C1p, C2p = math.hypot(a1p, b1), math.hypot(a2p, b2)
    h1p = math.degrees(math.atan2(b1, a1p)) % 360
    h2p = math.degrees(math.atan2(b2, a2p)) % 360
    dLp, dCp = L2 - L1, C2p - C1p
    if C1p * C2p == 0:
        dhp = 0.0
    elif abs(h2p - h1p) <= 180:
        dhp = h2p - h1p
    else:
        dhp = h2p - h1p - 360 if h2p > h1p else h2p - h1p + 360
    dHp = 2 * math.sqrt(C1p * C2p) * math.sin(math.radians(dhp / 2))
    Lpm, Cpm = (L1 + L2) / 2, (C1p + C2p) / 2
    if C1p * C2p == 0:
        hpm = h1p + h2p
    elif abs(h1p - h2p) <= 180:
        hpm = (h1p + h2p) / 2
    else:
        hpm = (h1p + h2p + 360) / 2 if h1p + h2p < 360 else (h1p + h2p - 360) / 2
    T = (1 - 0.17 * math.cos(math.radians(hpm - 30)) + 0.24 * math.cos(math.radians(2 * hpm))
         + 0.32 * math.cos(math.radians(3 * hpm + 6)) - 0.20 * math.cos(math.radians(4 * hpm - 63)))
    dth = 30 * math.exp(-(((hpm - 275) / 25) ** 2))
    Rc = 2 * math.sqrt(Cpm ** 7 / (Cpm ** 7 + 25 ** 7))
    Sl = 1 + 0.015 * (Lpm - 50) ** 2 / math.sqrt(20 + (Lpm - 50) ** 2)
    Sc, Sh = 1 + 0.045 * Cpm, 1 + 0.015 * Cpm * T
    Rt = -math.sin(math.radians(2 * dth)) * Rc
    return math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh))


def over(top, alpha, under):
    """Alpha-composite one 8-bit sRGB colour over another, as a browser does."""
    return tuple(alpha * t + (1 - alpha) * u for t, u in zip(top, under))


# ── a theme ──────────────────────────────────────────────────────────────────
HEX = re.compile(r"^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$")
RGBA = re.compile(r"^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$")


class Theme:
    def __init__(self, path):
        self.path = path
        self.raw = json.loads(path.read_text())
        self.channel = self.raw.get("channel") or path.parent.name
        self.name = self.raw.get("name", self.channel)
        self.tokens = {k: v for k, v in self.raw.get("tokens", {}).items() if isinstance(v, str) and HEX.match(v)}
        self.scene = {k: v for k, v in self.raw.get("scene", {}).items() if isinstance(v, str) and HEX.match(v)}
        self.roles = self.raw.get("roles", {})
        self.c = self.raw.get("contrast", {})

    def colour(self, x):
        """A token name, a role name, '#hex', 'rgba(...)' or 'transparent' → (rgb, alpha, label)."""
        x = str(x).strip()
        if x in self.tokens:
            return hex_rgb(self.tokens[x]), 1.0, f"{x} {self.tokens[x]}"
        if x in self.roles and x not in self.tokens:
            rgb, a, lab_ = self.colour(self.roles[x])
            return rgb, a, f"{x} ({lab_})"
        if HEX.match(x):
            return hex_rgb(x), 1.0, x.upper()
        if x == "transparent":
            return (0, 0, 0), 0.0, "transparent"
        m = RGBA.match(x)
        if m:
            a = float(m.group(4)) if m.group(4) is not None else 1.0
            rgb = tuple(float(m.group(i)) for i in (1, 2, 3))
            return rgb, a, f"{rgb_hex(rgb)} at {a:.0%}"
        raise ValueError(f"{self.path}: cannot read colour {x!r}")

    def role(self, name, default):
        """A hud role's value as the page resolves it: the theme's role, else hud.js's default."""
        return self.roles.get(name, default)

    def palette(self):
        """Every distinct colour the channel owns: tokens, then 3D scene colours."""
        out = {}
        for group in (self.tokens, self.scene):
            for k, v in group.items():
                out.setdefault(v.upper(), k)
        return {name: hex_rgb(h) for h, name in out.items()}

    def labels(self):
        return {k: v for k, v in self.raw.get("labels", {}).items() if isinstance(v, dict)}


def pairs(th):
    """Every (fg, bg, kind, what) the theme can show. fg and bg are solid rgb by then."""
    out = []
    solid = lambda x: th.colour(x)
    text = th.role("text", "text")
    text2 = th.role("text-2", "text-2")
    accent = th.role("accent", text)
    grounds = th.c.get("grounds", ["bg"])
    behind = th.c.get("behind", ["#FFFFFF"])

    def layer(role, default, under):
        """A translucent role (plate, pill, badge, scrim) composited over `under` → (rgb, label)."""
        rgb, a, lab_ = th.colour(th.role(role, default))
        u_rgb, _, u_lab = solid(under)
        return over(rgb, a, u_rgb), f"{role} {lab_} over {u_lab}"

    def add(fg, bg, kind, what):
        f_rgb, f_a, f_lab = solid(fg) if isinstance(fg, str) else (fg[0], 1.0, fg[1])
        b_rgb, b_lab = (solid(bg)[0], solid(bg)[2]) if isinstance(bg, str) else bg
        if f_a < 1:                                  # a translucent foreground blends with its ground
            f_rgb = over(f_rgb, f_a, b_rgb)
        out.append({"what": what, "fg": f_lab, "bg": b_lab, "fg_hex": rgb_hex(f_rgb), "bg_hex": rgb_hex(b_rgb),
                    "kind": kind, "ratio": ratio(f_rgb, b_rgb), "need": NEED[kind]})

    for g in grounds:                                # text straight on the grounds
        add(text, g, "text", "text on a ground")
        add(text2, g, "text", "secondary text on a ground")
        add(accent, g, "text", "accent (series line, accent word) on a ground")
        add(th.role("scale-line", text), g, "line", "scale bar on a ground")
    for b in behind:                                 # the caption plate over whatever the frame holds
        plate = layer("plate", "rgba(10, 11, 13, .72)", b)
        add(th.role("cap-said", text), plate, "text", "caption, words said")
        add(th.role("cap-next", text2), plate, "text", "caption, words to come")
        lit_bg_rgb, lit_bg_a, lit_bg_lab = th.colour(th.role("cap-lit-bg", "transparent"))
        lit_ground = plate if lit_bg_a == 0 else (over(lit_bg_rgb, lit_bg_a, plate[0]), f"{lit_bg_lab} band on the plate")
        add(th.role("cap-lit", accent), lit_ground, "text", "caption, the spoken word")
    for b in list(behind) + [g for g in grounds if g not in behind]:   # label pills, over the frame
        pill = layer("label-bg", "rgba(10, 11, 13, .86)", b)
        add(th.role("label-text", text), pill, "text", "label text in its pill")
        for name, lb in th.labels().items():
            add(lb["color"], pill, "line", f"label '{name}' dot and border in its pill")
    for g in grounds:                                # leader lines straight over the grounds
        for name, lb in th.labels().items():
            add(lb["color"], g, "line", f"label '{name}' leader line on a ground")
    for b in behind:                                 # badges and the end-card scrim
        badge = layer("badge-bg", "rgba(10, 11, 13, .6)", b)
        add(th.role("badge-text", text2), badge, "text", "badge text")
        add(th.role("badge-border", text2), badge, "line", "badge border")
        scrim = layer("scrim", "rgba(0, 0, 0, .62)", b)
        add(text, scrim, "text", "end card on the scrim")
        add(text2, scrim, "text", "end card 'Follow' chip on the scrim")
        add(accent, scrim, "large", "end card accent word on the scrim")
    for p in th.c.get("pairs", []):                  # the theme's own extra pairs
        add(p["fg"], p["bg"], p["kind"], p.get("note", "theme pair"))
    return out


# ── the checks ───────────────────────────────────────────────────────────────
def check_contrast(th):
    rows = pairs(th)
    seen, fails = set(), []
    print(f"  contrast (text ≥ {TEXT}:1, large text and lines ≥ {LINE}:1)")
    for r in rows:
        key = (r["what"], r["fg_hex"], r["bg_hex"])
        if key in seen:
            continue
        seen.add(key)
        ok = r["ratio"] >= r["need"] - 1e-9
        r["ok"] = ok
        if not ok:
            fails.append(r)
        print(f"    {'ok  ' if ok else 'FAIL'} {r['ratio']:5.2f} ≥ {r['need']:.1f}  {r['what']}: {r['fg']} on {r['bg']}"
              + (f" (= {r['bg_hex']})" if r['bg_hex'] not in r['bg'] else ""))
    return rows, fails


def check_distance(th, others):
    fails, warns, rows = [], [], []
    mine = th.palette()
    groups = {f"channel {o.channel} ({o.name})": o.palette() for o in others}
    groups.update({f"{k}": {n: hex_rgb(h) for n, h in v.items()} for k, v in REFS.items()})
    print(f"  distance (chromatic colours: fail under ΔE76 {FAIL_DE:g}, warn under {WARN_DE:g}; grounds: fail under {GROUND_DE:g})")
    for gname, pal in groups.items():
        near = []
        for n1, c1 in mine.items():
            if chroma(c1) < NEUTRAL_C:
                continue
            for n2, c2 in pal.items():
                if chroma(c2) < NEUTRAL_C:
                    continue
                near.append((de76(c1, c2), de2000(c1, c2), n1, c1, n2, c2))
        near.sort()
        if not near:
            print(f"    vs {gname}: no chromatic colours to compare")
            continue
        d, d2, n1, c1, n2, c2 = near[0]
        status = "FAIL" if d < FAIL_DE else ("warn" if d < WARN_DE else "ok  ")
        print(f"    {status} vs {gname}: nearest {n1} {rgb_hex(c1)} ↔ {n2} {rgb_hex(c2)}  ΔE76 {d:.1f}  ΔE00 {d2:.1f}")
        for d, d2, n1, c1, n2, c2 in near[1:]:
            if d >= WARN_DE:
                break
            print(f"    {'FAIL' if d < FAIL_DE else 'warn'}      also {n1} {rgb_hex(c1)} ↔ {n2} {rgb_hex(c2)}  ΔE76 {d:.1f}  ΔE00 {d2:.1f}")
        for d, d2, n1, c1, n2, c2 in near:
            row = {"vs": gname, "a": n1, "a_hex": rgb_hex(c1), "b": n2, "b_hex": rgb_hex(c2), "de76": d, "de2000": d2}
            rows.append(row)
            (fails if d < FAIL_DE else warns if d < WARN_DE else []).append(row)
    # grounds: the channel's bg against the others' and the references' grounds
    bg = hex_rgb(th.tokens["bg"])
    gr = {f"channel {o.channel} bg": hex_rgb(o.tokens["bg"]) for o in others}
    gr.update({f"{k} {REFS[k][v]}": hex_rgb(REFS[k][v]) for k, v in REF_GROUNDS.items()})
    for gname, c in gr.items():
        d = de76(bg, c)
        status = "FAIL" if d < GROUND_DE else "ok  "
        print(f"    {status} ground {th.tokens['bg']} vs {gname} {rgb_hex(c)}: ΔE76 {d:.1f}  ΔE00 {de2000(bg, c):.1f}")
        row = {"vs": gname, "a": "bg", "a_hex": th.tokens["bg"], "b": "bg", "b_hex": rgb_hex(c), "de76": d, "ground": True}
        rows.append(row)
        if d < GROUND_DE:
            fails.append(row)
    # inside the channel: label colours that are close need different marks or glyphs
    labels = th.labels()
    names = list(labels)
    for i, a in enumerate(names):
        for b in names[i + 1:]:
            ca, cb = th.colour(labels[a]["color"])[0], th.colour(labels[b]["color"])[0]
            d = de76(ca, cb)
            if d >= FAIL_DE:
                continue
            cue = (labels[a].get("mark"), labels[a].get("glyph")) != (labels[b].get("mark"), labels[b].get("glyph"))
            print(f"    {'ok  ' if cue else 'FAIL'} labels '{a}' ↔ '{b}': ΔE76 {d:.1f}"
                  + (f", told apart by mark/glyph ({labels[a].get('mark')}/{labels[a].get('glyph', '-')} vs {labels[b].get('mark')}/{labels[b].get('glyph', '-')})" if cue else ", same mark and glyph"))
            if not cue:
                fails.append({"vs": "itself", "a": a, "b": b, "de76": d})
    return rows, fails, warns


def check_blocks(th):
    """The theme's descriptive blocks agree with the roles the page actually uses: the plate's colour
    and opacity, the highlight colour, and each size in px with its role in vmin (px / 10.8 at 1080)."""
    fails = []
    pl = th.raw.get("plate")
    if pl:
        want = over(th.colour(pl["color"])[0], 1.0, (0, 0, 0))
        rgb, a, _ = th.colour(th.role("plate", "rgba(10, 11, 13, .72)"))
        if max(abs(x - y) for x, y in zip(want, rgb)) > 0.5 or abs(a - pl["opacity"]) > 1e-6:
            fails.append(f"plate block {pl} ≠ plate role {th.role('plate', '')}")
    hl = th.raw.get("highlight")
    if hl:
        key = "cap-lit-bg" if hl.get("style") == "band" else "cap-lit"
        if th.colour(th.role(key, "transparent"))[0] != th.colour(hl["color"])[0]:
            fails.append(f"highlight {hl['color']} ≠ role {key} {th.role(key, '')}")
    roles = {"caption": "cap-size", "label": "label-size", "badge": "badge-size", "counter": "counter-size",
             "series": "series-size", "title": "title-size", "end": "end-size"}
    for k, role in roles.items():
        px, v = th.raw.get("sizes", {}).get(k, {}).get("px"), th.roles.get(role)
        if px is None or v is None:
            continue
        got = float(v.replace("vmin", "")) * 10.8 if v.endswith("vmin") else None
        if got is None or abs(got - px) > 0.06:
            fails.append(f"sizes.{k} {px} px ≠ role {role} {v} ({got and round(got, 2)} px)")
    print(f"  consistency (plate, highlight, sizes vs roles): {'ok' if not fails else 'FAIL'}")
    for f in fails:
        print(f"    FAIL {f}")
    return fails


def check_faces(themes):
    fails = []
    owner = {}
    print("== faces")
    for th in themes:
        fams = {f["family"] for f in th.raw.get("fonts", [])}
        fams |= {v for k, v in th.raw.get("type", {}).items() if not k.startswith("_") and isinstance(v, str)}
        for fam in sorted(fams):
            ref = REF_FACES.get(fam.lower())
            if ref:
                fails.append({"channel": th.channel, "face": fam, "why": f"{ref}'s face"})
                print(f"  FAIL {th.channel}: {fam} is {ref}'s face")
            if fam in owner and owner[fam] != th.channel:
                fails.append({"channel": th.channel, "face": fam, "why": f"shared with {owner[fam]}"})
                print(f"  FAIL {th.channel}: {fam} is also {owner[fam]}'s face")
            owner.setdefault(fam, th.channel)
        print(f"  ok   {th.channel}: {', '.join(sorted(fams))}")
    return fails


def main(argv):
    out_json = None
    if "--json" in argv:
        i = argv.index("--json")
        out_json = Path(argv[i + 1])
        argv = argv[:i] + argv[i + 2:]
    files = sorted(CHANNELS.glob("*/theme.json"))
    if not files:
        sys.exit(f"no theme.json under {CHANNELS}")
    themes = [Theme(p) for p in files]
    chosen = [t for t in themes if not argv or t.channel in argv or t.path.parent.name in argv]
    report, n_fail, n_warn = {}, 0, 0
    for th in chosen:
        print(f"\n== {th.channel} · {th.name} ({th.path.relative_to(ROOT)})")
        crow, cf = check_contrast(th)
        drow, df, dw = check_distance(th, [o for o in themes if o is not th])
        bf = check_blocks(th)
        n_fail += len(cf) + len(df) + len(bf)
        n_warn += len(dw)
        report[th.channel] = {"contrast": crow, "distance": drow, "consistency": bf, "fails": len(cf) + len(df) + len(bf), "warns": len(dw)}
    print()
    ff = check_faces(themes)
    n_fail += len(ff)
    print(f"\n{len(chosen)} theme(s): {n_fail} fail(s), {n_warn} warning(s)")
    if out_json:
        out_json.write_text(json.dumps({"themes": report, "faces": ff}, indent=1, ensure_ascii=False))
    return 1 if n_fail else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
