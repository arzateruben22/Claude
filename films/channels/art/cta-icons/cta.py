"""Like/follow pop-up: the owner's two frosted-glass icons (thumbs-up, bell) animated over a finished video, in each
channel's colours and type, with a soft swoosh (none on Skin Sense: ASMR). Post-composite: no re-render.

    python3 -I cta.py --video in.mp4 --channel physics|space|whatif|skincare --at 50.0 --word follow|subscribe \
        --out out.mp4 [--y 0.76] [--clip 48:56]   (--clip: only write that time span, for previews)
"""
import argparse, math, os, subprocess, sys, tempfile
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageEnhance

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "src")
FONTS = os.path.join(HERE, "fonts")

STYLES = {
    # Reality Rulebook: daylight kitchen; cream caption pills, ink text, marker-yellow highlight, cobalt accent
    "physics": dict(font="Archivo-VF.ttf", wght=700, pill=(255, 253, 247), pill_a=0.96, text=(21, 23, 28), hi_box=(255, 212, 59),
                    hi_text=(21, 23, 28), accent=(31, 59, 209), glow=None, shadow=0.34, tint=None, y=0.76, radius=18, soft=False),
    # One More Orbit: night beach; dark navy glass pill, pale text, teal accent and glow, icons cooled to ice
    "space": dict(font="Lexend-VF.ttf", wght=500, pill=(21, 26, 61), pill_a=0.86, text=(238, 240, 255), hi_box=None,
                  hi_text=(79, 227, 198), accent=(79, 227, 198), glow=(79, 227, 198), shadow=0.25, tint=(143, 208, 255), y=0.70, radius=16, soft=False),
    # Possibility Lab: graphite pill, chalk text, marker-magenta accent and glow
    "whatif": dict(font="Bricolage-VF.ttf", wght=700, pill=(33, 36, 42), pill_a=0.92, text=(244, 242, 236), hi_box=None,
                   hi_text=(235, 99, 255), accent=(235, 99, 255), glow=(235, 99, 255), shadow=0.25, tint=None, y=0.81, radius=16, soft=False),
    # Skin Sense S3 (ASMR): dark green-black plate, ivory serif, teal hairline; fade only, no bounce, no sound
    "skincare": dict(font="Newsreader-VF.ttf", wght=420, pill=(11, 21, 19), pill_a=0.82, text=(244, 237, 227), hi_box=None,
                     hi_text=(63, 191, 174), accent=(63, 191, 174), glow=None, shadow=0.2, tint=(63, 191, 174), y=0.79, radius=24, soft=True),
}


def ease_out_back(x, s=1.6):
    x = min(max(x, 0.0), 1.0) - 1
    return x * x * ((s + 1) * x + s) + 1


def ease_in_out(x):
    x = min(max(x, 0.0), 1.0)
    return 0.5 - 0.5 * math.cos(math.pi * x)


def load_icon(name, size, st):
    im = Image.open(os.path.join(SRC, name)).convert("RGBA")
    bbox = im.getchannel("A").point(lambda a: 255 if a > 40 else 0).getbbox()
    im = im.crop(bbox)
    # keep the round button only: mask to the inscribed circle (drops the baked floor shadow)
    w, h = im.size
    d = min(w, h)
    im = im.crop(((w - d) // 2, 0, (w - d) // 2 + d, d))
    m = Image.new("L", (d, d), 0)
    ImageDraw.Draw(m).ellipse((2, 2, d - 3, d - 3), fill=255)
    im.putalpha(Image.fromarray(np.minimum(np.asarray(im.getchannel("A")), np.asarray(m))))
    if st["tint"]:
        rgb = Image.new("RGBA", im.size, st["tint"] + (255,))
        im = Image.blend(im, Image.composite(rgb, im, im.getchannel("A")), 0.22 if not st["soft"] else 0.12)
    if st["soft"]:
        im = ImageEnhance.Brightness(im).enhance(0.93)
    return im.resize((size, size), Image.LANCZOS)


def ring(size, color, width, alpha):
    r = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(r).ellipse((width, width, size - width, size - width), outline=color + (int(255 * alpha),), width=width)
    return r


def glow_of(img, color, blur, strength):
    a = img.getchannel("A").filter(ImageFilter.GaussianBlur(blur))
    a = a.point(lambda v: int(min(255, v * strength)))
    g = Image.new("RGBA", img.size, color + (0,))
    g.putalpha(a)
    return g


class Layout:
    def __init__(self, W, H, st, word):
        k = W / 1080.0
        self.k, self.W, self.H, self.st = k, W, H, st
        self.btn = int(round(128 * k))
        self.gap = int(round(14 * k))
        self.pad = int(round(26 * k))
        f = ImageFont.truetype(os.path.join(FONTS, st["font"]), int(round(44 * k)))
        try:
            axes = f.get_variation_axes()
            f.set_variation_by_axes([st["wght"]] + [a["default"] for a in axes[1:]])
        except Exception:
            pass
        self.font = f
        self.pre, self.word = "Like & ", word
        self.w_pre = f.getlength(self.pre)
        self.w_word = f.getlength(word)
        self.pill_h = int(round(84 * k))
        self.pill_w = int(self.pad * 2 + self.w_pre + self.w_word + (21 * k if st["hi_box"] else 0))
        self.group_w = self.btn * 2 + self.gap + int(18 * k) + self.pill_w
        self.x0 = (W - self.group_w) // 2
        self.cy = int(H * st["y"])
        self.thumb = load_icon("Frosted glass thumbs-up icon.png", self.btn, st)
        self.bell = load_icon("Pearl frosted glass bell button.png", self.btn, st)
        self.pill = self.make_pill()

    def make_pill(self):
        st, k = self.st, self.k
        P = Image.new("RGBA", (self.pill_w, self.pill_h), (0, 0, 0, 0))
        d = ImageDraw.Draw(P)
        d.rounded_rectangle((0, 0, self.pill_w - 1, self.pill_h - 1), radius=int(st["radius"] * k), fill=st["pill"] + (int(255 * st["pill_a"]),))
        if st["soft"]:
            d.rounded_rectangle((0, 0, self.pill_w - 1, self.pill_h - 1), radius=int(st["radius"] * k), outline=st["accent"] + (110,), width=max(1, int(1.5 * k)))
        asc, desc = self.font.getmetrics()
        ty = (self.pill_h - (asc + desc)) // 2
        x = self.pad
        d.text((x, ty), self.pre, font=self.font, fill=st["text"] + (255,))
        x += self.w_pre
        if st["hi_box"]:
            hb = int(7 * k)
            x += hb
            d.rounded_rectangle((x - hb, ty - int(2 * k), x + self.w_word + hb, ty + asc + desc - int(4 * k)), radius=int(8 * k), fill=st["hi_box"] + (255,))
        d.text((x, ty), self.word, font=self.font, fill=st["hi_text"] + (255,))
        return P


def frame(L, t, dur):
    st, k, W, H = L.st, L.k, L.W, L.H
    F = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    if st["soft"]:
        a_in = ease_in_out(t / 0.6)
        a_out = 1 - ease_in_out((t - (dur - 0.6)) / 0.6)
        alpha = min(a_in, a_out)
        dy = int(18 * k * (1 - ease_in_out(t / 0.6)))
        sc_th = sc_g = 1.0
        rot = 0.0
        pill_a, pill_dx = alpha, 0
    else:
        p = ease_out_back(t / 0.38)
        alpha = min(1.0, t / 0.22)
        if t > dur - 0.45:
            e = ease_in_out((t - (dur - 0.45)) / 0.45)
            alpha *= 1 - e
            dy = int(40 * k * e)
        else:
            dy = int(70 * k * (1 - p))
        sc_g = 0.86 + 0.14 * p
        sc_th = 1 - 0.10 * math.sin(math.pi * min(max((t - 0.45) / 0.2, 0), 1))
        tw = t - 0.7
        rot = 10 * math.sin(2 * math.pi * 3 * tw) * math.exp(-4 * tw) if 0 <= tw <= 0.9 else 0.0
        pe = ease_in_out((t - 0.18) / 0.3)
        pill_a = min(pe, alpha if t > dur - 0.45 else 1.0)
        pill_dx = int(-30 * k * (1 - pe))
    if alpha <= 0.001:
        return F
    cy = L.cy + dy
    bx = L.x0
    def paste(img, cx, cy_, scale, rot_=0.0, a=1.0):
        s = max(1, int(img.width * scale))
        im = img.resize((s, s), Image.LANCZOS)
        if rot_:
            im = im.rotate(rot_, resample=Image.BICUBIC, center=(s / 2, s * 0.18))
        if a < 1:
            im.putalpha(im.getchannel("A").point(lambda v: int(v * a)))
        F.alpha_composite(im, (int(cx - s / 2), int(cy_ - s / 2)))
    # soft shadow under the whole group (readability on bright plates)
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    for cx in (bx + L.btn / 2, bx + L.btn * 1.5 + L.gap):
        r = L.btn * 0.5 * sc_g
        sd.ellipse((cx - r, cy - r + 8 * k, cx + r, cy + r + 8 * k), fill=(0, 0, 0, int(255 * st["shadow"] * alpha)))
    px0 = bx + L.btn * 2 + L.gap + 18 * k + pill_dx
    sd.rounded_rectangle((px0, cy - L.pill_h / 2 + 6 * k, px0 + L.pill_w, cy + L.pill_h / 2 + 6 * k), radius=int(st["radius"] * k),
                         fill=(0, 0, 0, int(255 * st["shadow"] * 0.8 * pill_a)))
    F.alpha_composite(sh.filter(ImageFilter.GaussianBlur(10 * k)))
    # glow
    tcx, bcx = bx + L.btn / 2, bx + L.btn * 1.5 + L.gap
    if st["glow"]:
        for cx in (tcx, bcx):
            g = glow_of(L.thumb, st["glow"], 12 * k, 0.55)
            paste(g, cx, cy, sc_g * 1.08, 0, alpha * 0.8)
    # pulse ring from the thumb on the tap
    if not st["soft"] and 0.5 <= t <= 1.15:
        q = (t - 0.5) / 0.65
        size = int(L.btn * (1.0 + 0.7 * q))
        paste(ring(size, st["accent"], max(2, int(4 * k)), 0.55 * (1 - q)), tcx, cy, 1.0, 0, alpha)
    paste(L.thumb, tcx, cy, sc_g * sc_th, 0, alpha)
    paste(L.bell, bcx, cy, sc_g, rot, alpha)
    if st["soft"]:
        for cx in (tcx, bcx):
            paste(ring(L.btn, st["accent"], max(1, int(2 * k)), 0.55), cx, cy, sc_g, 0, alpha)
    if pill_a > 0:
        P = L.pill.copy()
        P.putalpha(P.getchannel("A").point(lambda v: int(v * pill_a)))
        F.alpha_composite(P, (int(px0), int(cy - L.pill_h / 2)))
    return F


def swoosh(path, sr=48000, dur=0.5):
    rng = np.random.default_rng(7)
    n = int(sr * dur)
    x = rng.standard_normal(n)
    # pink-ish: integrate a little
    b = np.cumsum(x) * 0.02 + x * 0.6
    t = np.arange(n) / sr
    env = np.where(t < 0.14, (t / 0.14) ** 2, np.exp(-(t - 0.14) / 0.12))
    out = np.zeros(n)
    y = 0.0
    for i in range(n):  # one-pole low-pass sweeping 600 Hz -> 5 kHz
        fc = 600 + 4400 * min(1.0, t[i] / 0.3)
        a = 1 - math.exp(-2 * math.pi * fc / sr)
        y += a * (b[i] - y)
        out[i] = y
    out = out - np.convolve(out, np.ones(64) / 64, mode="same")  # take off the rumble
    out *= env
    out /= np.max(np.abs(out)) + 1e-9
    out *= 10 ** (-26 / 20)  # peak -26 dBFS, well under the voice
    import wave
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes((out * 32767).astype(np.int16).tobytes())


def auto_y(video, at, dur, W, H, L, default_y, lo=0.56, hi=0.86):
    """Pick the clearest band for the pop-up: sample frames over its time on screen, score each candidate centre by the
    busiest frame inside the group's box (local contrast + brightness: captions, the Moon, a subject), plus a small
    pull toward the channel default. Returns a y fraction."""
    w, h = 270, 480
    frames = []
    for i in range(6):
        t = at + dur * i / 5.0
        b = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-ss", f"{t:.3f}", "-i", video, "-frames:v", "1",
                            "-vf", f"scale={w}:{h},format=gray", "-f", "rawvideo", "-"], capture_output=True).stdout
        if len(b) == w * h:
            frames.append(np.frombuffer(b, np.uint8).reshape(h, w).astype(np.float32))
    if not frames:
        return default_y
    gx0 = int(L.x0 * w / W) - 4; gx1 = int((L.x0 + L.group_w) * w / W) + 4
    bh = int(L.btn * 1.8 * h / H) // 2
    best, best_y = None, default_y
    for k in range(int(lo * 100), int(hi * 100) + 1):
        y = k / 100.0; cy = int(y * h)
        sc = 0.0
        for f in frames:
            box = f[max(0, cy - bh):cy + bh, max(0, gx0):min(w, gx1)]
            if box.size == 0:
                continue
            gy, gxx = np.abs(np.diff(box, axis=0)).mean(), np.abs(np.diff(box, axis=1)).mean()
            bright = float((box > 170).mean())
            black = float((box < 14).mean())          # an eclipse disk or a dark subject, not empty sky
            sc = max(sc, (gy + gxx) * 2.0 + bright * 60.0 + black * 25.0)
        sc += abs(y - default_y) * 40.0
        if best is None or sc < best:
            best, best_y = sc, y
    return best_y


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", required=True); ap.add_argument("--channel", required=True, choices=STYLES)
    ap.add_argument("--at", type=float, required=True); ap.add_argument("--word", default="follow")
    ap.add_argument("--out", required=True); ap.add_argument("--y", type=float); ap.add_argument("--clip")
    ap.add_argument("--crf", default="17"); ap.add_argument("--preset", default="slow"); ap.add_argument("--auto-y", action="store_true")
    ap.add_argument("--sfx", help="a sound-effects stem (sfx.py) mixed under the film's own audio, on the same timeline")
    a = ap.parse_args(argv)
    st = dict(STYLES[a.channel])
    if a.y:
        st["y"] = a.y
    W, H = [int(v) for v in subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
                                            "-of", "csv=p=0", a.video], capture_output=True, text=True).stdout.strip().split(",")]
    dur = 3.2 if st["soft"] else 2.6
    L = Layout(W, H, st, a.word)
    if a.auto_y and not a.y:
        st["y"] = auto_y(a.video, a.at, dur, W, H, L, st["y"])
        L = Layout(W, H, st, a.word)
        print("auto y", st["y"])
    with tempfile.TemporaryDirectory() as td:
        for i in range(int(dur * 30)):
            frame(L, i / 30, dur).save(os.path.join(td, f"{i:04d}.png"))
        sw = os.path.join(td, "sw.wav")
        fc = f"[1:v]setpts=PTS+{a.at}/TB[ov];[0:v][ov]overlay=0:0:eof_action=pass:format=auto[v]"
        cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y"]
        if a.clip:
            s0, s1 = [float(v) for v in a.clip.split(":")]
            cmd += ["-ss", str(s0), "-to", str(s1)]
            fc = f"[1:v]setpts=PTS+{a.at - s0}/TB[ov];[0:v][ov]overlay=0:0:eof_action=pass:format=auto[v]"
            at_a = a.at - s0
        else:
            at_a = a.at
        cmd += ["-i", a.video, "-framerate", "30", "-i", os.path.join(td, "%04d.png")]
        ins, amix = [], ["[0:a]aformat=sample_rates=48000:channel_layouts=stereo[a0]"]; parts = ["[a0]"]
        if not st["soft"]:
            swoosh(sw); ins += ["-i", sw]
            amix.append(f"[{2 + len(ins) // 2 - 1}:a]adelay={int(at_a * 1000)}|{int(at_a * 1000)},aformat=sample_rates=48000:channel_layouts=stereo[s]"); parts.append("[s]")
        if a.sfx:
            ins += (["-ss", str(s0)] if a.clip else []) + ["-i", a.sfx]
            amix.append(f"[{2 + sum(1 for x in ins if x == '-i') - 1}:a]aformat=sample_rates=48000:channel_layouts=stereo[x]"); parts.append("[x]")
        cmd += ins
        if len(parts) > 1:
            fc += ";" + ";".join(amix) + f";{''.join(parts)}amix=inputs={len(parts)}:normalize=0:duration=first" + (",alimiter=limit=-1.5dB:level=disabled" if a.sfx else "") + "[a]"
            maps = ["-map", "[v]", "-map", "[a]"]
        else:
            maps = ["-map", "[v]", "-map", "0:a"]
        cmd += ["-filter_complex", fc] + maps + ["-c:v", "libx264", "-preset", a.preset, "-crf", a.crf, "-pix_fmt", "yuv420p",
                                                 "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", a.out]
        subprocess.run(cmd, check=True)
    print("wrote", a.out)


if __name__ == "__main__":
    main(sys.argv[1:])
