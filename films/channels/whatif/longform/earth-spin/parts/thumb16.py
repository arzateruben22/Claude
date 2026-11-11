"""16:9 YouTube thumbnail options for the long film: stills from the film's own scene (hero pose, no readout), a lighten-blend of a few frames for the Sun streak, 1-4 big words top-left.
  python3 -I .../parts/thumb16.py            renders the three options into ../../compilations/s3/thumb-options/"""
import glob, json, subprocess, sys
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont
HERE = Path(__file__).resolve().parent; ES = HERE.parent; repo = HERE.parents[5]
OUT = ES.parent.parent / "compilations/s3/thumb-options"; OUT.mkdir(parents=True, exist_ok=True)
OPTS = {
 "A-90-minute-day": dict(t=28, streak=0.3, keys=1.5, text="90-MINUTE DAY", hero=dict(arms=0.9, tilt=-0.2, px=0.7, fs=1.5, cz=2.7, lx=-0.1, ly=0.78)),
 "B-oceans-pile-up": dict(t=28, streak=0, keys=6, text="OCEANS PILE UP", fx={"ocean": [-5, 9999]}, hero=dict(arms=0.2, tilt=0.0, px=0.7, fs=1.4, lx=-0.1, ly=0.8, cy=0.65, cz=2.9)),
 "C-8x-lighter": dict(t=28, streak=0.4, keys=2, text="8x LIGHTER", hero=dict(arms=0.95, tilt=0.0, lift=0.4, px=0.7, fs=1.5, cz=2.9, lx=-0.1, ly=0.85)),
}
sel = sys.argv[1:] or list(OPTS)
for name in sel:
    o = OPTS[name]
    f = json.loads((ES / "film.json").read_text())
    f.update(captions=[], badges=[], voice=[], thumb=True, hero=o["hero"], theme="../../../../theme.json", scene="../../scene.mjs")
    f["title"] = {**f["title"], "t0": -20.0, "t1": -19.0, "sig": -18.0}; f["endCard"] = 99999.0
    f["world"] = {**f["world"], "keys": [[0.0, o["keys"]], [9999.0, o["keys"]]]}
    if o.get("fx"): f["fx"] = o["fx"]
    D = ES / "thumbs16" / name; D.mkdir(parents=True, exist_ok=True); (D / "film.json").write_text(json.dumps(f, indent=1))
    n = 48 if o["streak"] else 1
    times = ",".join(f"{o['t'] + o['streak'] * i / 47:.3f}" for i in range(n)) if o["streak"] else str(o["t"])
    subprocess.run(["node", str(repo / "kits/cinema/film/render.mjs"), "--film", str(D), "--tier", "final", "--aspect", "16x9", "--times", times, "--build", f"/tmp/th16-{name}", "--share-cpu"], check=True, capture_output=True)
    pngs = sorted(glob.glob(f"/tmp/th16-{name}/final/16x9/frames/*/*.png")); im = Image.open(pngs[0]).convert("RGB")
    for p in pngs[1:]: im = ImageChops.lighter(im, Image.open(p).convert("RGB"))
    fs = int(im.height * 0.19); font = ImageFont.truetype(str(ES.parents[1] / "fonts/BricolageGrotesque-VF.ttf"), fs)
    try: font.set_variation_by_name("ExtraBold")
    except Exception: pass
    words = o["text"].split(" "); lines = [" ".join(words)] if len(o["text"]) <= 9 else [" ".join(words[:len(words) // 2 or 1]), " ".join(words[len(words) // 2 or 1:])]
    x0, y0 = int(im.width * 0.04), int(im.height * 0.06)
    sh = Image.new("RGBA", im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(sh)
    for i, ln in enumerate(lines): d.text((x0, y0 + i * fs * 1.05), ln, font=font, fill=(0, 0, 0, 235))
    im = Image.alpha_composite(im.convert("RGBA"), sh.filter(ImageFilter.GaussianBlur(im.height * 0.012)))
    d = ImageDraw.Draw(im)
    for i, ln in enumerate(lines): d.text((x0, y0 + i * fs * 1.05), ln, font=font, fill=(255, 255, 255, 255), stroke_width=max(3, fs // 40), stroke_fill=(12, 14, 18, 255))
    im.convert("RGB").save(OUT / f"{name}.jpg", quality=92, subsampling=0); print(name, im.size)
