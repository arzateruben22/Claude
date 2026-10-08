import os
import re
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import pytest

from postdesk import xapi
from postdesk.budget import BudgetExceeded
from postdesk.schedule import plan_day

from .helpers import T0, FakeHTTP, Resp, budget, cfg

LA = cfg().tz


# -- schedule --------------------------------------------------------------------------------

def test_a_day_is_spread_across_your_hours():
    c = cfg()
    slots = plan_day(date(2026, 10, 5), c.schedule, LA)
    assert len(slots) == c.schedule.posts_per_day
    local = [s.astimezone(LA) for s in slots]
    assert all(7 <= t.hour < 23 for t in local)
    gaps = [(b - a).total_seconds() / 60 for a, b in zip(slots, slots[1:])]
    assert min(gaps) >= c.schedule.min_gap_minutes
    assert slots == plan_day(date(2026, 10, 5), c.schedule, LA)        # same day, same plan
    assert slots != plan_day(date(2026, 10, 6), c.schedule, LA)        # jitter moves it day to day


def test_once_hours_are_known_most_slots_go_to_the_best():
    c = cfg()
    scores = {h: (1.0, 5) for h in range(7, 23)}
    scores.update({8: (3.0, 6), 9: (2.5, 6), 19: (2.8, 6), 20: (2.6, 6), 21: (2.2, 6), 12: (2.1, 6)})
    for d in range(1, 29):                                 # every day of a month keeps its full count
        slots = plan_day(date(2026, 10, d), c.schedule, LA, scores)
        hours = [s.astimezone(LA).hour for s in slots]
        assert len(slots) == c.schedule.posts_per_day
        assert sum(h in (8, 9, 19, 20, 21, 12) for h in hours) >= 5
        assert all(7 <= h < 23 for h in hours)
        gaps = [(b - a).total_seconds() / 60 for a, b in zip(slots, slots[1:])]
        assert min(gaps) >= c.schedule.min_gap_minutes


def test_no_posts_planned_when_set_to_zero():
    assert plan_day(date(2026, 10, 5), cfg(schedule__posts_per_day=0).schedule, LA) == []


# -- budget ------------------------------------------------------------------------------------

def test_daily_and_monthly_limits():
    b, _ = budget(cfg(budget__daily_usd=0.05, budget__monthly_usd=0.10))
    assert b.allow(T0, "post")[0]
    for _ in range(3):
        b.charge(T0, "post")                          # $0.045
    ok, why = b.allow(T0, "post")
    assert not ok and "daily" in why
    assert b.allow(T0 + timedelta(days=1), "post")[0]     # a new local day
    b.charge(T0 + timedelta(days=1), "post", 3)
    ok, why = b.allow(T0 + timedelta(days=2), "post")
    assert not ok and "monthly" in why


def test_reading_can_never_eat_the_posting_money():
    b, _ = budget(cfg(budget__daily_usd=1.0, budget__reads_share=0.5))
    b.charge(T0, "read_post", 90)                     # $0.45
    assert not b.allow(T0, "read_post", 20)[0]
    assert b.allow(T0, "post")[0]
    with pytest.raises(BudgetExceeded):
        b.require(T0, "read_post", 20)


def test_claude_has_its_own_cap():
    b, _ = budget(cfg(writer__ai_daily_usd=0.10))
    b.charge(T0, "ai", 1, usd=0.11)
    assert not b.allow(T0, "ai")[0]
    assert b.allow(T0, "post")[0]                     # X money is separate


def test_days_follow_your_time_zone():
    b, _ = budget()
    late = datetime(2026, 10, 6, 6, 30, tzinfo=timezone.utc)      # 23:30 in LA on the 5th
    assert b.day_start(late) == T0


# -- the X client ----------------------------------------------------------------------------------

@pytest.fixture
def tokens(tmp_path):
    path = tmp_path / "tok.json"
    xapi.save_tokens({"access_token": "A1", "refresh_token": "R1",
                      "expires_at": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()}, path)
    return path


def client(http, tokens, c=None):
    b, store = budget(c)
    return xapi.XClient(b, http, client_id="cid", tokens_path=tokens), store


def test_posting_and_quoting(tokens):
    http = FakeHTTP(Resp(201, {"data": {"id": "111"}}), Resp(201, {"data": {"id": "112"}}))
    x, store = client(http, tokens)
    assert x.post(T0, "hello") == "111"
    assert x.post(T0, "my take on this", quote_of="99") == "112"
    assert http.calls[0].url.endswith("/2/tweets") and http.calls[0].json == {"text": "hello"}
    assert http.calls[1].json == {"text": "my take on this", "quote_tweet_id": "99"}
    assert http.calls[0].headers["Authorization"] == "Bearer A1"
    assert store.spent(T0) == pytest.approx(0.03)


def test_a_link_costs_more(tokens):
    x, store = client(FakeHTTP(Resp(201, {"data": {"id": "1"}})), tokens)
    x.post(T0, "docs https://example.com")
    assert store.spend_by_kind(T0) == {"post_with_link": pytest.approx(0.20)}


def test_search_is_cheap_by_default(tokens):
    body = {"data": [{"id": "5", "text": "hi", "author_id": "u9", "created_at": "2026-10-05T06:00:00Z",
                      "public_metrics": {"like_count": 300, "retweet_count": 30, "reply_count": 10, "quote_count": 2}}]}
    http = FakeHTTP(Resp(200, body))
    x, store = client(http, tokens)
    [s] = x.search(T0, "(agents) -is:retweet", 20, T0 - timedelta(hours=12))
    params = http.calls[0].params
    assert params["sort_order"] == "relevancy" and "expansions" not in params      # no paid author lookups
    assert s.author_id == "u9" and s.author == "" and s.likes == 300 and s.score > 0
    assert store.spend_by_kind(T0) == {"read_post": pytest.approx(0.005)}          # charged per post returned


def test_refused_before_calling_when_the_budget_is_spent(tokens):
    http = FakeHTTP()
    x, store = client(http, tokens, cfg(budget__daily_usd=0.01))
    with pytest.raises(BudgetExceeded):
        x.post(T0, "hello")
    assert http.calls == []                           # X was never asked


def test_expired_key_is_refreshed_and_saved(tokens):
    def token_endpoint(method, url, kw):
        assert kw["data"]["grant_type"] == "refresh_token" and kw["data"]["client_id"] == "cid"
        return Resp(200, {"access_token": "A2", "refresh_token": "R2", "expires_in": 7200})

    http = FakeHTTP(Resp(401, {"title": "Unauthorized"}), token_endpoint, Resp(201, {"data": {"id": "7"}}))
    x, _ = client(http, tokens)
    assert x.post(T0, "hello") == "7"
    assert http.calls[2].headers["Authorization"] == "Bearer A2"
    assert xapi.load_tokens(tokens)["refresh_token"] == "R2"
    if os.name == "posix":
        assert tokens.stat().st_mode & 0o777 == 0o600


def test_rate_limits_and_refusals(tokens):
    reset = int((datetime.now(timezone.utc) + timedelta(minutes=5)).timestamp())
    x, _ = client(FakeHTTP(Resp(429, {}, {"x-rate-limit-reset": str(reset)}), Resp(403, {"detail": "no credits"})), tokens)
    with pytest.raises(xapi.RateLimited) as e:
        x.post(T0, "a")
    assert e.value.reset is not None
    with pytest.raises(xapi.XError, match="credits"):
        x.post(T0, "b")


def test_numbers_come_in_batches_of_100(tokens):
    def answer(method, url, kw):
        ids = kw["params"]["ids"].split(",")
        return Resp(200, {"data": [{"id": i, "public_metrics": {"impression_count": 10, "like_count": 1}} for i in ids]})

    http = FakeHTTP(answer, answer)
    x, store = client(http, tokens)
    got = x.my_metrics(T0, [str(i) for i in range(150)])
    assert len(got) == 150 and len(http.calls) == 2 and got[0].impressions == 10
    assert store.spent(T0) == pytest.approx(0.15)


def test_sign_in_link_uses_pkce():
    verifier, challenge = xapi.pkce_pair()
    url = xapi.authorize_url("cid", "http://127.0.0.1:8789/callback", "st", challenge)
    assert "code_challenge_method=S256" in url and "offline.access" in url and verifier not in url


def test_the_code_has_no_forbidden_automation():
    """X forbids automated likes, follows and replies. There's no code for them to misfire."""
    src = "\n".join(p.read_text() for p in (Path(xapi.__file__).parent).glob("*.py"))
    assert not re.search(r"/likes\b|/following\b|in_reply_to_tweet_id|/bookmarks\b|/dm_", src)


def test_no_internet_is_its_own_error(tokens):
    def down(method, url, kw):
        raise ConnectionError("network is unreachable")

    x, store = client(FakeHTTP(down), tokens)
    with pytest.raises(xapi.Offline):
        x.post(T0, "hello")
    assert store.spent(T0) == 0
