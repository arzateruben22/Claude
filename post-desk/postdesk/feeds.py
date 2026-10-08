"""Free idea sources: RSS and Atom feeds you choose in desk.toml (no X reads, no cost).

Headlines are raw material for the writer. They're third-party text, so the writer is told
to treat them as data, never as instructions.
"""
from __future__ import annotations

import hashlib
import random
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from typing import List

from .demo_content import demo_pool
from .models import Signal

MAX_BYTES = 2_000_000


def _when(text: str):
    if not text:
        return None
    try:
        dt = parsedate_to_datetime(text)
    except (TypeError, ValueError):
        try:
            dt = datetime.fromisoformat(text.strip().replace("Z", "+00:00"))
        except ValueError:
            return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def parse(xml: bytes, now: datetime) -> List[Signal]:
    root = ET.fromstring(xml)
    out = []
    items = root.iter("item")
    atom = "{http://www.w3.org/2005/Atom}"
    for it in items:
        title, link = (it.findtext("title") or "").strip(), (it.findtext("link") or "").strip()
        out.append((title, link, _when(it.findtext("pubDate") or it.findtext("{http://purl.org/dc/elements/1.1/}date"))))
    for it in root.iter(atom + "entry"):
        link_el = it.find(atom + "link")
        out.append(((it.findtext(atom + "title") or "").strip(), link_el.get("href", "") if link_el is not None else "",
                    _when(it.findtext(atom + "updated") or it.findtext(atom + "published"))))
    signals = []
    for title, link, created in out:
        if not title:
            continue
        age_h = max(0.5, (now - created).total_seconds() / 3600) if created else 24
        signals.append(Signal(id="rss-" + hashlib.sha1((link or title).encode()).hexdigest()[:16], source="rss",
                              text=title[:300], url=link, created=created, score=round(20 / age_h, 3)))
    return signals


class Feeds:
    def __init__(self, urls: List[str], http=None):
        if http is None:
            import requests

            http = requests.Session()
        self.urls, self.http = urls, http
        self.errors: List[str] = []

    def fetch(self, now: datetime) -> List[Signal]:
        out, self.errors = [], []
        for url in self.urls:
            try:
                resp = self.http.request("GET", url, timeout=15, headers={"User-Agent": "post-desk/1.0"})
                if resp.status_code != 200:
                    raise ValueError(f"HTTP {resp.status_code}")
                out += parse(resp.content[:MAX_BYTES], now)
            except Exception as exc:   # one broken feed shouldn't stop the others
                self.errors.append(f"{url}: {exc}")
        return out


class DemoFeeds:
    def __init__(self, seed: int = 7, style: str = "informative"):
        self.rng = random.Random(seed)
        self.headlines = demo_pool(style)[3]

    def fetch(self, now: datetime) -> List[Signal]:
        day = now.date().toordinal()
        picks = random.Random(day).sample(self.headlines, 3)
        return [Signal(id="rss-demo-" + hashlib.sha1(h.encode()).hexdigest()[:12], source="rss", text=h,
                       url=f"https://example.com/news/{day}-{i}",
                       created=now - timedelta(hours=2 + i), score=round(10 / (2 + i), 3)) for i, h in enumerate(picks)]
