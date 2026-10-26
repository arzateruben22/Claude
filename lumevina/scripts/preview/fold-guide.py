#!/usr/bin/env python3
"""The product guide as one page for the hub preview: fonts, logo and product photos inlined,
with a link to the PDF beside it.  fold-guide.py <docs/product-guide/index.html> <out.html>"""
import base64, os, re, sys

src, out = sys.argv[1], sys.argv[2]
base = os.path.dirname(os.path.abspath(src))
s = open(src, encoding="utf-8").read()
MIME = {".woff2": "font/woff2", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".webp": "image/webp", ".png": "image/png"}

def data(rel):
    p = os.path.normpath(os.path.join(base, rel))
    return "data:%s;base64,%s" % (MIME[os.path.splitext(p)[1]], base64.b64encode(open(p, "rb").read()).decode())

s = re.sub(r'url\("(\.\./\.\./fonts/[^"]+)"\)', lambda m: 'url("%s")' % data(m.group(1)), s)
s = re.sub(r'src="((?:\.\./\.\./)?img/[^"]+)"', lambda m: 'src="%s"' % data(m.group(1)), s)
bar = ('<style>.pdf{position:sticky;top:0;z-index:2;display:flex;justify-content:flex-end;padding:10px 16px;background:rgba(255,255,255,.92);'
       'border-bottom:1px solid #D7C9B8}.pdf a{font:600 13px/1 Inter,system-ui,sans-serif;color:#4A342A;text-decoration:none;'
       'border:1px solid #7D5A44;border-radius:999px;padding:9px 14px}.pdf a:focus-visible{outline:2px solid #7D5A44;outline-offset:2px}'
       '@media print{.pdf{display:none}}@media (max-width:760px){.wrap{padding:16px}.cover{height:auto;min-height:90vh}'
       '.rows,.basics,.rt{grid-template-columns:1fr!important}.prod{grid-template-columns:72px 1fr!important}.ph{width:72px!important;height:90px!important}}</style>'
       '<div class="pdf"><a href="Lumevina-Product-Guide.pdf" download>Download the PDF</a></div>')
s = s.replace('<body>', '<body>' + bar, 1)
open(out, "w", encoding="utf-8").write(s)
print("guide: %d KB" % (len(s) // 1024))
