"""DESK: the loop that runs everything, one small step at a time.

Each step:
  plan     today's posting slots (spread out at first, then leaning toward your best hours)
  expire   drafts nobody approved in time
  scout    free feeds every run; X search during your active hours, within the reading budget
  write    keep enough drafts waiting (Claude, or the demo samples)
  post     when a slot comes due, send the oldest approved draft; nothing approved = nothing posted
  numbers  your posts' views and your follower count, a few times a day
  review   once a day after the last slot: lessons, learnings for the writer, at most one proposal

The dashboard and the command line act through the same object (approve, reject, edit, add,
post now, pause), under the same lock as the loop.
"""
from __future__ import annotations

import random
import threading
from collections import Counter, deque
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional, Tuple

from . import analyst, guard, review
from .budget import Budget, BudgetExceeded
from .config import Config, parse_hours
from .models import Draft
from .schedule import local_day, plan_day
from .store import Store
from .writer import new_id
from .xapi import AuthError, Offline, RateLimited, XError

GRACE = timedelta(minutes=90)            # an open slot waits this long for an approved draft, then it's missed
WRITE_RETRY = timedelta(hours=1)
REPOST_GAP = timedelta(minutes=20)
FRESH_EVERY = timedelta(hours=3)         # numbers for posts under two days old
OLD_EVERY = timedelta(hours=24)          # numbers for posts two to seven days old
FOLLOWERS_EVERY = timedelta(hours=6)
HOUSEKEEPING_EVERY = timedelta(minutes=10)
DEMO_REVIEW_AFTER = timedelta(hours=2)
SAY_AGAIN_AFTER = timedelta(hours=2)     # repeating messages are logged at most this often


def keyword_query(cfg: Config) -> str:
    """One X search for your keywords and the accounts you watch. Retweets and replies are skipped."""
    terms = [f'"{k}"' if " " in k else k for k in cfg.topics.keywords]
    terms += [f"from:{h}" for h in cfg.topics.watch_accounts]
    q, used = "", []
    for t in terms:                       # X caps a query's length; keep the first terms that fit
        if len(" OR ".join(used + [t])) > 380:
            break
        used.append(t)
    q = "(" + " OR ".join(used) + ")"
    return f"{q} -is:retweet -is:reply lang:{cfg.account.language} -from:{cfg.account.handle}"


def curated_query(cfg: Config) -> str:
    return "(" + " OR ".join(f"from:{h}" for h in cfg.topics.curated_reposts) + ") -is:retweet -is:reply"


class DemoReviewer:
    """Demo only: stands in for you on drafts left waiting two simulated hours, so the demo keeps moving."""

    name = "demo reviewer"

    def __init__(self, seed: int = 7):
        self.rng = random.Random(seed + 101)

    def approves(self, d: Draft) -> bool:
        return self.rng.random() < (0.55 if d.warned else 0.88)


class Desk:
    def __init__(self, cfg: Config, x, writer, feeds, store: Store, budget: Budget, start: datetime,
                 mode: str = "demo", folder: Optional[Path] = None, reviewer=None, demo_reviewer: bool = False,
                 seed: int = 7):
        self.cfg, self.x, self.writer, self.feeds = cfg, x, writer, feeds
        self.store, self.budget, self.mode, self.folder, self.reviewer = store, budget, mode, folder, reviewer
        self.tz = cfg.tz
        self.lock = threading.RLock()
        self.log: deque = deque(maxlen=150)
        self.started = start
        self.paused = bool(store.get("paused", False))
        self.next = {k: start for k in ("scout", "write", "fresh", "old", "me", "house")}
        self.day = None
        self.slots: List[datetime] = []
        self.slot_state: dict = {}            # slot time -> "done:<draft id>" or "missed"
        self.me = store.get("me", {}) or {}
        self.users = store.get("users", {}) or {}     # X user id -> username (lookups cost money, so they're kept)
        self.halt_until: Optional[datetime] = None
        self.force_write = False
        self.demo_reviewer = DemoReviewer(seed) if demo_reviewer else None
        self.recent_days = 4 if mode == "demo" else 30   # the demo's sample pool is small
        self.version = 0
        self._said: dict = {}
        self._cache: dict = {}
        mine = [d for d in store.posted_since(start - timedelta(days=2)) if d.kind != "repost"]
        self.last_post_at = mine[-1].posted_at if mine else None
        self.last_repost_at: Optional[datetime] = None

    # -- small helpers -----------------------------------------------------------------------
    def say(self, now: datetime, kind: str, text: str, key: str = "") -> None:
        if key:
            last = self._said.get(key)
            if last and last[1] == text and now - last[0] < SAY_AGAIN_AFTER:
                return
            self._said[key] = (now, text)
        self.log.appendleft({"at": now.isoformat(), "kind": kind, "text": text})

    def _minute(self, now: datetime) -> int:
        local = now.astimezone(self.tz)
        return local.hour * 60 + local.minute

    def _active(self, now: datetime, pad: int = 0) -> bool:
        a, b = parse_hours(self.cfg.schedule.active_hours)
        return a - pad <= self._minute(now) < b

    def _day_start(self, now: datetime) -> datetime:
        return self.budget.day_start(now)

    def _today(self, now: datetime, kind: str) -> int:
        return sum(1 for d in self.store.posted_since(self._day_start(now)) if d.kind == kind)

    def _recent(self, now: datetime, exclude: str = "") -> List[str]:
        """Texts a new draft must not repeat: recent posts plus everything still waiting."""
        posted = [d.text for d in self.store.posted_since(now - timedelta(days=self.recent_days)) if d.text]
        waiting = [d.text for d in self.store.drafts(("queued", "approved")) if d.text and d.id != exclude]
        return posted + waiting

    def _save_slots(self) -> None:
        self.store.put(f"slots:{self.day}", self.slot_state)

    def _local(self, dt: datetime, fmt: str = "%H:%M") -> str:
        return dt.astimezone(self.tz).strftime(fmt)

    # -- the loop ------------------------------------------------------------------------------
    def step(self, now: datetime) -> None:
        with self.lock:
            self.x.advance(now)
            self._plan(now)
            if now >= self.next["house"]:
                self.next["house"] = now + HOUSEKEEPING_EVERY
                self._expire(now)
                if self.demo_reviewer:
                    self._demo_review(now)
            if not self.paused:
                self._scout(now)
                self._refill(now)
                self._post(now)
                self._reposts(now)
            self._numbers(now)
            self._nightly(now)

    def _plan(self, now: datetime) -> None:
        day = local_day(now, self.tz)
        if day == self.day:
            return
        self.day = day
        scores = analyst.hour_scores(analyst.rows(self.store, self.cfg, now, days=30))
        saved = self.store.get(f"plan:{day}")
        if saved:                          # a restart keeps the day's plan, so the day's total can't grow
            self.slots = [datetime.fromisoformat(x) for x in saved]
        else:
            self.slots = plan_day(day, self.cfg.schedule, self.tz, scores)
            self.store.put(f"plan:{day}", [x.isoformat() for x in self.slots])
        self.slot_state = self.store.get(f"slots:{day}", {}) or {}
        learned = sum(1 for _, n in scores.values() if n >= 3)
        how = "most at your best hours, some testing new ones" if learned >= 4 else "spread across your hours"
        first = f", first at {self._local(self.slots[0])}" if self.slots else ""
        self.say(now, "plan", f"Today's rundown: {len(self.slots)} slots{first}, {how}.")
        self.version += 1

    def _expire(self, now: datetime) -> None:
        limit, n = timedelta(hours=self.cfg.approval.expire_hours), 0
        for d in self.store.drafts(("queued", "approved")):
            if now - d.created < limit or (d.status == "approved" and d.kind == "original"):
                continue          # you approved an original: it waits for a slot however long it takes
            d.status = "expired"
            self.store.save_draft(d)
            n += 1
        if n:
            self.say(now, "expire", f"{n} draft{'s' if n > 1 else ''} expired before anyone approved "
                                    f"{'them' if n > 1 else 'it'}.")
            self.version += 1

    def _demo_review(self, now: datetime) -> None:
        for d in self.store.drafts(("queued",)):
            if now - d.created >= DEMO_REVIEW_AFTER:
                d.status = "approved" if self.demo_reviewer.approves(d) else "rejected"
                d.decided_by = self.demo_reviewer.name
                self.store.save_draft(d)
                self.version += 1

    # -- scout -----------------------------------------------------------------------------------
    def _scout(self, now: datetime) -> None:
        if now < self.next["scout"]:
            return
        sc = self.cfg.scout
        self.next["scout"] = now + timedelta(minutes=sc.every_minutes)
        rss = 0
        try:
            for s in self.feeds.fetch(now):
                rss += self.store.save_signal(s, now)
        except Exception as exc:          # a feed problem never stops the desk
            self.say(now, "error", f"Feeds: {exc}", key="feeds")
        if getattr(self.feeds, "errors", None):
            self.say(now, "error", f"{len(self.feeds.errors)} feed(s) didn't load: {self.feeds.errors[0][:140]}",
                     key="feeds")
        if not self._active(now, pad=60):
            self.say(now, "scout", f"Scout: {rss} new headlines (free). Reading X waits for your active hours.")
            return
        since = now - timedelta(hours=sc.lookback_hours)
        read = hot = 0
        if self.cfg.topics.keywords or self.cfg.topics.watch_accounts:
            try:
                for s in self.x.search(now, keyword_query(self.cfg), sc.max_results, since):
                    read += 1
                    if s.likes >= sc.min_likes and s.author_id != self.me.get("id"):
                        hot += 1
                        self.store.save_signal(s, now)
            except BudgetExceeded as exc:
                self.say(now, "budget", f"Scout skipped X: {exc}", key="budget-scout")
            except XError as exc:
                self.say(now, "error", f"Scout: {exc}", key="x-scout")
        reposts = self._scout_curated(now, since)
        quotes = self._write_quotes(now, since)
        extra = []
        if quotes:
            extra.append(f"{quotes} quote take{'s' if quotes > 1 else ''} drafted")
        if reposts:
            extra.append(f"{reposts} repost{'s' if reposts > 1 else ''} suggested")
        self.say(now, "scout", f"Scout: {rss} new headlines, {read} posts read on X, {hot} catching on"
                 + (". " + ", ".join(extra).capitalize() + "." if extra else "."))
        self.version += 1

    def _resolve(self, now: datetime, ids: List[str]) -> dict:
        unknown = sorted({i for i in ids if i and i not in self.users})
        if unknown:
            try:
                self.users.update(self.x.authors(now, unknown))
                self.store.put("users", self.users)
            except (BudgetExceeded, XError) as exc:
                self.say(now, "error", f"Couldn't look up authors: {exc}", key="authors")
        return self.users

    def _scout_curated(self, now: datetime, since: datetime) -> int:
        cur = self.cfg.topics.curated_reposts
        if not cur or self._today(now, "repost") >= self.cfg.schedule.max_reposts_per_day:
            return 0
        try:
            found = self.x.search(now, curated_query(self.cfg), 10, since)
        except BudgetExceeded as exc:
            self.say(now, "budget", f"Curated reposts skipped: {exc}", key="budget-curated")
            return 0
        except XError as exc:
            self.say(now, "error", f"Curated search: {exc}", key="x-curated")
            return 0
        names = self._resolve(now, [s.author_id for s in found])
        fresh = [s for s in sorted(found, key=lambda s: s.score, reverse=True)
                 if not self.store.is_used(s.id) and names.get(s.author_id, s.author).lower() in cur]
        for s in fresh[:1]:
            self.store.save_signal(s, now)
            self.store.mark_signal_used(s.id)
            self._admit(now, Draft(id=new_id(), created=now, kind="repost", format="repost", topic="repost",
                                   target_id=s.id, target_author=names.get(s.author_id, s.author),
                                   target_text=s.text[:500], by="scout", why=f"{s.likes:,} likes, curated account"))
        return min(1, len(fresh))

    def _write_quotes(self, now: datetime, since: datetime) -> int:
        cap = self.cfg.schedule.max_quotes_per_day
        waiting = sum(1 for d in self.store.drafts(("queued", "approved")) if d.kind == "quote")
        room = min(self.cfg.scout.quote_ideas, cap - self._today(now, "quote") - waiting)
        if room <= 0:
            return 0
        targets = [s for s in self.store.signals(since, limit=20, unused_only=True, source="x")
                   if s.likes >= self.cfg.scout.min_likes and s.author_id != self.me.get("id")][:room]
        if not targets:
            return 0
        names = self._resolve(now, [t.author_id for t in targets if not t.author])
        for t in targets:
            t.author = t.author or names.get(t.author_id, "")
            self.store.mark_signal_used(t.id)
        drafts = self.writer.quotes(now, targets, self._recent(now))
        if not drafts and self.writer.last_error:
            self.say(now, "error", f"Writer: {self.writer.last_error}", key="writer")
        for d in drafts:
            self._admit(now, d)
        return len(drafts)

    # -- write -----------------------------------------------------------------------------------
    def _refill(self, now: datetime) -> None:
        if now < self.next["write"] and not self.force_write:
            return
        waiting = [d for d in self.store.drafts(("queued", "approved")) if d.kind == "original"]
        if len(waiting) >= self.cfg.approval.min_queue and not self.force_write:
            self.next["write"] = now + timedelta(minutes=30)
            return
        self.force_write = False
        ideas = self.store.signals(now - timedelta(hours=36), limit=12, unused_only=True)
        drafts = self.writer.originals(now, self.cfg.writer.drafts_per_batch, self._recent(now), ideas,
                                       self.store.get("learnings", []) or [])
        if not drafts:
            self.next["write"] = now + WRITE_RETRY
            if self.writer.last_error:
                self.say(now, "error", f"Writer: {self.writer.last_error}", key="writer")
            return
        used = {d.source_url for d in drafts if d.source_url}
        for s in ideas:
            if s.url and s.url in used:
                self.store.mark_signal_used(s.id)
        got = Counter(self._admit(now, d) for d in drafts)
        parts = [f"{got['queued']} waiting for you"] if got["queued"] else []
        if got["approved"]:
            parts.append(f"{got['approved']} cleared to post on their own")
        if got["blocked"]:
            parts.append(f"{got['blocked']} stopped by the rules")
        self.say(now, "write", f"{self.writer.name} wrote {len(drafts)} drafts: " + ", ".join(parts) + ".")
        self.next["write"] = now + timedelta(minutes=20)

    def _admit(self, now: datetime, d: Draft) -> str:
        """Check a new draft and file it: blocked, cleared to post on its own, or waiting for you."""
        d.checks = guard.check(d, self.cfg, self._recent(now, exclude=d.id))
        if d.blocked:
            d.status = "blocked"
            why = "; ".join(f"{c.rule}: {c.note}" if c.note else c.rule for c in d.checks if not c.ok and c.level == "block")
            self.say(now, "guard", f"Stopped a draft ({why}).")
        elif guard.may_auto_post(d, self.cfg):
            d.status, d.decided_by = "approved", "auto"
        else:
            d.status = "queued"
        self.store.save_draft(d)
        self.version += 1
        return d.status

    # -- post ------------------------------------------------------------------------------------
    def _post(self, now: datetime) -> None:
        if self.halt_until and now < self.halt_until:
            return
        open_slots = []
        for s in self.slots:
            key = s.isoformat()
            if s > now or key in self.slot_state:
                continue
            if now - s > GRACE:
                self.slot_state[key] = "missed"
                self._save_slots()
                self.say(now, "skip", f"The {self._local(s)} slot went unused: nothing was approved in time.")
                self.version += 1
                continue
            open_slots.append(s)
        if not open_slots:
            return
        if self.last_post_at and now - self.last_post_at < timedelta(minutes=self.cfg.schedule.min_gap_minutes):
            return
        d = self._next_draft(now)
        if not d:
            self.say(now, "wait", f"The {self._local(open_slots[0])} slot is open. Approve a draft to send it.",
                     key="waiting")
            return
        if self._publish(now, d):
            self.slot_state[open_slots[0].isoformat()] = "done:" + d.id
            self._save_slots()

    def _next_draft(self, now: datetime) -> Optional[Draft]:
        ready = self.store.drafts(("approved",))
        if self._today(now, "quote") < self.cfg.schedule.max_quotes_per_day:
            quotes = [d for d in ready if d.kind == "quote"]
            if quotes:
                return quotes[0]          # a quote is about something happening now: it goes first
        originals = [d for d in ready if d.kind == "original"]
        return originals[0] if originals else None

    def _publish(self, now: datetime, d: Draft) -> bool:
        d.checks = guard.check(d, self.cfg, self._recent(now, exclude=d.id))
        if d.blocked:                     # something changed since it was approved (say, a similar post went out)
            d.status = "blocked"
            self.store.save_draft(d)
            self.say(now, "guard", "Held back an approved draft: " +
                     "; ".join(c.note or c.rule for c in d.checks if not c.ok and c.level == "block"))
            self.version += 1
            return False
        try:
            if d.kind == "repost":
                self.x.repost(now, d.target_id)
                pid = ""
            else:
                pid = self.x.post(now, d.text, quote_of=d.target_id if d.kind == "quote" else "", fmt=d.format)
        except BudgetExceeded as exc:
            self.say(now, "budget", f"Not posted: {exc}", key="budget-post")
            return False
        except RateLimited as exc:
            self.halt_until = exc.reset or now + timedelta(minutes=15)
            self.say(now, "error", f"{exc}. Posting resumes at {self._local(self.halt_until)}.")
            return False
        except Offline as exc:
            self.halt_until = now + timedelta(minutes=5)
            self.say(now, "error", f"Not posted: {exc}. Trying again in 5 minutes.", key="offline")
            return False
        except AuthError as exc:
            self.paused = True
            self.store.put("paused", True)
            self.say(now, "error", f"{exc} Posting is paused.")
            return False
        except XError as exc:
            d.status, d.error = "failed", str(exc)[:300]
            self.store.save_draft(d)
            self.say(now, "error", f"X refused a post: {exc}")
            self.version += 1
            return False
        d.status, d.posted_id, d.posted_at = "posted", pid, now
        self.store.save_draft(d)
        if d.kind == "repost":
            self.last_repost_at = now
            self.say(now, "post", f"Reposted @{d.target_author}: \"{d.target_text[:80]}\"")
        else:
            self.last_post_at = now
            what = f"quote of @{d.target_author}" if d.kind == "quote" else d.format.replace("_", "-")
            self.say(now, "post", f"Posted a {what}: \"{d.text[:90]}{'…' if len(d.text) > 90 else ''}\"")
        self.version += 1
        return True

    def _reposts(self, now: datetime) -> None:
        if not self._active(now) or self._today(now, "repost") >= self.cfg.schedule.max_reposts_per_day:
            return
        if self.last_repost_at and now - self.last_repost_at < REPOST_GAP:
            return
        ready = [d for d in self.store.drafts(("approved",)) if d.kind == "repost"]
        if ready:
            self._publish(now, ready[0])

    # -- numbers -------------------------------------------------------------------------------------
    def _numbers(self, now: datetime) -> None:
        if now >= self.next["me"]:
            self.next["me"] = now + FOLLOWERS_EVERY
            try:
                self.me = self.x.me(now)
                self.store.put("me", self.me)
                self.store.add_followers(now, int(self.me["followers"]))
                self.version += 1
            except (BudgetExceeded, XError) as exc:
                self.say(now, "error", f"Follower count: {exc}", key="me")
        if now >= self.next["fresh"]:
            self.next["fresh"] = now + FRESH_EVERY
            self._refresh(now, [d.posted_id for d in self.store.posted_since(now - timedelta(hours=48)) if d.posted_id])
        if now >= self.next["old"]:
            self.next["old"] = now + OLD_EVERY
            cut = now - timedelta(hours=48)
            self._refresh(now, [d.posted_id for d in self.store.posted_since(now - timedelta(days=7))
                                if d.posted_id and d.posted_at < cut])

    def _refresh(self, now: datetime, ids: List[str]) -> None:
        if not ids:
            return
        try:
            for m in self.x.my_metrics(now, ids):
                self.store.save_metric(m)
            self.version += 1
        except (BudgetExceeded, XError) as exc:
            self.say(now, "error", f"Post numbers: {exc}", key="metrics")

    def _nightly(self, now: datetime) -> None:
        a, b = parse_hours(self.cfg.schedule.active_hours)
        if self._minute(now) < min(b + 30, 23 * 60 + 50):
            return
        today = local_day(now, self.tz).isoformat()
        if self.store.get("review_day") == today:
            return
        self.store.put("review_day", today)
        result = review.nightly(self.store, self.cfg, now, self.reviewer)
        if self.folder:
            review.append(self.folder, review.render(result, now.astimezone(self.tz)))
        p = result["proposal"]
        self.say(now, "review", f"Nightly review by {result['by']}: {len(result['lessons'])} lessons"
                 + (f"; proposes {p['setting']} → {p['to']} (not applied)." if p else "; no proposal."))
        self.version += 1

    # -- what you can do ----------------------------------------------------------------------------------
    def act(self, now: datetime, action: str, draft_id: str = "", text: str = "", fmt: str = "") -> Tuple[bool, str]:
        with self.lock:
            ok, msg = self._act(now, action, draft_id, (text or "").strip(), fmt)
            if ok:
                self.version += 1
            return ok, msg

    def _act(self, now: datetime, action: str, draft_id: str, text: str, fmt: str) -> Tuple[bool, str]:
        if action == "pause":
            self.paused = True
            self.store.put("paused", True)
            self.say(now, "you", "You paused posting. Drafts and numbers keep coming.")
            return True, "Paused."
        if action == "resume":
            self.paused, self.halt_until = False, None
            self.store.put("paused", False)
            self.say(now, "you", "You resumed posting.")
            return True, "Resumed."
        if action == "write":
            self.force_write, self.next["write"] = True, now
            return True, "Writing a fresh batch."
        if action == "scout":
            self.next["scout"] = now
            return True, "Scouting now."
        if action == "add":
            if not text:
                return False, "Write something first."
            d = Draft(id=new_id(), created=now, kind="original", text=text,
                      format=fmt if fmt in self.cfg.writer.formats else "take", topic="yours", by="you")
            status = self._admit(now, d)
            if status == "blocked":
                return False, "Stopped by the rules: " + "; ".join(c.note or c.rule for c in d.checks
                                                                   if not c.ok and c.level == "block")
            if status == "queued":
                d.status, d.decided_by = "approved", "you"
                self.store.save_draft(d)
            self.say(now, "you", f"You added a post: \"{text[:80]}\"")
            return True, "Added and approved. It goes out in the next open slot."

        d = self.store.draft(draft_id)
        if not d:
            return False, "No such draft."
        if action == "reject":
            if d.status not in ("queued", "approved", "blocked", "failed"):
                return False, f"It's already {d.status}."
            d.status, d.decided_by = "rejected", "you"
            self.store.save_draft(d)
            return True, "Rejected."
        if action in ("approve", "edit", "post_now"):
            if d.status not in ("queued", "approved", "blocked", "failed"):
                return False, f"It's already {d.status}."
            if text and text != d.text:
                if d.kind == "repost":
                    return False, "A repost has no text to edit."
                d.text = text
                if d.by != "you":
                    d.by += "+you"
            d.checks = guard.check(d, self.cfg, self._recent(now, exclude=d.id))
            if d.blocked:
                d.status = "blocked"
                self.store.save_draft(d)
                return False, "Stopped by the rules: " + "; ".join(c.note or c.rule for c in d.checks
                                                                   if not c.ok and c.level == "block")
            if action == "edit":
                d.status = "queued" if d.status != "approved" else "approved"
                self.store.save_draft(d)
                return True, "Saved."
            d.status, d.decided_by, d.error = "approved", "you", ""
            self.store.save_draft(d)
            if action == "approve":
                return True, "Approved. It goes out in the next open slot."
            if not self._publish(now, d):
                return False, "Couldn't post it now; it stays approved. See the log."
            if d.kind != "repost":
                nxt = next((s for s in self.slots if s.isoformat() not in self.slot_state), None)
                if nxt:                   # it takes the next slot, so the day's total stays the same
                    self.slot_state[nxt.isoformat()] = "done:" + d.id
                    self._save_slots()
            return True, "Posted."
        return False, f"Unknown action: {action}"

    # -- what the dashboard shows --------------------------------------------------------------------------
    def _stats(self, now: datetime) -> dict:
        key = (self.version, now.replace(minute=now.minute // 15 * 15, second=0, microsecond=0))
        if self._cache.get("key") == key:
            return self._cache["value"]
        rs = analyst.rows(self.store, self.cfg, now, days=90)
        series = self.store.followers(now - timedelta(days=30))
        step = max(1, len(series) // 60)
        sampled = series[::step] + ([series[-1]] if series and (len(series) - 1) % step else [])
        followers = int(self.me.get("followers", series[-1][1] if series else 0))
        week_ago = analyst.followers_at(series, now - timedelta(days=7)) if series else followers
        value = {
            "rows": rs,
            "formats": sorted(({"format": k, **v} for k, v in analyst.by_format(rs).items()),
                              key=lambda r: r["factor"], reverse=True),
            "hours": {h: v for h, v in analyst.by_hour(rs).items()},
            "money": analyst.money(self.store, self.cfg, now, rs, followers, self.me.get("verified_followers")),
            "kit": analyst.media_kit(rs, series, now),
            "growth": {"followers": [[int(t.timestamp() * 1000), c] for t, c in sampled],
                       "views_by_day": analyst.views_by_day(rs, local_day(now, self.tz))},
            "followers": followers, "followers_7d": followers - week_ago,
            "views_7d": sum(r["views"] for r in rs if now - r["at"] <= timedelta(days=7)),
        }
        self._cache = {"key": key, "value": value}
        return value

    def state(self, now: datetime) -> dict:
        with self.lock:
            return self._state(now)

    def _state(self, now: datetime) -> dict:
        cfg, tz = self.cfg, self.tz
        local = now.astimezone(tz)
        st = self._stats(now)
        metrics = self.store.metrics()
        a, b = parse_hours(cfg.schedule.active_hours)

        rundown, upcoming = [], None
        for s in self.slots:
            key, m = s.isoformat(), self._minute(s)
            v = self.slot_state.get(key, "")
            item = {"min": m, "at": self._local(s), "state": "planned"}
            if v.startswith("done:"):
                d = self.store.draft(v[5:])
                item["state"] = "done"
                if d:
                    mt = metrics.get(d.posted_id)
                    item.update(text=d.text[:120], format=d.format if d.kind == "original" else d.kind,
                                views=mt.impressions if mt else 0)
            elif v == "missed":
                item["state"] = "missed"
            elif s <= now:
                item["state"] = "open"
                upcoming = upcoming or item
            elif not upcoming:
                item["state"] = "next"
                upcoming = item
            rundown.append(item)

        drafts = self.store.drafts(("queued", "approved", "blocked"), since=now - timedelta(days=2))
        drafts = [d for d in drafts if d.status != "blocked" or now - d.created < timedelta(hours=12)]
        order = {"queued": 0, "approved": 1, "blocked": 2}
        drafts.sort(key=lambda d: (order[d.status], d.created))
        queue = [{
            "id": d.id, "kind": d.kind, "format": d.format, "text": d.text, "status": d.status, "by": d.by,
            "why": d.why, "decided_by": d.decided_by, "age_min": int((now - d.created).total_seconds() // 60),
            "chars": guard.weighted_length(d.text), "source_url": d.source_url,
            "target_author": d.target_author, "target_text": d.target_text[:280],
            "checks": [c.to_dict() for c in d.checks if not c.ok],
        } for d in drafts[:40]]

        posted = []
        for d in self.store.drafts(("posted",), limit=14, newest_first=True):
            mt = metrics.get(d.posted_id)
            posted.append({"id": d.id, "kind": d.kind, "format": d.format, "at": self._local(d.posted_at, "%a %H:%M"),
                           "text": d.text or d.target_text[:200], "target_author": d.target_author,
                           "views": mt.impressions if mt else None, "eng": mt.engagements if mt else None,
                           "by": d.by, "decided_by": d.decided_by,
                           "url": f"https://x.com/{cfg.account.handle}/status/{d.posted_id}"
                           if d.posted_id and self.mode == "live" else ""})

        scout = [{"source": s.source, "author": s.author or self.users.get(s.author_id, ""), "text": s.text[:220],
                  "likes": s.likes, "score": round(s.score, 1), "url": s.url}
                 for s in self.store.signals(now - timedelta(hours=24), limit=8)]

        wheel = [{"m": r["minute"], "v": r["views"], "f": r["format"] if r["kind"] == "original" else "quote",
                  "age": round((now - r["at"]).total_seconds() / 86400, 2)}
                 for r in st["rows"] if now - r["at"] <= timedelta(days=7)]

        hours = []
        for h in range(24):
            if not (a <= h * 60 < b or a < (h + 1) * 60 <= b):
                continue
            v = st["hours"].get(h)
            hours.append({"hour": h, "n": v["n"] if v else 0, "factor": v["factor"] if v else None,
                          "median": v["median"] if v else None})

        active = a <= self._minute(now) < b
        if self.paused:
            pill = "PAUSED"
        elif self.halt_until and now < self.halt_until:
            pill = "HOLD"
        else:
            pill = "ON AIR" if active else "OFF AIR"
        ready = sum(1 for d in drafts if d.status == "approved" and d.kind != "repost")
        bud = self.budget
        lessons = self.store.get("review:last")
        return {
            "mode": self.mode, "handle": cfg.account.handle, "tz": cfg.account.timezone,
            "now": now.isoformat(), "clock": local.strftime("%H:%M"), "date": local.strftime("%a %d %b"),
            "minute": self._minute(now), "window": [a, b],
            "pill": pill, "approval": cfg.approval.mode, "paused": self.paused,
            "writer": self.writer.name, "writer_error": self.writer.last_error, "formats_allowed": cfg.writer.formats,
            "next": ({"at": upcoming["at"], "in_min": (upcoming["min"] - self._minute(now)), "ready": ready > 0}
                     if upcoming else None),
            "stats": {"followers": st["followers"], "followers_7d": st["followers_7d"], "views_7d": st["views_7d"],
                      "posts_today": sum(1 for r in rundown if r["state"] == "done"), "slots_today": len(rundown),
                      "waiting": sum(1 for d in drafts if d.status == "queued"), "ready": ready,
                      "x_today": round(bud.x_today(now), 3), "x_cap": cfg.budget.daily_usd,
                      "reads_today": round(bud.today(now, ("read_post", "read_user")), 3),
                      "reads_cap": round(cfg.budget.daily_usd * cfg.budget.reads_share, 2),
                      "ai_today": round(bud.today(now, ("ai",)), 3), "ai_cap": cfg.writer.ai_daily_usd,
                      "x_month": round(bud.month(now) - bud.month(now, ("ai",)), 2), "x_month_cap": cfg.budget.monthly_usd},
            "rundown": rundown, "queue": queue, "posted": posted, "scout": scout, "wheel": wheel,
            "formats": st["formats"], "hours": hours, "growth": st["growth"], "money": st["money"], "kit": st["kit"],
            "lessons": lessons, "log": [{**e, "at": self._local(datetime.fromisoformat(e["at"]))}
                                        for e in list(self.log)[:40]],
        }
