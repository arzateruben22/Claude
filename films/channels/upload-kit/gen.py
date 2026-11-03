import json, os, glob, html, shutil
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "../../.."))
OUT = os.environ.get("KIT_OUT") or os.path.join(HERE, "build")   # writes OUT/upload-kit.html + OUT/covers/ (never committed)
os.makedirs(os.path.join(OUT, "covers"), exist_ok=True)
RAW = "https://github.com/arzateruben22/Claude/raw/claude/made-with-claude-film/"
CH = [("physics", "Reality Rulebook", "Physics you can see, slowed down"), ("space", "One More Orbit", "Space, one minute at a time"),
      ("body", "Body Backstage", "What your body is doing right now"), ("whatif", "Possibility Lab", "Impossible questions, worked out"),
      ("skincare", "Skin Sense", "Skin science, under the surface")]
PREFIX = {"physics": "reality-rulebook", "space": "one-more-orbit", "body": "body-backstage", "whatif": "possibility-lab", "skincare": "skin-sense"}
NOTE = {"body": "No. 001 and No. 002 below are the NEW live-scan look (finished 3 Nov). If you already posted the old No. 001, hold the new one and tell Claude: it will go up as a re-release.", "skincare": "No. 001, No. 002 and No. 003 below are the UPGRADED season (film lighting, real skin; each passed 4 of 5), finished 3 Nov. If you saved the older No. 001, use the new one instead. Every Skin Sense description already says \"Education, not medical advice. See a dermatologist about your own skin.\" Posting without a dermatologist's review is your call."}
HOLD = {"body": ("On hold: new look in production", "Body Backstage is being rebuilt with high-tech visuals and simpler, more surprising facts. Its next episodes appear here when the new season is ready.")}
NOTE_BODY = "No. 001 is the current look, ready to post now; the new live-scan look takes over from a later episode."
WAIT = {"skincare": ("In production", "This episode of the new season is still being made. It appears here when it is ready. Don't post anything from the old season.")}
for f in glob.glob(os.path.join(OUT, "covers", "*.jpg")): os.remove(f)
esc = lambda s: html.escape(s or "", quote=True)
def join(cap, tags):
    cap = (cap or "").strip(); tags = (tags or "").strip()
    return cap if (not tags or tags in cap) else (cap + "\n\n" + tags)
def copybtn(label, text):
    return f'<button class="copy" type="button" data-copy="{esc(text)}">{esc(label)}</button>'
secs, nav, n_eps = [], [], 0
for slug, name, line in CH:
    eps = []
    for d in sorted(glob.glob(f"{ROOT}/films/channels/{slug}/ep0*")):
        out = os.path.join(d, "out"); pj = os.path.join(out, "posting.json")
        if not os.path.exists(pj): continue
        masters = [f for f in os.listdir(out) if f.endswith("-9x16.mp4")]
        if not masters: continue
        m = masters[0]; yt = m.replace(".mp4", "-youtube.mp4"); base = m.replace("-9x16.mp4", "")
        p = json.load(open(pj)); n = os.path.basename(d)[2:]
        if (slug in HOLD and n not in ("01", "02")) or not m.startswith(PREFIX[slug] + "-") or not os.path.exists(os.path.join(out, yt)):
            wh, wt = HOLD.get(slug) or WAIT.get(slug, ("Getting the new name", f"This short is being updated so its title and end card say {name}. It appears here when it is ready. Don't post the old file."))
            eps.append(f'''
    <article class="ep wait"><div class="body"><p class="eyebrow">No. {int(n):03d}</p><h3>{esc(wh)}</h3>
      <p class="note">{esc(wt)}</p></div></article>''')
            continue
        cov = os.path.join(out, base + "-cover-480.jpg"); thumb = os.path.join(out, base + "-thumb.jpg")
        cname = f"covers/{slug}-{n}.jpg"
        if os.path.exists(cov): shutil.copy(cov, os.path.join(OUT, cname))
        rel = os.path.relpath(out, ROOT) + "/"
        y, t, i = p.get("youtube", {}), p.get("tiktok", {}), p.get("instagram", {})
        key = f"{slug}-{n}"
        rows = f'''
      <div class="plat"><span class="pname">YouTube Shorts</span>
        <a class="dl" href="{RAW}{rel}{yt}" target="_blank" rel="noopener">1440p video</a>
        {copybtn("Title", y.get("title"))}{copybtn("Description", join(y.get("caption"), y.get("hashtags")))}{copybtn("Sources comment", y.get("pinnedComment"))}
        <label class="done"><input type="checkbox" id="{key}-yt" data-k="{key}-yt"> Posted</label></div>
      <div class="plat"><span class="pname">TikTok</span>
        <a class="dl" href="{RAW}{rel}{m}" target="_blank" rel="noopener">1080p video</a>
        {copybtn("Caption", join(t.get("caption"), t.get("hashtags")))}{copybtn("Sources comment", t.get("pinnedComment"))}
        <label class="done"><input type="checkbox" id="{key}-tt" data-k="{key}-tt"> Posted</label></div>
      <div class="plat"><span class="pname">Instagram Reels</span>
        <a class="dl" href="{RAW}{rel}{m}" target="_blank" rel="noopener">1080p video</a>
        {copybtn("Caption", join(i.get("caption"), i.get("hashtags")))}{copybtn("Sources comment", i.get("pinnedComment"))}
        <label class="done"><input type="checkbox" id="{key}-ig" data-k="{key}-ig"> Posted</label></div>'''
        title = (t.get("title") or y.get("title") or base).split(" (")[0]
        eps.append(f'''
    <article class="ep">
      <img class="cover" src="{cname}" alt="Cover of {esc(name)} No. {int(n):03d}" width="96" height="171" loading="lazy">
      <div class="body"><p class="eyebrow">No. {int(n):03d}</p><h3>{esc(title)}</h3>
      <p class="files"><a href="{RAW}{rel}{base}-cover.jpg" target="_blank" rel="noopener">9:16 cover</a> · <a href="{RAW}{rel}{base}-thumb.jpg" target="_blank" rel="noopener">YouTube thumbnail</a></p>{rows}
      </div></article>''')
        n_eps += 1
    comp = f"{ROOT}/films/channels/{slug}/compilations/vol01"
    long = ""
    desc = open(comp + "/description.md").read() if os.path.exists(comp + "/description.md") else ""
    if slug in HOLD:
        long = ""
    elif os.path.exists(comp + "/vol01-16x9.mp4") and name not in desc:
        long = '''
    <article class="ep wait long"><div class="body"><p class="eyebrow">Long video · YouTube</p><h3>Volume 1: being rebuilt</h3>
      <p class="note">The long video is rebuilt from the renamed shorts once all six are ready. Don't post the old one.</p></div></article>'''
    elif os.path.exists(comp + "/vol01-16x9.mp4"):
        rel = os.path.relpath(comp, ROOT) + "/"
        long = f'''
    <article class="ep long"><div class="body"><p class="eyebrow">Long video · 2560×1440 · YouTube</p><h3>Volume 1</h3>
      <div class="plat"><span class="pname">YouTube</span>
        <a class="dl" href="{RAW}{rel}vol01-16x9.mp4" target="_blank" rel="noopener">1440p video</a>
        <a class="dl" href="{RAW}{rel}thumbnail.jpg" target="_blank" rel="noopener">Thumbnail</a>
        {copybtn("Description and chapters", desc)}
        <label class="done"><input type="checkbox" id="{slug}-vol01" data-k="{slug}-vol01"> Posted</label></div></div></article>'''
    nav.append(f'<a href="#{slug}">{esc(name)}</a>')
    secs.append(f'''
  <section class="channel" id="{slug}" data-ch="{slug}">
    <header class="chead"><h2>{esc(name)}</h2><p>{esc(line)} · {sum(1 for e in eps if 'class="ep wait' not in e)} of {len(eps)} shorts ready</p></header>
    {f'<p class="note">{esc(NOTE[slug])}</p>' if slug in NOTE else ""}
    {"".join(eps)}{long}
  </section>''')
tpl = open(os.path.join(HERE, "template.html")).read()
page = tpl.replace("%%NAV%%", "".join(nav)).replace("%%SECTIONS%%", "".join(secs)).replace("%%COUNT%%", f"{n_eps} short" + ("" if n_eps == 1 else "s"))
open(os.path.join(OUT, "upload-kit.html"), "w").write(page)
print(n_eps, "episodes;", len(os.listdir(os.path.join(OUT, "covers"))), "covers;", round(len(page)/1024), "KB")
