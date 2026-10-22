"""bot_diary: jokes about the owner's paper-trading bots, from the paper book's real numbers, never a tip."""
import json
from datetime import datetime, timedelta, timezone

from postdesk import guard, paperfacts, writer
from postdesk.models import Draft
from postdesk.writer import ClaudeWriter, TemplateWriter

from .helpers import T0, FakeClaude, budget, cfg

NOW = datetime(2026, 10, 22, 4, 0, tzinfo=timezone.utc)


def deck(tmp_path, demo=False, updated=NOW, desks=None):
    desks = desks if desks is not None else [
        {"label": "Sniper memecoins", "bank": 1000.0, "trades": 40, "net": 61.5, "open": {"n": 0, "value": 0},
         "week": {"green_week": True}},
        {"label": "Leader breakouts", "bank": 1000.0, "trades": 3, "net": -22.0, "open": {"n": 1, "value": -4.0},
         "week": {"green_week": False}},
        {"label": "Index trend filter", "bank": 1000.0, "trades": 0, "net": 0.0, "open": {"n": 0, "value": 0},
         "week": {"green_week": False}}]
    meta = {"demo": demo, "updated": updated.isoformat(), "day_one": int((NOW - timedelta(days=5)).timestamp()),
            "bank": 3000.0, "net": 39.5, "open": -4.0, "trades": 43,
            "weather": {"demo": demo, "trends": [{"symbol": "BTC", "pct": -5.8, "above": False}],
                        "mood": {"value": 31, "label": "Fear", "date": "2026-10-22"}}}
    p = tmp_path / "deck.json"
    p.write_text(json.dumps({"meta": meta, "desks": desks}))
    return p


def test_the_facts_are_true_plain_and_only_from_a_fresh_live_book(tmp_path):
    f = paperfacts.facts(NOW, deck(tmp_path))
    assert f[0] == "3 paper-trading bots, each started on $1,000 of fake money; the oldest has run for 6 days"
    assert f[1] == "all of them together: up $35.50 of fake money (+1.2%) over 43 paper trades"
    assert "best bot so far: 'Sniper memecoins', +6.2%" in f[2] and "worst bot so far: 'Leader breakouts', -2.6%" in f[3]
    assert "1 of the 3 bots haven't made a single trade yet" in f[4] and "'Sniper memecoins'" in f[5]
    assert "below its 150-day average" in f[6] and "sitting in cash on purpose" in f[6] and "31 (fear)" in f[7]
    assert paperfacts.facts(NOW, deck(tmp_path, demo=True)) == []                          # invented numbers: never
    assert paperfacts.facts(NOW, deck(tmp_path, updated=NOW - timedelta(days=3))) == []    # stale: not today's news
    assert paperfacts.facts(NOW, tmp_path / "missing.json") == []


def test_the_writer_gets_the_facts_and_the_format_only_when_the_book_is_fresh(tmp_path, monkeypatch):
    c = cfg(writer__style="comedy", writer__formats=["hot_take", "bot_diary"])
    b, _ = budget(c)
    monkeypatch.setattr(paperfacts, "DECK", deck(tmp_path))
    fake = FakeClaude({"drafts": [{"text": "My fake-money bots are up $35.50. I've aged ten years.", "format": "bot_diary",
                                   "topic": "bots", "source_url": "", "why": "w"}]})
    out = ClaudeWriter(c, b, fake).originals(NOW, 2, [], [], [])
    sent = json.loads(fake.calls[0]["messages"][0]["content"])
    assert "bot_diary" in sent["formats"] and "At most one bot_diary" in sent["task"]
    key = next(k for k in sent if k.startswith("paper_bot_facts"))
    assert sent[key][0].startswith("3 paper-trading bots") and out[0].format == "bot_diary"
    assert "must say the money is fake" in writer.FORMAT_HELP["bot_diary"]
    monkeypatch.setattr(paperfacts, "DECK", tmp_path / "gone.json")
    fake = FakeClaude({"drafts": [{"text": "x is mid.", "format": "bot_diary", "topic": "t", "source_url": "", "why": "w"}]})
    out = ClaudeWriter(c, b, fake).originals(NOW, 2, [], [], [])
    sent = json.loads(fake.calls[0]["messages"][0]["content"])
    assert list(sent["formats"]) == ["hot_take"] and not any(k.startswith("paper_bot_facts") for k in sent)
    assert out[0].format == "hot_take"                                  # no book today: no diary posts


def _failed(text, c=None):
    d = Draft("1", T0, "original", text, format="bot_diary")
    return {x.rule: x.level for x in guard.check(d, c or cfg()) if not x.ok}


def test_a_diary_post_must_say_fake_money_and_never_read_as_a_tip():
    good = _failed("Day 6. My paper-trading bots are down $41 of fake money. I checked them 30 times. Unc behaviour.")
    assert good == {"bot numbers": "warn"} or set(good) <= {"bot numbers", "numbers have a source"}
    assert all(level == "warn" for level in good.values())               # passes, but always waits for you
    assert _failed("My bots are down $41 today. Rough.")["says it's paper money"] == "block"
    assert _failed("My paper bots love $QNT right now")["no tickers"] == "block"
    assert _failed("Paper bots say buy the dip, to the moon")["not a tip"] == "block"
    assert _failed("Fake money only, but this is the next 100x, DM me")["not a tip"] == "block"
    other = Draft("2", T0, "original", "Leg day is a myth", format="hot_take")
    assert "says it's paper money" not in {x.rule for x in guard.check(other, cfg())}    # other formats untouched


def test_demo_diary_samples_pass_the_rules():
    c = cfg(writer__style="comedy", writer__formats=["bot_diary"])
    out = TemplateWriter(c).originals(T0, 3, [], [], [])
    assert len(out) == 3
    for d in out:
        d.checks = guard.check(d, c)
        assert not d.blocked, [x for x in d.checks if not x.ok]
        assert guard.may_auto_post(d, cfg(approval__mode="auto_originals", writer__style="comedy")) is False
