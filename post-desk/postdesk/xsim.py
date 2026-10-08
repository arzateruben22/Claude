"""A make-believe X for the demo and the tests. Same methods as the real client.

The audience is invented: a post's reach depends on the account's followers, the hour,
the format (lists and how-tos travel further than questions here), its length, and luck
(now and then a post takes off). The desk never sees those rules; it has to learn them
from the numbers, the same way it would on the real X. Nothing here is a forecast.
"""
from __future__ import annotations

import math
import random
import re
from datetime import datetime, timedelta
from typing import Dict, List
from zoneinfo import ZoneInfo

from .budget import Budget
from .demo_content import TRENDING
from .guard import weighted_length
from .models import Metric, Signal
from .xapi import velocity

FORMAT_REACH = {"take": 1.15, "list": 1.5, "how_to": 1.35, "question": 0.8, "story": 1.0, "data": 1.2,
                "quote": 0.75, "repost": 0.3}
FORMAT_TALK = {"question": 1.8, "take": 1.3, "story": 1.1}   # posts that get replies


def hour_reach(h: float) -> float:
    """Mornings and evenings are busy; the middle of the night is not."""
    return 0.45 + 0.65 * math.exp(-((h - 9) / 2.3) ** 2) + 0.8 * math.exp(-((h - 20) / 2.6) ** 2)


class DemoX:
    name = "demo"

    def __init__(self, start: datetime, budget: Budget, tz: ZoneInfo, seed: int = 7, handle: str = "yourhandle"):
        self.rng = random.Random(seed)
        self.budget, self.tz, self.handle = budget, tz, handle
        self.followers = 240.0
        self.posts: Dict[str, dict] = {}
        self.last = start
        self.n = 0
        self.timeline: List[dict] = []
        self.next_trend = start - timedelta(hours=10)

    # -- the world -------------------------------------------------------------------------
    def advance(self, now: datetime) -> None:
        if now <= self.last:
            return
        gained = 0.0
        for p in self.posts.values():
            before, after = self._impressions(p, self.last), self._impressions(p, now)
            gained += (after - before) * p["follow_rate"]
        days = (now - self.last).total_seconds() / 86400
        self.followers = max(0.0, self.followers + gained - self.followers * 0.002 * days)   # a little churn
        self.last = now
        while self.next_trend <= now:                      # other people post too
            author, text = TRENDING[self.rng.randrange(len(TRENDING))]
            self.timeline.append({"id": f"t{len(self.timeline) + 1:05d}", "author": author, "text": text,
                                  "created": self.next_trend, "heat": self.rng.lognormvariate(0, 0.9)})
            self.next_trend += timedelta(minutes=self.rng.uniform(20, 70))
        self.timeline = [t for t in self.timeline if now - t["created"] < timedelta(days=2)]

    def _impressions(self, p: dict, at: datetime) -> float:
        age_h = max(0.0, (at - p["created"]).total_seconds() / 3600)
        return p["reach"] * (1 - math.exp(-age_h / 5))

    # -- the same calls as the real client --------------------------------------------------
    def me(self, now: datetime) -> dict:
        self.advance(now)
        self.budget.require(now, "owned_read")
        self.budget.charge(now, "owned_read", 1, "followers")
        return {"id": "me", "username": self.handle, "followers": int(self.followers), "verified": True,
                "verified_followers": int(self.followers * 0.31)}

    def post(self, now: datetime, text: str, quote_of: str = "", fmt: str = "take") -> str:
        self.advance(now)
        self.budget.require(now, "post")
        self.n += 1
        pid = f"p{self.n:05d}"
        n = weighted_length(text)
        length = 1.0 if 60 <= n <= 220 else 0.8
        luck = self.rng.lognormvariate(0, 0.6) * (6 if self.rng.random() < 0.03 else 1)
        hour = now.astimezone(self.tz)
        reach = (50 + self.followers * 1.1) * FORMAT_REACH.get(fmt, 1.0) * hour_reach(hour.hour + hour.minute / 60) \
            * length * luck * 2.2
        rate = 0.014 * self.rng.lognormvariate(0, 0.3) * (1.25 if fmt in ("list", "how_to") else 1.0)
        self.posts[pid] = {"created": now, "reach": reach, "rate": rate, "fmt": fmt,
                           "talk": FORMAT_TALK.get(fmt, 0.8), "follow_rate": 0.0016 * (1.3 if fmt == "list" else 1.0)}
        self.budget.charge(now, "post", 1, f"post {pid}")
        return pid

    def repost(self, now: datetime, post_id: str) -> None:
        self.budget.require(now, "post")
        self.budget.charge(now, "post", 1, f"repost {post_id}")

    def search(self, now: datetime, query: str, max_results: int, since: datetime, authors: bool = False) -> List[Signal]:
        self.advance(now)
        self.budget.require(now, "read_post", max_results)
        wanted = {h.lower() for h in re.findall(r"(?<!-)from:(\w+)", query)}
        found = [t for t in self.timeline if t["created"] >= since and (not wanted or t["author"].lower() in wanted)]
        found = found[-max_results:]
        out = []
        for t in found:
            age_h = max(0.2, (now - t["created"]).total_seconds() / 3600)
            likes = int(t["heat"] * 140 * min(age_h, 8) ** 0.8)
            reposts, replies = likes // 9, likes // 14
            out.append(Signal(t["id"], "x", t["text"], f"https://x.com/{t['author']}/status/{t['id']}",
                              "", t["created"], likes, reposts, replies,
                              velocity(likes, reposts, replies, 0, t["created"], now), "u_" + t["author"]))
        self.budget.charge(now, "read_post", len(out), f"search: {query[:60]}")
        return out

    def authors(self, now: datetime, user_ids: List[str]) -> Dict[str, str]:
        if not user_ids:
            return {}
        self.budget.require(now, "read_user", len(user_ids))
        self.budget.charge(now, "read_user", len(user_ids), "authors")
        return {u: u[2:] for u in user_ids}

    def my_metrics(self, now: datetime, post_ids: List[str]) -> List[Metric]:
        self.advance(now)
        self.budget.require(now, "owned_read", len(post_ids))
        out = []
        for pid in post_ids:
            p = self.posts.get(pid)
            if not p:
                continue
            imp = self._impressions(p, now)
            eng = imp * p["rate"]
            out.append(Metric(pid, now, int(imp), int(eng * 0.62), int(eng * 0.12), int(eng * 0.12 * p["talk"]),
                              int(eng * 0.04), int(eng * 0.1), int(eng * 0.05)))
        self.budget.charge(now, "owned_read", len(out), "your post numbers")
        return out

