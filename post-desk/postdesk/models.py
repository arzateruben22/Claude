"""What the desk passes around: drafts, rule checks, signals from the scout."""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime
from typing import List, Optional

KINDS = ("original", "quote", "repost")
# queued -> approved -> scheduled -> posted   (or rejected / expired / failed / blocked)
STATUSES = ("queued", "approved", "posted", "rejected", "expired", "failed", "blocked")


@dataclass
class Check:
    rule: str
    ok: bool
    note: str = ""
    level: str = "block"      # block: can't post · warn: needs a human look

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class Draft:
    id: str
    created: datetime
    kind: str                 # original | quote | repost
    text: str = ""
    format: str = "take"
    topic: str = ""
    source_url: str = ""      # where an idea or a number came from
    target_id: str = ""       # the post being quoted or reposted
    target_author: str = ""
    target_text: str = ""
    status: str = "queued"
    checks: List[Check] = field(default_factory=list)
    by: str = "you"           # who wrote it: "claude", "sample" (demo) or "you"
    why: str = ""             # the writer's one-line reason
    posted_id: str = ""
    posted_at: Optional[datetime] = None
    error: str = ""
    decided_by: str = ""      # who approved or rejected it: "you", "auto" or "demo reviewer"

    @property
    def blocked(self) -> bool:
        return any(not c.ok and c.level == "block" for c in self.checks)

    @property
    def warned(self) -> bool:
        return any(not c.ok and c.level == "warn" for c in self.checks)


@dataclass
class Signal:
    """Something worth reacting to: a fast-rising post on X, or a headline from a free feed."""

    id: str
    source: str               # x | rss
    text: str
    url: str = ""
    author: str = ""
    created: Optional[datetime] = None
    likes: int = 0
    reposts: int = 0
    replies: int = 0
    score: float = 0.0        # engagement per hour, weighted
    author_id: str = ""       # X user id (searches skip usernames: looking them up costs extra)


@dataclass
class Metric:
    post_id: str
    updated: datetime
    impressions: int = 0
    likes: int = 0
    reposts: int = 0
    replies: int = 0
    quotes: int = 0
    bookmarks: int = 0
    profile_clicks: int = 0

    @property
    def engagements(self) -> int:
        return self.likes + self.reposts + self.replies + self.quotes + self.bookmarks
