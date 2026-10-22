"""dilemma: an overheard scene built to be argued about, and the replies measure that tells the desk it's working."""
import pytest

from postdesk import analyst, guard
from postdesk.models import Draft
from postdesk.writer import FORMAT_HELP, TemplateWriter, system_prompt

from .helpers import T0, cfg


def test_the_format_tells_the_writer_the_shape_and_the_limits():
    h = FORMAT_HELP["dilemma"]
    assert "own quoted words" in h and "either/or question" in h and "both have a point" in h and "No narrator verdict" in h
    p = system_prompt(cfg(writer__style="comedy", writer__formats=["dilemma", "hot_take"], writer__max_chars=200,
                          writer__story_chars=280))
    assert "rotate it" in p and "never about what men or women are like" in p
    assert "may be made up" in p and "Statistics, studies, news" in p and "no real venues" in p
    assert "Never cheating accusations" in p
    assert "dilemma posts may run to 280 characters" in p
    assert "may run to" not in system_prompt(cfg(writer__style="comedy", writer__formats=["hot_take"]))


def test_stories_get_their_own_length_and_long_ones_need_premium():
    c = cfg(writer__style="comedy", writer__max_chars=200, writer__story_chars=280)
    story = Draft("1", T0, "original", "x " * 120, format="dilemma")              # 240 characters
    joke = Draft("2", T0, "original", "x " * 120, format="hot_take")
    fails = lambda d: {x.rule for x in guard.check(d, c) if not x.ok}          # noqa: E731
    assert "short" not in fails(story) and "short" in fails(joke)
    with pytest.raises(ValueError, match="needs X Premium"):
        cfg(account__premium=False, writer__story_chars=900)
    with pytest.raises(ValueError, match="can't be shorter"):
        cfg(writer__max_chars=200, writer__story_chars=150)
    assert cfg(account__premium=True, writer__story_chars=900).writer.story_chars == 900


def test_demo_dilemmas_pass_the_rules_and_end_on_a_question():
    c = cfg(writer__style="comedy", writer__formats=["dilemma"], writer__story_chars=280)
    out = TemplateWriter(c).originals(T0, 3, [], [], [])
    assert len(out) == 3
    for d in out:
        d.checks = guard.check(d, c)
        assert not d.blocked, [x for x in d.checks if not x.ok]
        assert d.text.rstrip().endswith("?") and d.text.count('"') >= 4


def _row(fmt, views, replies, i):
    return {"format": fmt, "hour": 9 + i % 3, "views": views, "eng": replies * 3, "replies": replies,
            "reach": views / 1000, "mature": True, "text": f"{fmt} {i}"}


def test_the_desk_learns_which_formats_start_conversations():
    n = analyst.MIN_COMPARE                                          # a lesson needs this many posts a format
    rs = [_row("dilemma", 2000, 30, i) for i in range(n)] + [_row("hot_take", 2000, 4, i) for i in range(n)] \
        + [_row("pov", 2000, 5, i) for i in range(n)]
    f = analyst.by_format(rs)
    assert f["dilemma"]["replies_per_k"] == 15.0 and f["hot_take"]["replies_per_k"] == 2.0
    lines = analyst.learnings(rs)
    assert any(ln.startswith("'dilemma' posts start the most conversations: 15.0 replies per 1,000 views") for ln in lines)
    even = [_row("hot_take", 2000, 4, i) for i in range(n)] + [_row("pov", 2000, 5, i) for i in range(n)]
    assert not any("conversations" in ln for ln in analyst.learnings(even))    # no clear leader: nothing said
