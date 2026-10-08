from collections import Counter
from datetime import timedelta


from postdesk.build import demo_desk
from postdesk.desk import Desk, keyword_query
from postdesk.feeds import DemoFeeds
from postdesk.store import Store
from postdesk.writer import TemplateWriter
from postdesk.xapi import Offline, XError
from postdesk.xsim import DemoX

from .helpers import T0, budget, cfg


def run(desk, start, hours, every=2):
    t = start
    while t <= start + timedelta(hours=hours):
        desk.step(t)
        t += timedelta(minutes=every)
    return t


def make(c=None, demo_reviewer=False, store=None):
    c = c or cfg()
    b, store = budget(c, store or Store(":memory:"))
    x = DemoX(T0, b, c.tz, seed=3, handle=c.account.handle)
    return Desk(c, x, TemplateWriter(c, seed=3), DemoFeeds(3), store, b, T0, mode="demo", demo_reviewer=demo_reviewer)


def posted(desk):
    return desk.store.drafts(("posted",), limit=10000)


def test_nothing_posts_without_your_approval():
    desk = make()
    run(desk, T0, 48)
    assert posted(desk) == []
    waiting = desk.store.drafts(("queued",))
    assert len(waiting) >= desk.cfg.approval.min_queue
    assert any(e["kind"] == "skip" for e in desk.log)          # slots were missed, and it says so


def test_approved_drafts_go_out_in_the_slots():
    desk = make()
    run(desk, T0, 2)                                        # midnight to 2am: drafts written, nothing due yet
    ids = [d.id for d in desk.store.drafts(("queued",))][:3]
    for i in ids:
        ok, _ = desk.act(T0, "approve", i)
        assert ok
    run(desk, T0 + timedelta(hours=2), 22)
    out = posted(desk)
    assert sorted(d.id for d in out) == sorted(ids)
    assert all(d.decided_by == "you" for d in out)
    local = [d.posted_at.astimezone(desk.tz) for d in out]
    assert all(7 <= t.hour < 23 for t in local)
    times = sorted(d.posted_at for d in out)
    assert all((b - a) >= timedelta(minutes=desk.cfg.schedule.min_gap_minutes) for a, b in zip(times, times[1:]))


def test_a_week_of_the_demo_keeps_every_limit():
    c = cfg()
    desk = make(c, demo_reviewer=True)
    run(desk, T0, 24 * 7)
    out = posted(desk)
    assert out
    per_day = Counter((d.posted_at.astimezone(desk.tz).date(), d.kind) for d in out)
    for (day, kind), n in per_day.items():
        if kind == "quote":
            assert n <= c.schedule.max_quotes_per_day
        if kind == "repost":
            assert n <= c.schedule.max_reposts_per_day
    days = Counter(d.posted_at.astimezone(desk.tz).date() for d in out if d.kind != "repost")
    assert max(days.values()) <= c.schedule.posts_per_day
    assert all(d.decided_by in ("demo reviewer", "auto", "you") for d in out)
    spent = Counter()
    for at, kind, _, usd, _ in desk.store.ledger(T0 - timedelta(days=1)):
        if kind != "ai":
            spent[at.astimezone(desk.tz).date()] += usd
    assert max(spent.values()) <= c.budget.daily_usd + 1e-9
    assert desk.store.get("review:last")                     # the nightly review ran
    assert desk.store.followers()
    assert any(d.kind == "quote" for d in out)


def test_auto_mode_posts_clean_originals_but_quotes_still_wait():
    c = cfg(approval__mode="auto_originals")
    desk = make(c)
    run(desk, T0, 30)
    out = posted(desk)
    assert out and all(d.kind == "original" and d.decided_by == "auto" and not d.warned for d in out)
    assert all(d.status == "queued" for d in desk.store.drafts(("queued", "approved")) if d.kind == "quote")


def test_pause_stops_posting_but_not_the_numbers():
    c = cfg(approval__mode="auto_originals")
    desk = make(c)
    desk.act(T0, "pause")
    run(desk, T0, 24)
    assert posted(desk) == [] and desk.store.followers()
    desk.act(T0 + timedelta(hours=24), "resume")
    run(desk, T0 + timedelta(hours=24), 24)
    assert posted(desk)


def test_your_actions():
    desk = make()
    run(desk, T0, 1)
    d = desk.store.drafts(("queued",))[0]
    ok, msg = desk.act(T0, "edit", d.id, text="Great point @someone")
    assert not ok and "mentions" in msg and desk.store.draft(d.id).status == "blocked"
    ok, _ = desk.act(T0, "edit", d.id, text="Small tools you use daily beat big ones you open once.")
    assert ok and desk.store.draft(d.id).status == "queued" and desk.store.draft(d.id).by.endswith("+you")
    ok, _ = desk.act(T0, "reject", d.id)
    assert ok and desk.store.draft(d.id).status == "rejected"
    assert not desk.act(T0, "approve", d.id)[0]              # can't approve what you rejected
    ok, _ = desk.act(T0, "add", text="My own words, written by me, about shipping small.", fmt="take")
    assert ok
    mine = [x for x in desk.store.drafts(("approved",)) if x.by == "you"]
    assert len(mine) == 1 and mine[0].decided_by == "you"
    assert not desk.act(T0, "add", text="")[0]
    assert not desk.act(T0, "approve", "nope")[0]
    assert not desk.act(T0, "dance")[0]


def test_post_now_uses_up_a_slot():
    desk = make()
    run(desk, T0, 9)                                          # 9am local: some slots passed
    d = desk.store.drafts(("queued",))[0]
    ok, msg = desk.act(T0 + timedelta(hours=9), "post_now", d.id)
    assert ok, msg
    assert desk.store.draft(d.id).status == "posted"
    assert sum(1 for v in desk.slot_state.values() if v == "done:" + d.id) == 1


def test_a_refused_post_is_marked_failed():
    desk = make()
    run(desk, T0, 1)
    d = desk.store.drafts(("queued",))[0]

    def refuse(*a, **k):
        raise XError("X refused (403): duplicate content")

    desk.x.post = refuse
    ok, _ = desk.act(T0, "post_now", d.id)
    assert not ok and desk.store.draft(d.id).status == "failed"
    assert any("refused" in e["text"] for e in desk.log)


def test_state_for_the_dashboard():
    desk = make(demo_reviewer=True)
    run(desk, T0, 36)
    s = desk.state(T0 + timedelta(hours=36))
    for key in ("pill", "stats", "rundown", "queue", "posted", "scout", "wheel", "formats", "hours", "growth",
                "money", "kit", "log", "window", "next"):
        assert key in s
    assert len(s["rundown"]) == desk.cfg.schedule.posts_per_day
    assert {r["state"] for r in s["rundown"]} <= {"done", "missed", "open", "next", "planned"}
    import json

    json.dumps(s)                                             # it must travel as JSON


def test_search_query():
    q = keyword_query(cfg(topics__keywords=["AI agent", "LLM"], topics__watch_accounts=["amy"], account__handle="me"))
    assert q == '("AI agent" OR LLM OR from:amy) -is:retweet -is:reply lang:en -from:me'


def test_demo_folder_starts_fresh(tmp_path):
    a = demo_desk(cfg(), T0, tmp_path)
    run(a, T0, 3)
    assert a.store.drafts()
    b = demo_desk(cfg(), T0, tmp_path)
    assert b.store.drafts() == []


def test_a_restart_keeps_the_days_plan():
    c = cfg()
    store = Store(":memory:")
    a = make(c, store=store)
    run(a, T0, 10)
    b = make(c, store=store)                                  # same database, fresh process
    b.step(T0 + timedelta(hours=10))
    assert b.slots == a.slots and b.slot_state == a.slot_state


def test_no_internet_keeps_the_draft_and_backs_off():
    desk = make()
    run(desk, T0, 1)
    d = desk.store.drafts(("queued",))[0]
    calls = []

    def offline(*a, **k):
        calls.append(1)
        raise Offline("can't reach X (ConnectionError)")

    desk.x.post = offline
    ok, _ = desk.act(T0 + timedelta(hours=8), "post_now", d.id)
    assert not ok and desk.store.draft(d.id).status == "approved"
    run(desk, T0 + timedelta(hours=8), 0.05, every=0.5)        # three quick steps: no retry storm
    assert len(calls) == 1 and desk.halt_until == T0 + timedelta(hours=8, minutes=5)


def test_your_comedy_settings_run_in_the_demo(tmp_path):
    from postdesk import config

    c = config.load()                                         # your desk.toml
    desk = demo_desk(c, T0, tmp_path, seed=5)
    run(desk, T0, 24 * 3)
    out = posted(desk)
    assert out and {d.format for d in out if d.kind == "original"} <= set(c.writer.formats)
    assert all(d.decided_by == "demo reviewer" for d in out)  # review mode: nothing posted on its own
    assert {d.target_author for d in out if d.kind == "repost"} <= {"liftlaughs", "ravecore"}


def test_your_examples_are_never_posted_as_drafts():
    example = "He skipped leg day for 3 years. Let him wobble. He was destined to be a flamingo."
    desk = make(cfg(writer__examples=[example]))
    d = __import__("postdesk.models", fromlist=["Draft"]).Draft(id="x1", created=T0, kind="original",
                                                                  text=example + "!", format="take", by="claude")
    assert desk._admit(T0, d) == "blocked"
    assert any(c.rule == "not someone else's post" and not c.ok for c in d.checks)
