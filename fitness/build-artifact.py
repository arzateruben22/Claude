#!/usr/bin/env python3
"""Bundle the SchFLR site into artifact.html — one self-contained file.

Inlines css/styles.css, js/, fonts/ (as data URIs), and any media/ images
referenced from index.html that exist on disk. Missing images are left as
relative paths; the page's onerror handlers turn them into labeled slots.
"""
import base64, os, re

os.chdir(os.path.dirname(os.path.abspath(__file__)))

html = open('index.html').read()
css = open('css/styles.css').read()
js = open('js/main.js').read()
live = open('js/booking-live.js').read()
gsap = open('js/vendor/gsap.min.js').read()
st = open('js/vendor/ScrollTrigger.min.js').read()

for name in os.listdir('fonts'):
    b64 = base64.b64encode(open(f'fonts/{name}', 'rb').read()).decode()
    css = css.replace(f'../fonts/{name}', f'data:font/woff2;base64,{b64}')

def inline_media(m):
    path = m.group(1)
    if os.path.exists(path):
        ext = path.rsplit('.', 1)[-1].lower().replace('jpg', 'jpeg')
        b64 = base64.b64encode(open(path, 'rb').read()).decode()
        return f'src="data:image/{ext};base64,{b64}"'
    return m.group(0)

html = re.sub(r'src="(media/[^"]+)"', inline_media, html)
html = re.sub(r'srcset="(media/[^"]+)"',
              lambda m: inline_media(m).replace('src="', 'srcset="', 1), html)

body = html.split('<body>', 1)[1].rsplit('</body>', 1)[0]
body = re.sub(r'\s*<script src="[^"]+"></script>', '', body)
title = re.search(r'<title>(.*?)</title>', html).group(1)

out = f'<title>{title}</title>\n<style>\n{css}\n</style>\n{body}\n'
out += f'<script>{gsap}</script>\n<script>{st}</script>\n'
out += f'<script>\n{live}\n</script>\n<script>\n{js}\n</script>\n'
open('artifact.html', 'w').write(out)
print('artifact.html bytes:', len(out))
