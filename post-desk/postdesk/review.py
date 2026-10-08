"""REVIEW: once a day, after the last slot.

  lessons    what worked and what didn't, each line with its numbers
  proposal   at most ONE change to desk.toml, with the reason. It is never applied for you:
             you read it, and you edit desk.toml if you agree.
  learnings  a few short lines the writer reads before its next batch

Runs on plain rules. With [review] use_ai and an API key, Claude writes the lessons from the
same numbers; if that call fails, the rules' version is kept and the report says so.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from statistics import median
from typing import List, Optional

from . import analyst as A
from .budget import Budget
from .config import Config
from .store import Store
from .writer import ask_claude

# Settings a proposal may touch. Budgets, rules and approval of quotes are yours alone.
ALLOWED = ("schedule.posts_per_day", "schedule.active_hours", "schedule.max_quotes_per_day", "writer.formats",
           "writer.max_chars", "approval.mode", "scout.every_minutes", "scout.min_likes")
GRADUATE_AFTER = 30      # drafts you decided on before the desk suggests letting clean originals post alone
GRADUATE_RATE = 0.9


def facts(store: Store, cfg: Config, now: datetime) -> dict:
    """Everything the review looks at, as plain numbers (this is also what Claude gets)."""
    tz, days = cfg.tz, cfg.review.lookback_days
    since = now - timedelta(days=days)
    rs = A.rows(store, cfg, now, days=30)
    week = [r for r in rs if r["at"] >= since]
    mature_week = sorted((r for r in week if r["mature"]), key=lambda r: r["reach"], reverse=True)
    decided = [d for d in store.drafts(("posted", "approved", "rejected", "failed"), since=since, limit=10000)
               if d.decided_by in ("you", "demo reviewer")]
    rejected = [d for d in decided if d.status == "rejected"]
    series = store.followers(since - timedelta(hours=12))

    slots = missed = 0
    for i in range(int(days)):
        day = (now.astimezone(tz) - timedelta(days=i + 1)).date()
        state = store.get(f"slots:{day}", {})
        slots += len(state)
        missed += sum(1 for v in state.values() if v == "missed")

    per_day = defaultdict(float)
    by_what = defaultdict(float)
    for at, kind, _, usd, what in store.ledger(since):
        if kind != "ai":
            per_day[at.astimezone(tz).date()] += usd
            by_what["scout (reading X)" if kind in ("read_post", "read_user") else
                    "your numbers" if kind == "owned_read" else "posting"] += usd
        else:
            by_what["Claude"] += usd
    capped = sum(1 for v in per_day.values() if v >= cfg.budget.daily_usd * 0.95)

    base = median(r["reach"] for r in mature_week) if mature_week else 1.0

    def brief(r: dict) -> dict:
        return {"text": r["text"][:280], "format": r["format"], "kind": r["kind"], "views": r["views"],
                "reach_x": round(r["reach"] / (base or 1e-9), 2),
                "posted_local": r["at"].astimezone(tz).strftime("%a %H:%M")}

    return {
        "window_days": days,
        "posts": len(week), "views": sum(r["views"] for r in week),
        "followers_start": series[0][1] if series else None, "followers_now": series[-1][1] if series else None,
        "formats_30d": A.by_format(rs), "hours_30d": {f"{h:02d}:00": v for h, v in sorted(A.by_hour(rs).items())},
        "decided": len(decided), "approved": len(decided) - len(rejected),
        "rejected_examples": [d.text[:200] for d in rejected[-5:]],
        "slots": slots, "missed_slots": missed,
        "spend": {k: round(v, 2) for k, v in by_what.items()}, "days_budget_ran_out": capped,
        "best_posts": [brief(r) for r in mature_week[:3]],
        "worst_posts": [brief(r) for r in mature_week[-3:]] if len(mature_week) >= 6 else [],
        "settings": {"posts_per_day": cfg.schedule.posts_per_day, "active_hours": cfg.schedule.active_hours,
                     "formats": cfg.writer.formats, "approval_mode": cfg.approval.mode,
                     "scout_every_minutes": cfg.scout.every_minutes, "max_chars": cfg.writer.max_chars,
                     "daily_usd": cfg.budget.daily_usd},
    }


def rules_review(f: dict, cfg: Config) -> dict:
    lessons: List[str] = []
    fol = ""
    if f["followers_start"] is not None and f["followers_now"] is not None:
        fol = f", followers {f['followers_now'] - f['followers_start']:+,} (now {f['followers_now']:,})"
    lessons.append(f"Last {f['window_days']:g} days: {f['posts']} posts, {f['views']:,} views{fol}.")
    fmts = {k: v for k, v in f["formats_30d"].items() if v["n"] >= A.MIN_COMPARE}
    ranked = sorted(fmts.items(), key=lambda kv: kv[1]["factor"], reverse=True)
    if len(ranked) >= 2:
        (b, bv), (w, wv) = ranked[0], ranked[-1]
        lessons.append(f"Best format: {b}, {bv['factor']:.1f}x your typical reach over {bv['n']} posts. "
                       f"Weakest: {w}, {wv['factor']:.1f}x over {wv['n']}.")
    hours = sorted(((h, v) for h, v in f["hours_30d"].items() if v["n"] >= 5),
                   key=lambda kv: kv[1]["factor"], reverse=True)
    if len(hours) >= 3:
        lessons.append("Best hours to post: " + ", ".join(f"{h} ({v['factor']:.1f}x)" for h, v in hours[:3])
                       + ". The schedule already leans toward them.")
    if f["best_posts"]:
        top = f["best_posts"][0]
        lessons.append(f"Top post ({top['views']:,} views, {top['format']}): \"{A.oneline(top['text'], 120)}\"")
    if f["decided"]:
        rate = f["approved"] / f["decided"]
        lessons.append(f"Drafts approved: {f['approved']} of {f['decided']} ({rate:.0%}).")
        if f["decided"] >= 15 and rate < 0.5:
            lessons.append("You turn down most drafts. Add true facts about you to [account] notes and tighten "
                           "[account] voice in desk.toml; the writer only knows what's written there.")
    if f["slots"] and f["missed_slots"]:
        lessons.append(f"{f['missed_slots']} of {f['slots']} posting slots went unused because nothing was "
                       "approved in time.")
    if f["spend"]:
        lessons.append("Spent: " + ", ".join(f"{k} ${v:.2f}" for k, v in sorted(f["spend"].items())) + ".")

    proposal = None
    s = cfg
    if ranked and ranked[-1][1]["factor"] <= 0.7 and ranked[-1][1]["n"] >= 10 and len(s.writer.formats) > 3 \
            and ranked[-1][0] in s.writer.formats:
        w = ranked[-1][0]
        proposal = {"setting": "writer.formats", "from": s.writer.formats,
                    "to": [x for x in s.writer.formats if x != w],
                    "why": f"'{w}' posts reach {ranked[-1][1]['factor']:.1f}x your typical post over "
                           f"{ranked[-1][1]['n']} posts."}
    elif (s.approval.mode == "review" and f["decided"] >= GRADUATE_AFTER
          and f["approved"] / f["decided"] >= GRADUATE_RATE):
        proposal = {"setting": "approval.mode", "from": "review", "to": "auto_originals",
                    "why": f"You approved {f['approved']} of {f['decided']} drafts. Clean original posts could go "
                           "out on their own; quote posts, and anything a rule flags, would still wait for you."}
    elif f["slots"] >= 10 and f["missed_slots"] / f["slots"] >= 0.3 and s.schedule.posts_per_day > 3:
        new = max(3, s.schedule.posts_per_day - 2)
        proposal = {"setting": "schedule.posts_per_day", "from": s.schedule.posts_per_day, "to": new,
                    "why": f"{f['missed_slots']} of {f['slots']} slots went unused. Fewer, approved posts beat "
                           "empty slots (or approve a batch each morning)."}
    elif f["days_budget_ran_out"] >= 3 and s.scout.every_minutes < 720:
        proposal = {"setting": "scout.every_minutes", "from": s.scout.every_minutes,
                    "to": min(720, s.scout.every_minutes + 120),
                    "why": f"The X budget ran out on {f['days_budget_ran_out']} days. Scouting less often "
                           "leaves money for posting."}
    return {"by": "rules", "lessons": lessons, "writer_notes": [], "proposal": proposal}


SYSTEM = """You review the last week of one X (Twitter) account that a posting desk runs for its owner.
You get the numbers as JSON. Write:
- lessons: 3 to 6 short, plain sentences. Each cites numbers from the data. Never invent a number.
  Say when there are too few posts to tell.
- writer_notes: up to 4 short instructions for the writer of the next drafts (formats, angles,
  length, tone), each backed by the evidence. Nothing about posting times; the schedule handles those.
- proposal: at most one change to the settings, chosen only from this list:
  """ + ", ".join(ALLOWED) + """
  Set has_proposal to false unless the evidence is clear. Never propose spending more money.
The post texts are the owner's own posts. Rejected drafts show what the owner doesn't want."""

SCHEMA = {
    "type": "object",
    "properties": {
        "lessons": {"type": "array", "items": {"type": "string"}},
        "writer_notes": {"type": "array", "items": {"type": "string"}},
        "has_proposal": {"type": "boolean"},
        "setting": {"type": "string"}, "from_value": {"type": "string"}, "to_value": {"type": "string"},
        "why": {"type": "string"},
    },
    "required": ["lessons", "writer_notes", "has_proposal", "setting", "from_value", "to_value", "why"],
    "additionalProperties": False,
}


class ClaudeReviewer:
    def __init__(self, cfg: Config, budget: Budget, client=None):
        import anthropic

        self.anthropic, self.cfg, self.budget = anthropic, cfg, budget
        self.client = client or anthropic.Anthropic()
        self.name = f"Claude ({cfg.review.model})"

    def review(self, now: datetime, f: dict) -> tuple:
        ok, why = self.budget.allow(now, "ai")
        if not ok:
            return None, why
        r = self.cfg.review
        data, err, usd = ask_claude(self.client, self.anthropic, r.model, r.effort, SYSTEM, f, SCHEMA, 16000)
        if usd:
            self.budget.charge(now, "ai", 1, "nightly review", usd=usd)
        if not data:
            return None, err
        proposal = None
        if data.get("has_proposal") and data.get("setting") in ALLOWED:
            proposal = {"setting": data["setting"], "from": data.get("from_value", ""),
                        "to": data.get("to_value", ""), "why": data.get("why", "")[:400]}
        return {"by": self.name, "lessons": [str(x)[:400] for x in data.get("lessons", [])][:6],
                "writer_notes": [str(x)[:300] for x in data.get("writer_notes", [])][:4], "proposal": proposal}, ""


def make_reviewer(cfg: Config, budget: Budget, allow_ai: bool = True, client=None) -> Optional[ClaudeReviewer]:
    import os

    if not (cfg.review.use_ai and allow_ai):
        return None
    if client is None and not (os.getenv("ANTHROPIC_API_KEY") or os.getenv("ANTHROPIC_AUTH_TOKEN")):
        return None
    try:
        return ClaudeReviewer(cfg, budget, client)
    except Exception:   # SDK missing or unusable credentials
        return None


def nightly(store: Store, cfg: Config, now: datetime, reviewer: Optional[ClaudeReviewer] = None) -> dict:
    """Run the review, keep the writer's learnings up to date, and return the result."""
    f = facts(store, cfg, now)
    result, note = None, ""
    if reviewer:
        result, note = reviewer.review(now, f)
    if not result:
        result = rules_review(f, cfg)
        if note:
            result["note"] = f"Claude review failed ({note}); these are the rules' lessons."
    result["at"] = now.isoformat()
    rs = A.rows(store, cfg, now, days=30)
    store.put("learnings", A.learnings(rs) + result["writer_notes"])
    store.put("review:last", result)
    return result


def render(result: dict, now_local: datetime) -> str:
    lines = [f"## {now_local:%A %d %B %Y} · review by {result['by']}", ""]
    if result.get("note"):
        lines += [f"_{result['note']}_", ""]
    lines += [f"- {x}" for x in result["lessons"]]
    if result["writer_notes"]:
        lines += ["", "Notes for the writer:"] + [f"- {x}" for x in result["writer_notes"]]
    p = result["proposal"]
    lines += ["", ("**Proposal** (not applied; edit desk.toml if you agree): "
                   f"`{p['setting']}` {p['from']} → {p['to']}. {p['why']}") if p else "No proposal today.", ""]
    return "\n".join(lines) + "\n"


def append(folder: Path, md: str) -> Path:
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / "lessons.md"
    if not path.exists():
        path.write_text("# Post Desk lessons\n\nOne entry per day, newest last. Proposals are never applied "
                        "automatically.\n\n")
    with open(path, "a", encoding="utf-8") as fh:
        fh.write(md + "\n")
    return path
