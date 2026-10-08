"""GUARD: every draft is checked before it can post.

"block" checks stop a post outright. "warn" checks send it to you even when the desk is
allowed to post on its own. Several rules come straight from X's automation rules: no
automated @mentions or replies to other people, no engagement bait, no duplicate posts,
no hashtag stuffing to ride trends. Others protect the account: no avoided topics, a
disclosure on affiliate links, a source for numbers.
"""
from __future__ import annotations

import re
from typing import Iterable, List

from .config import Config
from .models import Check, Draft

URL = re.compile(r"https?://\S+|www\.\S+", re.I)
MENTION = re.compile(r"(?<![\w@])@[A-Za-z0-9_]{1,15}\b")
HASHTAG = re.compile(r"(?<![\w&])#[A-Za-z_][\w]*")
BAIT = [r"\blike if\b", r"\brt if\b", r"\bretweet if\b", r"\brepost if\b", r"\bfollow (me )?for\b",
        r"\bcomment below\b", r"\bdrop an? .{0,20}\bbelow\b", r"\btag (a|someone|a friend|\d+)\b",
        r"\bfollow back\b", r"\bf4f\b", r"\bgiveaway\b", r"\bsmash (that|the) like\b"]
NUMBERS = re.compile(r"\b\d+(\.\d+)?\s?(%|x\b|percent\b|million\b|billion\b|k\b|times\b)", re.I)
SHORT_URL = 23          # X counts every link as 23 characters
MIN_COMMENTARY = 40     # a quote post earns only when it adds real commentary


def weighted_length(text: str) -> int:
    """Roughly how X counts: links are 23, most other characters 1, wide (CJK) characters 2."""
    n = 0
    for ch in URL.sub("\0", text):
        if ch == "\0":
            n += SHORT_URL
        elif "\u1100" <= ch <= "\uffdc" and not ("\u2000" <= ch <= "\u2bff"):
            n += 2
        else:
            n += 1
    return n


def _shingles(text: str) -> set:
    words = re.findall(r"[a-z0-9']+", text.lower())
    return {" ".join(words[i:i + 3]) for i in range(max(1, len(words) - 2))} if words else set()


def similarity(a: str, b: str) -> float:
    sa, sb = _shingles(a), _shingles(b)
    if not sa or not sb:
        return 0.0
    return len(sa & sb) / len(sa | sb)


def check(d: Draft, cfg: Config, recent: Iterable[str] = ()) -> List[Check]:
    out: List[Check] = []

    def add(rule: str, ok: bool, note: str = "", level: str = "block") -> None:
        out.append(Check(rule, bool(ok), note, level))

    if d.kind == "repost":
        curated = d.target_author.lower() in cfg.topics.curated_reposts
        add("curated account", curated, "" if curated else f"@{d.target_author} isn't on your curated list", "warn")
        add("not your own post", d.target_author.lower() != cfg.account.handle.lower(), "reposting yourself looks spammy")
        return out

    text = d.text.strip()
    add("not empty", bool(text), "nothing to post")
    n = weighted_length(text)
    hard = 25_000 if cfg.account.premium else 280
    add("fits on X", n <= hard, f"{n} characters (X's limit here is {hard:,})")
    if n <= hard:
        add("short", n <= cfg.writer.max_chars, f"{n} characters; you aim for {cfg.writer.max_chars}", "warn")
    mentions = MENTION.findall(text)
    add("no @mentions", not mentions, "automated mentions of other people break X's rules: " + " ".join(mentions)
        if mentions else "")
    tags = HASHTAG.findall(text)
    tags = [t for t in tags if t.lower() != cfg.money.disclosure.lower()]
    add("hashtags", len(tags) <= cfg.writer.hashtags_max, f"{len(tags)} hashtags (max {cfg.writer.hashtags_max})")
    urls = URL.findall(text)
    if urls and cfg.writer.links == "never":
        add("links", False, "links are off in desk.toml")
    elif urls:
        add("link cost", False, "a post with a link costs about $0.20 through the API", "warn")
    aff = [u for u in urls if any(dom.lower() in u.lower() for dom in cfg.money.affiliate_domains)]
    if aff:
        add("disclosure", cfg.money.disclosure.lower() in text.lower(), f"affiliate links need {cfg.money.disclosure}")
    low = text.lower()
    bait = [p for p in BAIT if re.search(p, low)]
    add("no engagement bait", not bait, "asks for likes, reposts or follows" if bait else "")
    hit = [t for t in cfg.topics.avoid if re.search(r"\b" + re.escape(t.lower()) + r"\b", low + " " + d.topic.lower())]
    add("avoided topics", not hit, ("touches: " + ", ".join(hit)) if hit else "")
    best = max((similarity(text, r) for r in recent if r), default=0.0)
    add("not a repeat", best < 0.6, f"{best:.0%} like a recent post" if best >= 0.6 else "")
    letters = [c for c in text if c.isalpha()]
    if len(letters) >= 20:
        caps = sum(c.isupper() for c in letters) / len(letters)
        add("not shouting", caps < 0.6, "mostly capitals", "warn")
    if NUMBERS.search(text) and not d.source_url:
        add("numbers have a source", False, "it states a number with no source: check it", "warn")
    if d.kind == "quote":
        add("real commentary", len(text) >= MIN_COMMENTARY,
            f"a quote needs {MIN_COMMENTARY}+ characters of your own take to count as original")
        add("quote target", bool(d.target_id), "nothing to quote")
    return out


def may_auto_post(d: Draft, cfg: Config) -> bool:
    """Only clean original posts (and, if you allow it, reposts of curated accounts) skip your review."""
    if cfg.approval.mode != "auto_originals" or d.blocked:
        return False
    if d.kind == "original":
        return not d.warned
    if d.kind == "repost":
        return cfg.approval.auto_curated_reposts and not d.warned
    return False        # quote posts always wait for you
