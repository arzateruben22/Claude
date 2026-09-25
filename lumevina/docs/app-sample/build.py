"""Build the Lumevina app sample: inline the font and images into one page.

Run:  python3 build.py            (writes index.html next to this file)
"""
import base64, io, os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.normpath(os.path.join(HERE, "..", ".."))


def uri(data, mime):
    return "data:%s;base64,%s" % (mime, base64.b64encode(data).decode())


def img(rel, width=None, height=None, fmt="WEBP", q=74):
    im = Image.open(os.path.join(SITE, rel))
    if width:
        h = height or round(im.height * width / im.width)
        im = im.convert("RGBA" if im.mode == "RGBA" else "RGB")
        if height:   # cover-crop to the box
            r = max(width / im.width, height / im.height)
            im = im.resize((round(im.width * r), round(im.height * r)), Image.LANCZOS)
            l, t = (im.width - width) // 2, (im.height - height) // 2
            im = im.crop((l, t, l + width, t + height))
        else:
            im = im.resize((width, h), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, fmt, quality=q)
    return uri(buf.getvalue(), "image/" + fmt.lower())


def raw(rel, mime):
    with open(os.path.join(SITE, rel), "rb") as f:
        return uri(f.read(), mime)


FIELDS = {
    "FONT": base64.b64encode(open(os.path.join(SITE, "fonts", "inter-var.woff2"), "rb").read()).decode(),
    "TYPOS_JS": open(os.path.join(SITE, "js", "ask-typos.js")).read(),   # shared with the website chat
    "ICON": raw("img/apple-touch-icon.png", "image/png"),
    "LOGO": raw("img/logo-light.png", "image/png"),
    "S_CUSTOM": img("img/services/custom.webp", 480),
    "S_AGELESS": img("img/services/ageless.webp", 480),
    "S_DERMA": img("img/services/dermaplane.webp", 480),
    "S_ACNE": img("img/services/acne.webp", 480),
    "S_CONSULT": img("img/services/consult.webp", 480),
    "S_BRAZIL": img("img/services/brazilian.webp", 480),
    "S_UNDERARM": img("img/services/underarm.webp", 480),
    "P_CLEANSER": img("img/retail/glymed-cleanser.webp", 336, 208),
    "P_BOOSTER": img("img/retail/le-mieux-tgf-booster.webp", 336, 208),
    "P_SPF": img("img/retail/daily-spf-30.webp", 336, 208),
}

html = open(os.path.join(HERE, "app.tpl.html")).read()
for k, v in FIELDS.items():
    html = html.replace("{{%s}}" % k, v)
assert "{{" not in html, "unfilled placeholder"
with open(os.path.join(HERE, "index.html"), "w") as f:
    f.write(html)
print("index.html", len(html) // 1024, "KB")
