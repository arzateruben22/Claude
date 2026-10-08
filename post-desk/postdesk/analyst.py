"""ANALYST: what's working, in numbers the schedule, the writer and you can use.

Two rules keep the numbers honest:
  * only posts at least a day old count (most of a post's views arrive in its first day)
  * reach is views per follower at the time of posting, so a post doesn't look better just
    because the account grew since

Nothing here is a forecast. "At this pace" lines are straight-line arithmetic, labelled so.
"""
from __future__ import annotations

import math
from bisect import bisect_right
from collections import defaultdict
from datetime import datetime, timedelta
from statistics import median
from typing import Dict, List, Optional

from .config import Config
from .store import Store

MATURE = timedelta(hours=24)
MIN_N = 3            # posts a group needs before the schedule or a chart uses it
MIN_COMPARE = 8      # posts a format needs before a lesson or a proposal names it (the numbers are noisy)
SHRINK = 4           # how hard small groups are pulled toward a typical post
MIN_AUDIENCE = 50    # reach is per follower; tiny accounts would make it jumpy


def oneline(text: str, n: int = 200) -> str:
    """A post on one line, for reports: line breaks become slashes."""
    flat = " / ".join(x.strip() for x in text.splitlines() if x.strip())
    return flat if len(flat) <= n else flat[: n - 1] + "…"


def followers_at(series: List[tuple], when: datetime) -> int:
    """The last follower count recorded at or before `when` (or the first one ever)."""
    if not series:
        return 0
    i = bisect_right([t for t, _ in series], when)
    return series[max(0, i - 1)][1]


def rows(store: Store, cfg: Config, now: datetime, days: float = 3650) -> List[dict]:
    """Every post and quote the desk published, with its latest numbers. Reposts aren't yours, so they're left out."""
    metrics, series, tz = store.metrics(), store.followers(), cfg.tz
    out = []
    for d in store.posted_since(now - timedelta(days=days)):
        if d.kind == "repost" or not d.posted_at:
            continue
        m = metrics.get(d.posted_id)
        views = m.impressions if m else 0
        local = d.posted_at.astimezone(tz)
        out.append({
            "id": d.id, "post_id": d.posted_id, "kind": d.kind, "format": d.format, "text": d.text, "by": d.by,
            "decided_by": d.decided_by, "at": d.posted_at, "hour": local.hour, "minute": local.hour * 60 + local.minute,
            "day": local.date(), "views": views, "eng": m.engagements if m else 0,
            "reach": views / max(followers_at(series, d.posted_at), MIN_AUDIENCE),
            "mature": now - d.posted_at >= MATURE and m is not None,
        })
    return out


def effects(rs: List[dict], rounds: int = 4) -> tuple:
    """Separate the format effect from the hour effect (a median polish on log reach).

    Without this, a format that happened to land on good hours looks better than it is.
    Returns ({format: factor}, {hour: factor}); 1.0 is a typical post.
    """
    mature = [r for r in rs if r["mature"]]
    if not mature:
        return {}, {}
    logs = [math.log(max(r["reach"], 1e-6)) for r in mature]
    mu = median(logs)
    fe: Dict = defaultdict(float)
    he: Dict = defaultdict(float)
    for _ in range(rounds):
        for eff, key, other, okey in ((fe, "format", he, "hour"), (he, "hour", fe, "format")):
            groups = defaultdict(list)
            for r, lg in zip(mature, logs):
                groups[r[key]].append(lg - mu - other[r[okey]])
            for k, v in groups.items():          # small groups are pulled toward typical: 2 posts prove little
                eff[k] = median(v) * len(v) / (len(v) + SHRINK)
            shift = median(eff[r[key]] for r in mature)
            for k in eff:
                eff[k] -= shift
            mu += shift
    return ({k: math.exp(v) for k, v in fe.items()}, {k: math.exp(v) for k, v in he.items()})


def _group(rs: List[dict], key: str) -> Dict:
    mature = [r for r in rs if r["mature"]]
    if not mature:
        return {}
    factors = effects(rs)[0 if key == "format" else 1]
    groups = defaultdict(list)
    for r in mature:
        groups[r[key]].append(r)
    out = {}
    for k, g in groups.items():
        views = sum(r["views"] for r in g)
        out[k] = {"n": len(g), "median": int(median(r["views"] for r in g)),
                  "factor": round(factors.get(k, 1.0), 2),
                  "eng_rate": round(sum(r["eng"] for r in g) / views, 4) if views else 0.0}
    return out


def by_format(rs: List[dict]) -> Dict[str, dict]:
    """Reach by format, adjusted for the hour each post went out."""
    return _group(rs, "format")


def by_hour(rs: List[dict]) -> Dict[int, dict]:
    """Reach by local hour posted, adjusted for format."""
    return _group(rs, "hour")


def hour_scores(rs: List[dict]) -> Dict[int, tuple]:
    """For the schedule: {local hour: (typical reach, posts)}."""
    return {h: (g["factor"], g["n"]) for h, g in by_hour(rs).items()}


def learnings(rs: List[dict]) -> List[str]:
    """Short plain lines for the writer's prompt. Only groups with enough posts say anything."""
    fmts = {k: v for k, v in by_format(rs).items() if v["n"] >= MIN_COMPARE}
    out = []
    if len(fmts) >= 2:
        ranked = sorted(fmts.items(), key=lambda kv: kv[1]["factor"], reverse=True)
        (best, b), (worst, w) = ranked[0], ranked[-1]
        if b["factor"] >= 1.15:
            out.append(f"'{best}' posts reach the most people: {b['factor']:.1f}x a typical post "
                       f"({b['n']} posts, about {b['median']:,} views each). Write more of these.")
        if w["factor"] <= 0.85:
            out.append(f"'{worst}' posts reach the fewest: {w['factor']:.1f}x a typical post ({w['n']} posts). "
                       "Write fewer of these, or make them sharper.")
    mature = sorted((r for r in rs if r["mature"]), key=lambda r: r["reach"], reverse=True)
    if len(mature) >= 6:
        top = mature[0]
        out.append(f"Your best recent post ({top['views']:,} views): \"{oneline(top['text'])}\" "
                   "Learn from its shape, don't copy it.")
    return out


def money(store: Store, cfg: Config, now: datetime, rs: List[dict], followers: int,
          verified_followers: Optional[int] = None) -> dict:
    """Progress toward X's creator payouts, plus what you earned and spent.

    The thresholds are whatever [money] in desk.toml says. X changes them, and the only
    reliable source is Creator Studio, so copy them from there. Views here are your own
    posts' impressions; X counts only views from verified (Premium) users, which the API
    doesn't split out, so this is an upper bound.
    """
    m = cfg.money
    views_90 = sum(r["views"] for r in rs if now - r["at"] <= timedelta(days=90))
    views_7 = sum(r["views"] for r in rs if now - r["at"] <= timedelta(days=7))
    span_days = min(90.0, max(1.0, (now - min((r["at"] for r in rs), default=now)).total_seconds() / 86400))
    pace_90 = int(views_7 / 7 * 90) if span_days >= 7 else None
    verified = m.verified_followers if verified_followers is None else verified_followers
    month = now - timedelta(days=30)
    income = store.income(month)
    by_source = defaultdict(float)
    for _, usd, source, _ in income:
        by_source[source] += usd
    spend = store.spend_by_kind(month)
    x_spend = sum(v for k, v in spend.items() if k != "ai")
    earned = sum(by_source.values())
    return {
        "premium": cfg.account.premium,
        "verified_followers": verified, "need_verified": m.min_verified_followers,
        "views_90d": views_90, "need_views": m.min_impressions_90d, "pace_90d": pace_90,
        "eligible": bool(cfg.account.premium and verified >= m.min_verified_followers
                         and views_90 >= m.min_impressions_90d),
        "followers": followers,
        "earned_30d": round(earned, 2), "earned_by_source": {k: round(v, 2) for k, v in by_source.items()},
        "spent_30d": round(x_spend + spend.get("ai", 0.0), 2), "x_30d": round(x_spend, 2),
        "ai_30d": round(spend.get("ai", 0.0), 2), "net_30d": round(earned - x_spend - spend.get("ai", 0.0), 2),
    }


def media_kit(rs: List[dict], followers_series: List[tuple], now: datetime) -> dict:
    """The numbers a sponsor asks for. Last 30 days, your own posts only."""
    month = [r for r in rs if now - r["at"] <= timedelta(days=30)]
    views = sum(r["views"] for r in month)
    then = followers_at(followers_series, now - timedelta(days=30))
    current = followers_series[-1][1] if followers_series else 0
    fmts = {k: v for k, v in by_format(month).items() if v["n"] >= MIN_N}
    best = max(fmts.items(), key=lambda kv: kv[1]["factor"])[0] if fmts else ""
    return {"followers": current, "growth_30d": current - then if followers_series else 0, "posts_30d": len(month),
            "views_30d": views, "median_views": int(median(r["views"] for r in month)) if month else 0,
            "eng_rate": round(sum(r["eng"] for r in month) / views, 4) if views else 0.0, "best_format": best}


def views_by_day(rs: List[dict], now_local_date, days: int = 14) -> List[list]:
    """Views of the posts published each day (credited to the day they went out)."""
    totals = defaultdict(int)
    for r in rs:
        totals[r["day"]] += r["views"]
    return [[(now_local_date - timedelta(days=i)).isoformat(), totals.get(now_local_date - timedelta(days=i), 0)]
            for i in range(days - 1, -1, -1)]


def render(store: Store, cfg: Config, now: datetime, followers: int, verified_followers: Optional[int] = None) -> str:
    """The `stats` command: everything above as plain text."""
    rs = rows(store, cfg, now)
    if not rs:
        return "No posts yet. Run the desk first (or: python -m postdesk sim --days 14 for the demo)."
    mature = [r for r in rs if r["mature"]]
    lines = [f"@{cfg.account.handle}: {len(rs)} posts so far, {len(mature)} old enough to judge (a day or more).", ""]
    fmts = by_format(rs)
    if fmts:
        lines.append("By format (reach = views per follower, adjusted for the hour posted; 1.0x = typical):")
        for k, v in sorted(fmts.items(), key=lambda kv: kv[1]["factor"], reverse=True):
            flag = "" if v["n"] >= MIN_N else "  (too few to judge)"
            lines.append(f"  {k:<10} {v['factor']:>4.1f}x   {v['n']:>3} posts   ~{v['median']:>7,} views{flag}")
        lines.append("")
    hours = by_hour(rs)
    if hours:
        lines.append("By hour posted, your time zone (adjusted for format):")
        for h, v in sorted(hours.items()):
            bar = "█" * max(1, round(v["factor"] * 8))
            flag = "" if v["n"] >= MIN_N else "  (too few)"
            lines.append(f"  {h:02d}:00  {bar:<20} {v['factor']:.1f}x  {v['n']} posts{flag}")
        lines.append("")
    kit = media_kit(rs, store.followers(), now)
    lines += ["Media kit, last 30 days (for sponsors):",
              f"  followers {kit['followers']:,} ({kit['growth_30d']:+,}) · {kit['posts_30d']} posts · "
              f"{kit['views_30d']:,} views · ~{kit['median_views']:,} per post · "
              f"engagement {kit['eng_rate']:.1%}" + (f" · best format: {kit['best_format']}" if kit['best_format'] else ""),
              ""]
    mo = money(store, cfg, now, rs, followers, verified_followers)
    lines += ["Creator payouts (check Creator Studio for the real rules):",
              f"  Premium: {'yes' if mo['premium'] else 'NO (required)'}",
              f"  verified followers {mo['verified_followers']:,} of {mo['need_verified']:,}",
              f"  views, last 90 days {mo['views_90d']:,} of {mo['need_views']:,}"
              + (f" (at this week's pace: ~{mo['pace_90d']:,} per 90 days, not a forecast)" if mo["pace_90d"] else ""),
              f"  last 30 days: earned ${mo['earned_30d']:.2f}, spent ${mo['spent_30d']:.2f} "
              f"(X ${mo['x_30d']:.2f} + Claude ${mo['ai_30d']:.2f}), net ${mo['net_30d']:+.2f}"]
    return "\n".join(lines)
