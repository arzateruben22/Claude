"""Build the Lumevina app sample: inline the font and images into one page.

Run:  python3 build.py            (writes index.html next to this file)
"""
import base64, io, json, os
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


def wallpaper(rel, width=760, aspect=390 / 844, q=72):
    """The lock screen: a top-down water still turned upright (clockwise), cut to the phone's shape."""
    im = Image.open(os.path.join(SITE, rel)).convert("RGB").transpose(Image.Transpose.ROTATE_270)
    w = round(im.height * aspect)
    left = max(0, min(im.width - w, round(im.width * 0.55 - w / 2)))   # the koi circle sits just right of centre
    im = im.crop((left, 0, left + w, im.height)).resize((width, round(width / aspect)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=q)
    return uri(buf.getvalue(), "image/webp")


def raw(rel, mime):
    with open(os.path.join(SITE, rel), "rb") as f:
        return uri(f.read(), mime)


def ask_bundle():
    """knowledge/eval/bundle.json (from knowledge/scripts/build-bundle.mjs): her instructions, the studio's facts
    and policies, her Skin Playbook, her hard lines and the shelf, as window.LUMEVINA_ASK_BUNDLE"""
    b = json.load(open(os.path.join(SITE, "knowledge", "eval", "bundle.json")))
    keep = {k: b.get(k) for k in ("builtAt", "prompt", "facts", "factsV3", "knowledge", "knowledgeEmpty", "general", "hardLines", "voice")}
    keep["shelf"] = [{k: p.get(k) for k in ("id", "name", "brand", "type", "size", "price", "about")} for p in b["shelf"]]
    return "/* knowledge/eval/bundle.json */\nwindow.LUMEVINA_ASK_BUNDLE = " + json.dumps(keep, ensure_ascii=False).replace("<", "\\u003c") + ";"


FIELDS = {
    "FONT": base64.b64encode(open(os.path.join(SITE, "fonts", "inter-var.woff2"), "rb").read()).decode(),
    "TYPOS_JS": open(os.path.join(SITE, "js", "ask-typos.js")).read(),   # shared with the website chat
    "ICON": raw("img/apple-touch-icon.png", "image/png"),
    "LOCK": wallpaper("img/water/koi.webp"),
    # the website's treatment photos (js/services.js PHOTOS), so the app and the site match
    "S_CUSTOM": img("img/services/custom-facial.webp", 480),
    "S_AGELESS": img("img/services/ageless-grace.webp", 480),
    "S_NEWCLIENT": img("img/services/consultation.webp", 480),
    "S_ACNE": img("img/services/acne-bootcamp.webp", 480),
    "S_BRAZIL": img("img/services/brazilian-wax.webp", 480),
    "S_BODY": img("img/services/body-wax.webp", 480),
    "P_CLEANSER": img("img/products/glymed-plus-glycolic-facial-cleanser.webp", 336, 208),   # the shop's own photos (js/catalog.js)
    "P_ESSENCE": img("img/products/glymed-plus-revitalizing-essence-nad.webp", 336, 208),
    "P_SPF": img("img/retail/daily-spf-30.webp", 336, 208),
    # the website chat's rules, and what it knows (as scripts/build-single-file.mjs puts it in the website)
    "RULES_JS": open(os.path.join(SITE, "js", "ask-rules.js")).read(),
    "ASK_BUNDLE": ask_bundle(),
}

html = open(os.path.join(HERE, "app.tpl.html")).read()
for k, v in FIELDS.items():
    html = html.replace("{{%s}}" % k, v)
assert "{{" not in html, "unfilled placeholder"
with open(os.path.join(HERE, "index.html"), "w") as f:
    f.write(html)
print("index.html", len(html) // 1024, "KB")
