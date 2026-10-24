"""The sign-off sheet for whoever checks an episode's claims, from its claims.json.

    python3 -I kits/cinema/script/claims_sheet.py <episode dir> [--reviewer "a physicist"]

Writes <episode>/review/CLAIMS-REVIEW.md: one row per claim with the spoken sentence, what it
asserts, the source and how it was checked, and an empty box for the reviewer.
"""
import json
import sys
from pathlib import Path


def cell(s):
    return str(s or "").replace("|", "\\|").replace("\n", " ")


def main(argv):
    ep = Path(argv[0])
    opt = dict(zip(argv[1::2], argv[2::2]))
    who = opt.get("--reviewer", "a subject expert")
    claims = json.loads((ep / "claims.json").read_text())
    title = next((l[2:].strip() for l in (ep / "README.md").read_text().splitlines() if l.startswith("# ")), ep.name)
    excerpt = sum(1 for c in claims if c.get("verified_via") == "search excerpt")
    lines = [f"# Claims sign-off: {title}", "",
             f"For {who}. Every factual sentence the narrator says or the screen shows is below. "
             f"{excerpt} of {len(claims)} were checked against a search excerpt of the source, not the page itself: "
             "open each link, confirm the claim, and tick the box (or write the fix in Notes). "
             "The episode does not post until every row is ticked.", "",
             "| # | Spoken / on screen | The claim | Source | Checked by | OK | Notes |", "|---|---|---|---|---|---|---|"]
    for c in claims:
        src = f"[{cell(c.get('source_title'))}]({c.get('source_url')})" if c.get("source_url") else "—"
        lines.append(f"| {c['id']} | {cell(c['sentence'])} | {cell(c['claim'])} | {src} (accessed {c.get('accessed', '?')}) "
                     f"| {cell(c.get('verified_via'))}; status {cell(c.get('status'))} | ☐ | {cell(c.get('note'))} |")
    lines += ["", "Signed off by: ____________________  Date: __________", ""]
    out = ep / "review" / "CLAIMS-REVIEW.md"
    out.parent.mkdir(exist_ok=True)
    out.write_text("\n".join(lines))
    print(f"{out}: {len(claims)} claims")


if __name__ == "__main__":
    main(sys.argv[1:])
