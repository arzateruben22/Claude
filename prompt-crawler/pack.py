"""Pack the crawler into one self-contained HTML file.

    python3 pack.py                          # writes prompt-crawler.html next to this file
    python3 pack.py --out ~/Desktop/crawler.html
    python3 pack.py --fragment --out x.html  # no html/head/body, for hosts that add their own

The site itself needs no build step: index.html works as is. This only makes a
single file you can send to a phone or drop anywhere.
"""
from __future__ import annotations

import argparse
from pathlib import Path

HERE = Path(__file__).resolve().parent


def parts() -> tuple[str, str, str]:
    index = (HERE / "index.html").read_text(encoding="utf-8")
    body = index.split("<!--BODY-->", 1)[1].split("<!--/BODY-->", 1)[0]
    links = [line.strip() for line in index.splitlines()
             if "fonts.googleapis.com" in line or "fonts.gstatic.com" in line]
    css = (HERE / "crawler.css").read_text(encoding="utf-8")
    head = "<title>Prompt Crawler</title>\n" + "\n".join(links) + f"\n<style>{css}</style>\n"
    scripts = "".join(f"<script>{(HERE / name).read_text(encoding='utf-8')}</script>\n"
                      for name in ("analyze.js", "crawler.js"))
    return head, body, scripts


def page() -> str:
    head, body, scripts = parts()
    return ("<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n"
            "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\n"
            f"{head}</head>\n<body>\n{body}{scripts}</body>\n</html>\n")


def fragment() -> str:
    head, body, scripts = parts()
    return head + body + scripts


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", type=Path, default=HERE / "prompt-crawler.html")
    ap.add_argument("--fragment", action="store_true", help="leave out html/head/body")
    args = ap.parse_args()
    html = fragment() if args.fragment else page()
    args.out.expanduser().write_text(html, encoding="utf-8")
    print(f"Saved {args.out} ({len(html.encode()) / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
