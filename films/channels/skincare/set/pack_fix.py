"""Post-process Prism's posting pack for Skin Sense: channel name, AI-illustration wording on every platform, and TikTok sources
as full links (one numbered thread within TikTok's 150-character comments). Run after prism-studio/scripts/posting-pack.ts.
  python3 films/channels/skincare/set/pack_fix.py ep04 ep05 ep06"""
import json, re, sys
from pathlib import Path
R = Path(__file__).resolve().parent.parent
AI = "AI-generated illustrations, animated in code"
def fix(s): return s.replace("Outer Layer", "Skin Sense").replace("code-rendered animation", AI).replace("Animation: code-rendered", "Illustrations: AI-generated, animated in code")
for ep in sys.argv[1:]:
    o = R / ep / "out"; d = json.loads((o / "posting.json").read_text())
    for p in d.values():
        if isinstance(p, dict):
            for k, v in p.items():
                if isinstance(v, str): p[k] = fix(v)
                elif isinstance(v, list): p[k] = [fix(x) if isinstance(x, str) else x for x in v]
    srcs = re.findall(r"^(\d+)\. .+? — ([^\n]*?): (https?://\S+)$", d["youtube"]["caption"], re.M)
    items = [f"{n}. {u}" for n, _, u in srcs]
    th, cur = [], ""
    for it in items:
        if cur and len(cur) + 3 + len(it) > 130: th.append(cur); cur = it
        else: cur = f"{cur} · {it}" if cur else it
    if cur: th.append(cur)
    th = [f"Sources {i}/{len(th)}: {t}" for i, t in enumerate(th, 1)]
    d["tiktok"]["pinnedComment"], d["tiktok"]["replies"] = th[0], th[1:]
    for t in th: assert len(t) <= 150, (ep, len(t))
    (o / "posting.json").write_text(json.dumps(d, indent=1, ensure_ascii=False))
    md = fix((o / "POSTING.md").read_text())
    tail = "\n\n".join(th)
    md = re.sub(r"(## TikTok.*?)(?=\n## )", lambda m: re.sub(r"\*\*Pinned comment.*", "**Pinned comment + replies (full sources)**\n\n" + "\n\n".join(f"```\n{t}\n```" for t in th), m.group(1), flags=re.S), md, flags=re.S) if "## TikTok" in md else md
    (o / "POSTING.md").write_text(md); print(ep, len(th), "tiktok source comments; posting.md", len(md))
