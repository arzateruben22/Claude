import pytest

from postdesk import config, guard
from postdesk.writer import FORMAT_HELP
from postdesk.models import Draft

from .helpers import T0, cfg


def draft(text, kind="original", **kw):
    return Draft(id="d1", created=T0, kind=kind, text=text, **kw)


def failed(d, c=None, recent=(), borrowed=()):
    return {x.rule: x.level for x in guard.check(d, c or cfg(), recent, borrowed) if not x.ok}


# -- settings --------------------------------------------------------------------------------

def test_your_settings_load():
    c = config.load()
    assert c.approval.mode == "review"           # nothing posts without you until you say so
    assert c.writer.links == "never"
    assert c.writer.style == "comedy" and set(c.writer.formats) <= set(FORMAT_HELP)


def test_comedy_never_touches_politics_or_drugs():
    c = config.load()
    for text in ("my cardio plan is the same as the election: avoid it", "rave tip: drugs are not a personality"):
        assert failed(draft(text), c).get("avoided topics") == "block"


def test_someone_elses_joke_is_blocked():
    joke = "Treadmill: 45 minutes. Distance: emotional."
    assert failed(draft("Treadmill: 45 minutes. Distance: emotional!"), borrowed=[joke]).get("not someone else's post") == "block"
    assert "not someone else's post" not in failed(draft("Leg day is a scam invented by people who own stairs."),
                                                    borrowed=[joke])


def test_unknown_settings_are_rejected(tmp_path):
    p = tmp_path / "desk.toml"
    p.write_text('[account]\nhandel = "typo"\n')
    with pytest.raises(ValueError, match="handel"):
        config.load(p)
    p.write_text("[acount]\n")
    with pytest.raises(ValueError, match="acount"):
        config.load(p)


def test_settings_that_cant_work_are_rejected():
    with pytest.raises(ValueError, match="don't fit"):
        cfg(schedule__posts_per_day=20)          # 20 posts, 60 minutes apart, in 16 hours
    with pytest.raises(ValueError, match="mode"):
        cfg(approval__mode="yolo")
    with pytest.raises(Exception):
        cfg(account__timezone="Mars/Olympus")
    assert config.parse_hours("07:00-23:30") == (420, 1410)
    with pytest.raises(ValueError):
        config.parse_hours("23:00-07:00")


def test_handles_lose_their_at_sign():
    c = cfg(account__handle="@me", topics__curated_reposts=["@Friend"])
    assert c.account.handle == "me" and c.topics.curated_reposts == ["friend"]


def test_env_file(tmp_path, monkeypatch):
    p = tmp_path / ".env"
    p.write_text('# comment\nPD_A="quoted # not a comment"\nPD_B=plain # trailing\nPD_C=\nnot a line\n')
    for k in ("PD_A", "PD_B", "PD_C"):
        monkeypatch.delenv(k, raising=False)
    monkeypatch.setenv("PD_B", "already set")
    config.load_env(p)
    import os

    assert os.environ["PD_A"] == "quoted # not a comment"
    assert os.environ["PD_B"] == "already set"
    assert os.environ["PD_C"] == ""


# -- guard -------------------------------------------------------------------------------------

def test_length_counts_like_x():
    assert guard.weighted_length("hello") == 5
    assert guard.weighted_length("see https://example.com/a/very/long/path") == 4 + 23
    assert guard.weighted_length("日本") == 4
    assert guard.weighted_length("— “quotes”") == 10      # punctuation isn't double width


def test_a_clean_post_passes():
    assert failed(draft("The moat isn't the model. It's the boring workflow you built around it.")) == {}


@pytest.mark.parametrize("text,rule", [
    ("Great thread by @someone about agents", "no @mentions"),
    ("Big news #AI #agents #LLM", "hashtags"),
    ("Read this https://example.com", "links"),
    ("Like if you agree that agents need limits!", "no engagement bait"),
    ("Retweet if you think so", "no engagement bait"),
    ("Who wins the election this year, AI or humans?", "avoided topics"),
    ("", "not empty"),
])
def test_block_rules(text, rule):
    assert failed(draft(text)).get(rule) == "block"


def test_long_posts():
    long = "word " * 70
    assert failed(draft(long)) == {"short": "warn"}                                # Premium: it fits, but it's long
    assert failed(draft(long), cfg(account__premium=False)).get("fits on X") == "block"


def test_repeats_are_blocked():
    a = "Agents don't fail because they're dumb. They fail because nobody told them what done looks like."
    b = "Agents don't fail because they're dumb. They fail because nobody told them what done looks like!!"
    assert failed(draft(b), recent=[a]).get("not a repeat") == "block"
    assert "not a repeat" not in failed(draft("Totally different words here about tests."), recent=[a])


def test_numbers_without_a_source_need_a_look():
    assert failed(draft("We cut costs by 40% with one change.")) == {"numbers have a source": "warn"}
    assert failed(draft("We cut costs by 40% with one change.", source_url="https://x.example/a")) == {}


def test_links_when_allowed_cost_more_and_affiliates_need_disclosure():
    c = cfg(writer__links="allowed", money__affiliate_domains=["amzn.to"])
    assert failed(draft("Docs: https://example.com"), c) == {"link cost": "warn"}
    assert failed(draft("My desk lamp: https://amzn.to/x"), c).get("disclosure") == "block"
    assert "disclosure" not in failed(draft("My desk lamp: https://amzn.to/x #ad"), c)


def test_quotes_need_real_commentary():
    d = draft("So true.", kind="quote", target_id="123")
    assert failed(d).get("real commentary") == "block"
    d = draft("The part worth copying: they shipped the small version first and listened.", kind="quote")
    assert failed(d).get("quote target") == "block"


def test_reposts_outside_the_curated_list_need_you():
    c = cfg(topics__curated_reposts=["friend"], account__handle="me")
    assert failed(draft("", kind="repost", target_author="friend"), c) == {}
    assert failed(draft("", kind="repost", target_author="stranger"), c) == {"curated account": "warn"}
    assert failed(draft("", kind="repost", target_author="me"), c).get("not your own post") == "block"


def test_what_may_post_without_you():
    review, auto = cfg(), cfg(approval__mode="auto_originals")
    clean = draft("Shipping beats polishing. A rough tool people use teaches you more.")
    clean.checks = guard.check(clean, auto)
    assert not guard.may_auto_post(clean, review)        # review mode: never
    assert guard.may_auto_post(clean, auto)
    warned = draft("We cut costs by 40% with one change.")
    warned.checks = guard.check(warned, auto)
    assert not guard.may_auto_post(warned, auto)         # anything flagged waits for you
    quote = draft("The part worth copying: they shipped the small version first.", kind="quote", target_id="1")
    quote.checks = guard.check(quote, auto)
    assert not quote.blocked and not guard.may_auto_post(quote, auto)    # quotes always wait
    rp = draft("", kind="repost", target_author="friend")
    c = cfg(approval__mode="auto_originals", topics__curated_reposts=["friend"])
    rp.checks = guard.check(rp, c)
    assert not guard.may_auto_post(rp, c)
    c.approval.auto_curated_reposts = True
    assert guard.may_auto_post(rp, c)


def test_spicy_words_always_wait_for_you():
    c = cfg(approval__mode="auto_originals", writer__hold_words=["crack"])
    d = draft("Gym crush asked if I crack. After leg day I can barely crack a smile.")
    d.checks = guard.check(d, c)
    assert failed(d, c) == {"spicy word": "warn"} and not d.blocked
    assert not guard.may_auto_post(d, c)                   # automatic mode still holds it
    clean = draft("Leg day is a scam invented by people who own stairs.")
    clean.checks = guard.check(clean, c)
    assert guard.may_auto_post(clean, c)


def test_your_slang_loads():
    c = config.load()
    assert c.writer.edge in ("clean", "edgy", "spicy") and "unc" in c.writer.slang and "crack" in c.writer.hold_words
