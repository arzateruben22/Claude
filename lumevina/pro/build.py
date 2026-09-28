"""Build every Lumevina Studio product, its listing photos and the Etsy catalog.

Run:  python3 pro/build.py            (everything)
      python3 pro/build.py 01 05      (just those products; listing data is always rebuilt)
      python3 pro/build.py --no-images

Writes pro/dist/<product>/files/   what the buyer downloads (uploaded to Etsy as is)
       pro/dist/<product>/images/  listing photos, 2500 x 2000
       pro/dist/etsy/              listings.json, listings.csv, shop art
Needs Python packages python-docx, openpyxl and pymupdf, Node with Playwright,
and LibreOffice (to calculate the spreadsheets).
"""
import csv, json, os, shutil, subprocess, sys, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "src"))

import doc as D                      # noqa: E402
import start as START                # noqa: E402
from fill import make_fillable       # noqa: E402

DIST = os.path.join(HERE, "dist")
TMP = os.path.join(HERE, ".build")
NODE = os.environ.get("NODE", shutil.which("node") or "/opt/node22/bin/node")


def node_env():
    env = dict(os.environ)
    if "NODE_PATH" not in env:
        try:
            root = subprocess.run(["npm", "root", "-g"], capture_output=True, text=True).stdout.strip()
        except OSError:
            root = ""
        env["NODE_PATH"] = root or "/opt/node22/lib/node_modules"
    return env


class Ctx:
    """What a product module gets: a place to put files and ways to make them."""

    def __init__(self, mod):
        self.mod = mod
        self.slug = mod.SLUG
        self.name = mod.NAME
        self.out = os.path.join(DIST, self.slug, "files")
        self.tmp = os.path.join(TMP, self.slug)
        os.makedirs(self.out, exist_ok=True)
        os.makedirs(self.tmp, exist_ok=True)
        self.jobs, self.after, self.files = [], [], []

    def path(self, name):
        return os.path.join(self.out, name)

    def write_html(self, stem, text):
        p = os.path.join(self.tmp, stem + ".html")
        open(p, "w", encoding="utf-8").write(text)
        return p

    def pdf(self, doc, filename, size="letter", fillable=False, extra_css="", html_text=None):
        stem = os.path.splitext(filename)[0].replace(" ", "_").replace("&", "and")
        src = self.write_html(stem + "_" + size, html_text or D.html(doc, size, extra_css))
        raw = os.path.join(self.tmp, stem + "_" + size + ".pdf")
        fields = os.path.join(self.tmp, stem + "_" + size + ".json")
        final = self.path(filename)
        self.jobs.append({"kind": "pdf", "html": src, "pdf": raw, "fields": fields,
                          "width": 816 if size == "letter" else 794, "height": 1056 if size == "letter" else 1123})
        if fillable:
            self.after.append(lambda: make_fillable(raw, fields, final))
        else:
            self.after.append(lambda: shutil.copyfile(raw, final))
        self.files.append(filename)
        return raw

    def docx(self, doc, filename, size="letter"):
        # pictures (face maps) go into Word as PNGs made from the same SVG
        pngs = {}
        for page in doc["pages"]:
            for b in walk(page["blocks"]):
                if b[0] == "svg":
                    pngs[id(b)] = svg_png(b[1], os.path.join(self.tmp, "svg_%d.png" % len(pngs)))
        doc = dict(doc, _png=pngs)
        D.docx(doc, self.path(filename), size)
        self.files.append(filename)

    def start_here(self, formats=("word", "pdf")):
        d = START.doc(self.name, self.mod.START, formats)
        self.pdf(d, "Start Here - %s.pdf" % short(self.name))

    def shot(self, html_text, stem, selector, width, height, scale=1, kind="jpeg", quality=88, out=None):
        src = self.write_html(stem, html_text)
        out = out or os.path.join(self.tmp, stem)
        self.jobs.append({"kind": "shot", "html": src, "out": out, "selector": selector, "width": width,
                          "height": height, "scale": scale, "type": kind, "quality": quality})
        return out

    def add(self, filename):
        self.files.append(filename)


def short(name):
    return name.replace("Client ", "").replace(" & ", " and ")


def walk(blocks):
    for b in blocks:
        yield b
        if b[0] == "cols":
            yield from walk(b[1])
            yield from walk(b[2])


def svg_png(markup, out):
    import pymupdf
    svg = markup
    if "xmlns" not in svg:
        svg = svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"', 1)
    d = pymupdf.open(stream=svg.encode(), filetype="svg")
    d[0].get_pixmap(dpi=300, alpha=False).save(out)
    return out


def render(jobs):
    if not jobs:
        return []
    jf = os.path.join(TMP, "jobs.json")
    json.dump(jobs, open(jf, "w"))
    r = subprocess.run([NODE, os.path.join(HERE, "src", "render.cjs"), jf], capture_output=True, text=True,
                       env=node_env())
    if r.returncode:
        sys.exit(r.stderr)
    return json.loads(r.stdout.strip().splitlines()[-1])


def products():
    import p01_intake, p02_aftercare, p03_facemap, p04_menu, p05_membership, p06_books, p07_scripts, \
        p08_planner, p09_journal, p10_bundle
    return [p01_intake, p02_aftercare, p03_facemap, p04_menu, p05_membership, p06_books, p07_scripts,
            p08_planner, p09_journal, p10_bundle]


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    images = "--no-images" not in sys.argv
    mods = products()
    todo = [m for m in mods if not args or m.SLUG[:2] in args]
    os.makedirs(TMP, exist_ok=True)
    ctxs = []
    for m in todo:
        shutil.rmtree(os.path.join(DIST, m.SLUG, "files"), ignore_errors=True)
        c = Ctx(m)
        m.build(c)
        ctxs.append(c)
    report = render([j for c in ctxs for j in c.jobs])
    for c in ctxs:
        for fn in c.after:
            fn()
    problems = [r for r in report if r.get("over") or r.get("errors")]
    for r in report:
        if "pages" in r:
            print("%-58s %2d pages  spare %s" % (r["job"][:58], r["pages"], r["spare"]))
    for p in problems:
        print("PROBLEM", p)
    bundle = [m for m in mods if m.SLUG.startswith("10")][0]
    if any(m is bundle for m in todo):
        bundle.pack(DIST, mods)
    import listings
    listings.write(mods, DIST)
    if images:
        import mockups
        mockups.build(mods, DIST, TMP, render, only=[m.SLUG for m in todo])
    for m in mods:
        d = os.path.join(DIST, m.SLUG, "files")
        if os.path.isdir(d):
            size = sum(os.path.getsize(os.path.join(d, f)) for f in os.listdir(d))
            print("%-32s %d files  %.1f MB" % (m.SLUG, len(os.listdir(d)), size / 1e6))
    if problems:
        sys.exit(1)


if __name__ == "__main__":
    main()
