"""The download library: one page listing every finished video, each with full-quality download links
straight from this (public) repository, its cover, thumbnail and posting text. Published as an Artifact
so the owner can open it on a phone; re-run after each collection and republish to the same URL.

  python3 -I films/library.py OUTDIR            # writes OUTDIR/index.html + OUTDIR/covers/*.jpg

An episode is listed when its out/*-9x16.mp4 is committed and it is not in HOLD (a render that predates
the 26 Oct fact audit and waits for its new final). Remove an episode from HOLD when its new final is
collected. Long videos: films/channels/<ch>/compilations/vol*/vol*-16x9.mp4.
"""
import html
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO, BRANCH = "arzateruben22/Claude", "claude/made-with-claude-film"
RAW = f"https://github.com/{REPO}/raw/{BRANCH}/"
BLOB = f"https://github.com/{REPO}/blob/{BRANCH}/"
HOLD: set[str] = set()                        # e.g. {"films/channels/space/ep02"} while a committed render predates an audit
CHANNELS = [  # (folder, name, label, colour) in the studio's own colours (prism-studio/src/domain/catalog.ts)
    ("physics", "Rest Frame", "PHYSICS", "#2F5BFF"),
    ("space", "Light Minute", "SPACE", "#7D63F0"),
    ("body", "Meanwhile, Inside", "BODY", "#FF6F5E"),
]
EPISODES = 6


def probe(f):
    j = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration,size", "-of", "json", str(f)],
                                  check=True, capture_output=True, text=True).stdout)["format"]
    return float(j["duration"]), int(j["size"])


def length(s):
    return f"{int(s // 60)}:{int(round(s % 60)):02d}" if s >= 60 else f"{s:.0f} s"


def title_of(ep):
    head = (ep / "script.md").read_text().splitlines()[0] if (ep / "script.md").exists() else ""
    m = re.search(r'No\. (\d+): "([^"]+)"', head)
    return (int(m.group(1)), m.group(2)) if m else (int(ep.name[2:]), ep.name)


def rel(p):
    return str(Path(p).relative_to(ROOT))


def link(href, text, primary=False):
    return f'<a class="btn{" primary" if primary else ""}" href="{html.escape(href)}" target="_blank" rel="noopener">{text}</a>'


def main(out):
    out = Path(out)
    (out / "covers").mkdir(parents=True, exist_ok=True)
    total, count, sections = 0, 0, []
    for folder, name, label, colour in CHANNELS:
        base = ROOT / "films/channels" / folder
        cards, coming, longs = [], [], []
        for vid in sorted(base.glob("compilations/vol*/vol*-16x9.mp4")):
            d = vid.parent
            dur, size = probe(vid)
            total, count = total + size, count + 1
            t = (d / "description.md").read_text().splitlines()[0].strip() if (d / "description.md").exists() else d.name
            thumb = d / "thumbnail.jpg"
            if thumb.exists():
                subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(thumb), "-vf", "scale=640:-2", "-q:v", "4",
                                str(out / "covers" / f"{folder}-{d.name}-thumb.jpg")], check=True)
            btns = [link(RAW + rel(vid), "Download video", True)]
            if thumb.exists():
                btns.append(link(RAW + rel(thumb), "Thumbnail"))
            for f, lab in (("chapters.txt", "Chapters"), ("description.md", "Description")):
                if (d / f).exists():
                    btns.append(link(BLOB + rel(d / f), lab))
            img = f'<img src="covers/{folder}-{d.name}-thumb.jpg" alt="" loading="lazy" width="640" height="360">' if thumb.exists() else ""
            longs.append(f'''<article class="long">{img}<div class="body"><span class="kicker">Long video · YouTube · 16:9</span>
<h3>{html.escape(t)}</h3><p class="meta">{d.name} · {length(dur)} · {size / 1e6:.0f} MB</p><div class="btns">{"".join(btns)}</div></div></article>''')
        for n in range(1, EPISODES + 1):
            ep = base / f"ep{n:02d}"
            num, t = title_of(ep)
            vids = sorted((ep / "out").glob("*-9x16.mp4"))
            if not vids or rel(ep) in HOLD:
                coming.append(f"<li><span>No. {num:03d}</span> {html.escape(t)}</li>")
                continue
            vid = vids[0]
            stem = vid.name[: -len("-9x16.mp4")]
            dur, size = probe(vid)
            total, count = total + size, count + 1
            cover480, cover, thumb = (ep / "out" / f"{stem}-cover-480.jpg", ep / "out" / f"{stem}-cover.jpg", ep / "out" / f"{stem}-thumb.jpg")
            img = ""
            if cover480.exists():
                shutil.copyfile(cover480, out / "covers" / cover480.name)
                img = f'<img src="covers/{cover480.name}" alt="" loading="lazy" width="480" height="853">'
            btns = [link(RAW + rel(vid), "Download video", True)]
            if cover.exists():
                btns.append(link(RAW + rel(cover), "Cover"))
            if thumb.exists():
                btns.append(link(RAW + rel(thumb), "Thumbnail"))
            if (ep / "out/POSTING.md").exists():
                btns.append(link(BLOB + rel(ep / "out/POSTING.md"), "Posting text"))
            cards.append(f'''<article class="ep">{img}<div class="body"><span class="kicker">No. {num:03d} · {length(dur)} · {size / 1e6:.0f} MB</span>
<h3>{html.escape(t)}</h3><div class="btns">{"".join(btns)}</div></div></article>''')
        if not longs:
            coming.append("<li><span>vol01</span> the long video (episodes 1–5 back to back, 16:9)</li>")
        done = len(cards)
        sections.append(f'''<section class="channel" style="--ch:{colour}" aria-labelledby="{folder}">
<header class="ch-head"><span class="label">{label}</span><h2 id="{folder}">{html.escape(name)}</h2>
<p class="meta">{done} of {EPISODES} episodes{" · long video ready" if longs else ""}</p></header>
{"".join(longs)}
<div class="grid">{"".join(cards)}</div>
{f'<div class="coming"><h3>Coming next</h3><ul>{"".join(coming)}</ul></div>' if coming else ""}
</section>''')
    page = TEMPLATE.replace("{{COUNT}}", str(count)).replace("{{SIZE}}", f"{total / 1e6:.0f}").replace("{{SECTIONS}}", "\n".join(sections))
    (out / "index.html").write_text(page)
    print(f"{out}/index.html: {count} videos, {total / 1e6:.0f} MB, {len(list((out / 'covers').glob('*.jpg')))} covers")


TEMPLATE = """<title>Video Library</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@500&display=swap">
<style>
/* Layout: the studio's night palette; one column of channels, each a strip of covers with its download buttons */
:root {
  --bg: #090B0F; --panel: #12161D; --line: rgba(222,229,240,.12); --ink: #EEF1F6; --muted: #A3ACBA; --btn: #1B212B;
  --display: "Instrument Serif", Georgia, serif; --ui: "Bricolage Grotesque", "Segoe UI", system-ui, sans-serif;
  --mono: "JetBrains Mono", ui-monospace, Menlo, monospace; color-scheme: dark;
}
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--ink); font: 15px/1.5 var(--ui); padding-block: 24px 64px;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
main { max-width: 72rem; margin: 0 auto; display: grid; gap: 44px; }
h1, h2, h3 { margin: 0; text-wrap: balance; }
h1 { font: 400 clamp(2.4rem, 7vw, 3.6rem)/1 var(--display); letter-spacing: -.01em; }
h2 { font: 400 2rem/1.1 var(--display); }
h3 { font: 700 1.05rem/1.25 var(--ui); }
p { margin: 0; }
.label, .kicker { font: 500 .72rem/1.3 var(--mono); letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
.meta { font: 500 .8rem/1.4 var(--mono); color: var(--muted); font-variant-numeric: tabular-nums; }
.intro { display: grid; gap: 12px; max-width: 44rem; }
.intro p { color: var(--muted); }
.intro b { color: var(--ink); font-weight: 600; }
.channel { display: grid; gap: 18px; }
.ch-head { display: grid; gap: 4px; border-top: 2px solid var(--ch); padding-top: 14px; }
.ch-head .label { color: var(--ch); filter: brightness(1.35); }
.grid { display: grid; gap: 14px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 210px), 1fr)); }
article { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; overflow: hidden; display: grid; min-width: 0; }
article img { display: block; width: 100%; height: auto; max-width: 100%; background: #000; }
.ep img { aspect-ratio: 9 / 16; object-fit: cover; }
.long { grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); align-items: stretch; }
.long img { aspect-ratio: 16 / 9; object-fit: cover; height: 100%; }
@media (max-width: 640px) { .long { grid-template-columns: 1fr; } }
.body { padding: 12px 14px 14px; display: grid; gap: 8px; align-content: start; min-width: 0; }
.btns { display: flex; flex-wrap: wrap; gap: 6px; }
.btn { font: 600 .82rem/1 var(--ui); color: var(--ink); text-decoration: none; background: var(--btn); border: 1px solid var(--line);
  border-radius: 999px; padding: 9px 12px; min-height: 36px; display: inline-flex; align-items: center; }
.btn.primary { background: var(--ink); color: var(--bg); border-color: var(--ink); }
.btn:hover { border-color: var(--muted); }
.btn:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
.coming { display: grid; gap: 6px; }
.coming h3 { font: 500 .72rem/1.3 var(--mono); letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
.coming ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 4px; color: var(--muted); }
.coming li span { font: 500 .78rem var(--mono); color: var(--ink); margin-right: 6px; }
.foot { color: var(--muted); font-size: .85rem; max-width: 44rem; display: grid; gap: 6px; }
@media (prefers-reduced-motion: no-preference) { .btn { transition: border-color .15s; } }
</style>
<main>
  <header class="intro">
    <span class="label">Prism Studio · library</span>
    <h1>Video Library</h1>
    <p><b>{{COUNT}} videos ready, {{SIZE}} MB.</b> Every button gets the full-quality file. <b>Download video</b> saves the MP4: on iPhone, Safari asks to download it, then it's in Files → Downloads, and Share → Save Video puts it in Photos. <b>Posting text</b> opens the titles, captions, hashtags and sources for each platform.</p>
    <p>Before an episode goes up, its specialist check is still open (each script is marked draft until a physicist, physiologist or fact-checker signs off).</p>
  </header>
{{SECTIONS}}
  <footer class="foot">
    <p>Files come straight from the studio's GitHub repository, which is public: anyone with these links can download them.</p>
  </footer>
</main>
"""

if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "library"))
