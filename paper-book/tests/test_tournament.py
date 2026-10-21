"""Thirty desks: ten rulebooks per market, each on its own paper bank, judged on Friday, at month end, and then by
a green week. Everything here reads book.toml and the rulebooks the way the live book does."""
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import deck  # noqa: E402
import paperbook as pb  # noqa: E402
import watchdog as wd  # noqa: E402

try:
    import tomllib
except ModuleNotFoundError:  # Python 3.10
    import tomli as tomllib  # type: ignore[no-redef]

HERE = Path(__file__).resolve().parent.parent
ROOT = HERE.parent
LA = ZoneInfo("America/Los_Angeles")
NOW = datetime(2026, 10, 21, 1, 0, tzinfo=timezone.utc)          # Tue 20 Oct, 18:00 in Los Angeles


def cfg():
    with open(HERE / "book.toml", "rb") as fh:
        return tomllib.load(fh)


def desks_of(c):
    return [k for k, v in c.items() if k not in pb.NOT_DESKS and isinstance(v, dict)]


def test_book_toml_has_ten_desks_per_market_each_with_its_own_rulebook_and_colour():
    c = cfg()
    desks = desks_of(c)
    assert len(desks) == 30
    meta = {d: pb.desk_meta(d, c[d]) for d in desks}
    assert {m: sum(1 for d in desks if meta[d]["market"] == m) for m in pb.MARKETS} == {
        "memecoins": 10, "big coins": 10, "stocks": 10}
    colours = [meta[d]["color"] for d in desks]
    assert len(set(colours)) == 30 and all(len(x) == 7 and x.startswith("#") for x in colours)
    assert len({meta[d]["label"] for d in desks}) == 30 and len({meta[d]["abbr"] for d in desks}) == 30
    for d in desks:
        assert c[d]["start_bank"] == 100.0, d
        base, _, book = d.partition("_")
        if base == "memecoins":
            rules = ROOT / "night-desk" / (f"desk-{book}.toml" if book else "desk.toml")
            assert c[d]["folder"] == f"../night-desk/output/{book + '/' if book else ''}live", d
        elif base == "majors":
            rules = ROOT / "majors-desk" / (f"majors-{book}.toml" if book else "majors.toml")
            assert c[d]["folder"] == f"../majors-desk/output/{book + '/' if book else ''}live", d
        else:
            rules = ROOT / "premarket-scanner" / (f"criteria-{book}.toml" if book else "criteria.toml")
            assert c[d]["journal"] == f"../premarket-scanner/output/{book + '/' if book else ''}journal.csv", d
            assert (HERE / c[d].get("rules", "../premarket-scanner/criteria.toml")).resolve() == rules
        assert rules.exists(), f"{d}: {rules.name} is missing"
        assert meta[d]["of"] == (base if book else None), d
    assert c["report"]["checkpoints"] == {"first look": date(2026, 10, 23), "month end": date(2026, 10, 31)}


def test_a_desk_the_code_does_not_know_is_described_by_its_section():
    m = pb.desk_meta("memecoins_sniper", {"label": "Sniper memecoins", "kind": "coins", "market": "memecoins",
                                          "of": "memecoins", "color": "#9df1e3"})
    assert m == {"label": "Sniper memecoins", "kind": "coins", "market": "memecoins", "of": "memecoins",
                 "color": "#9df1e3", "abbr": "MSNI", "prefix": "$"}
    assert pb.desk_meta("majors_btc", {"label": "Bitcoin only", "market": "big coins"})["prefix"] == ""
    assert pb.desk_meta("stocks_hold", {"label": "Hold stocks", "journal": "x.csv"})["kind"] == "stocks"
    assert pb.desk_meta("stocks", {}) == {"label": "Stocks", "kind": "stocks", "market": "stocks", "of": None,
                                          "color": "#a08cff", "abbr": "STK", "prefix": "$"}
    with pytest.raises(ValueError, match="label"):
        pb.desk_meta("memecoins_new", {"folder": "x"})
    with pytest.raises(ValueError, match="kind"):
        pb.desk_meta("x", {"label": "X", "kind": "bonds"})
    with pytest.raises(ValueError, match="market"):
        pb.desk_meta("x", {"label": "X", "kind": "coins", "market": "forex"})


def small_book(desks, trades=None, now=NOW):
    t = {d: list((trades or {}).get(d, [])) for d in desks}
    market = lambda d: "stocks" if d.startswith("stocks") else "big coins" if d.startswith("majors") else "memecoins"  # noqa: E731
    meta = {d: pb.desk_meta(d, {"label": d.replace("_", " ").title(), "market": market(d),
                                "kind": "stocks" if market(d) == "stocks" else "coins"}
                            if d not in pb.DESKS else {}) for d in desks}
    return pb.Book(t, {d: [] for d in desks}, {d: 100.0 for d in desks}, {}, False, now, LA, meta=meta, order=tuple(desks))


def test_desks_are_listed_market_by_market_the_known_ones_first():
    b = small_book(["stocks_hold", "majors_slow", "stocks", "memecoins_tiny", "majors", "memecoins", "memecoins_sniper"])
    assert b.desks == ("memecoins", "memecoins_tiny", "memecoins_sniper", "majors", "majors_slow", "stocks", "stocks_hold")
    assert b.label("memecoins_tiny") == "Memecoins Tiny" and b.market("majors_slow") == "big coins"
    assert b.variant_of("stocks_hold") == "stocks" and b.variant_of("stocks") is None


def trade(desk, pnl, closed):
    return pb.Trade(desk, "$X", closed - timedelta(hours=1), closed, pnl, pnl, "target" if pnl > 0 else "stop")


def day(n, hour=12):
    """A trade close n days before NOW's local date, at the given local hour."""
    local = NOW.astimezone(LA).date() - timedelta(days=n)
    return datetime.combine(local, datetime.min.time(), tzinfo=LA).replace(hour=hour)


def test_a_green_week_needs_three_days_of_trading_a_net_gain_and_no_day_that_wipes_it():
    today = NOW.astimezone(LA).date()
    b = small_book(["memecoins"], {"memecoins": [trade("memecoins", 4.0, day(0)), trade("memecoins", 3.0, day(2)),
                                                 trade("memecoins", -2.0, day(4)), trade("memecoins", 9.0, day(9))]})
    w = deck.week(b, "memecoins", today)
    assert w == {"net": 5.0, "traded": 3, "green": 2, "red": 1, "worst_day": -2.0, "green_week": True, "streak": 1}   # day 9 is out
    b = small_book(["memecoins"], {"memecoins": [trade("memecoins", 4.0, day(0)), trade("memecoins", 3.0, day(2))]})
    assert deck.week(b, "memecoins", today)["green_week"] is False                       # only two days traded
    b = small_book(["memecoins"], {"memecoins": [trade("memecoins", 9.0, day(0)), trade("memecoins", -8.0, day(1)),
                                                 trade("memecoins", 1.0, day(3))]})
    w = deck.week(b, "memecoins", today)
    assert w["net"] == 2.0 and w["worst_day"] == -8.0 and w["green_week"] is False      # one day lost more than the week made
    assert deck.week(small_book(["memecoins"]), "memecoins", today)["traded"] == 0


def test_the_deck_carries_markets_weeks_and_the_checkpoint_dates():
    b = small_book(["memecoins", "majors_slow", "stocks"], {"stocks": [trade("stocks", 2.5, day(1))]})
    b.checkpoints = {"first look": date(2026, 10, 23), "month end": datetime(2026, 10, 31, 12, 0), "bad": "x"}
    d = deck.data(b)
    assert d["meta"]["markets"] == ["memecoins", "big coins", "stocks"] and d["meta"]["week_days"] == 7
    assert [c["label"] for c in d["meta"]["checkpoints"]] == ["first look", "month end"]
    first = d["meta"]["checkpoints"][0]
    assert first["local"] == "Fri 23 Oct" and first["date"] == "2026-10-23"
    assert datetime.fromtimestamp(first["at"], LA).strftime("%Y-%m-%d %H:%M") == "2026-10-23 23:59"
    by = {x["key"]: x for x in d["desks"]}
    assert by["majors_slow"]["market"] == "big coins" and by["majors_slow"]["idea"] == "daily, long windows"
    assert by["stocks"]["week"]["net"] == 2.5 and by["stocks"]["week"]["traded"] == 1
    assert deck.checkpoints(small_book(["memecoins"])) == []


def test_the_evening_summary_with_a_crowd_names_the_best_the_worst_and_the_green_weeks():
    desks = [f"memecoins_{b}" for b in ("sniper", "momentum", "patient", "scalper", "whale", "runner", "tiny")]
    trades = {"memecoins_sniper": [trade("memecoins_sniper", 6.0, day(0, 9)), trade("memecoins_sniper", 2.0, day(1)),
                                   trade("memecoins_sniper", 1.0, day(3))],
              "memecoins_whale": [trade("memecoins_whale", -4.0, day(0, 9)), trade("memecoins_whale", -1.0, day(2))],
              "memecoins_tiny": [trade("memecoins_tiny", 0.5, day(0, 9))]}
    b = small_book(desks, trades)
    p = wd.summary(b, NOW.astimezone(LA).date())
    assert p.title == "Paper book · Tue 20 Oct: +$2.50 today"
    lines = p.body.splitlines()
    assert lines[0] == "Today: 3 of 7 desks traded · best Memecoins Sniper +$6.00 · worst Memecoins Whale −$4.00"
    assert lines[1] == "Last 7 days: best Memecoins Sniper +$9.00 · worst Memecoins Whale −$5.00"
    assert lines[2] == "Green week: Memecoins Sniper"
    assert lines[3].startswith("All desks: +$4.50 (+0.6% of $700)")
    quiet = wd.summary(small_book(desks), NOW.astimezone(LA).date()).body.splitlines()
    assert quiet[0] == "Today: none of the 7 desks closed a trade" and quiet[1] == "Green week: none yet"


def test_the_paper_book_page_seats_thirty_desks():
    c = cfg()
    b = pb.load(c, demo=True, now=NOW)
    assert len(b.desks) == 30 and b.bank_total == 3000.0
    page = pb.render_html(b)
    assert '<div class="tiles many crowd" style="--cols:8">' in page
    for d in b.desks:
        assert b.label(d) in page, d
    assert "Sniper memecoins" in page and "night-desk/desk-sniper.toml" in page
    assert "Hold stocks" in page and "premarket-scanner/criteria-hold.toml" in page


def test_the_standings_printout_ranks_every_desk_and_names_the_green_weeks():
    desks = ["memecoins", "memecoins_sniper", "majors", "stocks"]
    trades = {"memecoins_sniper": [trade("memecoins_sniper", 6.0, day(0, 9)), trade("memecoins_sniper", 2.0, day(1)),
                                   trade("memecoins_sniper", 1.0, day(3))],
              "majors": [trade("majors", -3.0, day(2))]}
    b = small_book(desks, trades)
    b.checkpoints = {"first look": date(2026, 10, 23)}
    text = pb.render_standings(b)
    lines = text.splitlines()
    assert lines[0].startswith("STANDINGS · paper money only · Tue 20 Oct 18:00 PDT · first look Fri 23 Oct")
    assert lines[2].split()[:3] == ["1", "memecoins", "sniper"] and "+$9.00" in lines[2] and "GREEN WEEK" in lines[2]
    assert "3g 0r" in lines[2] and lines[2].rstrip().endswith("3 trades · too few to judge · GREEN WEEK")
    assert lines[-3].split()[0] == "4" and "big coins" in lines[-3] and "−$3.00" in lines[-3]   # the loser is last
    assert "all desks" in lines[-2] and "+$6.00" in lines[-2]
    assert lines[-1].startswith("  green week: Memecoins Sniper")
    assert "no trades yet" in text and "—" in text


def test_on_a_read_date_the_evening_push_carries_the_ranking():
    desks = [f"memecoins_{b}" for b in ("sniper", "momentum", "patient", "scalper", "whale", "runner", "tiny")]
    trades = {"memecoins_sniper": [trade("memecoins_sniper", 6.0, day(0, 9))],
              "memecoins_whale": [trade("memecoins_whale", -4.0, day(0, 9))],
              "memecoins_tiny": [trade("memecoins_tiny", 0.5, day(1))]}
    b = small_book(desks, trades)
    today = NOW.astimezone(LA).date()
    b.checkpoints = {"first look": today, "month end": date(2026, 10, 31)}
    p = wd.summary(b, today)
    assert p.title == "First look · Tue 20 Oct: +$2.50 since the start"
    lines = p.body.splitlines()
    assert lines[0] == ("First look, day 20 Oct. Top 3: Memecoins Sniper +$6.00 (+6.0%); Memecoins Tiny +$0.50 (+0.5%); "
                        "Memecoins Momentum $0.00 (+0.0%).")
    assert lines[1] == "Bottom 3: Memecoins Scalper $0.00 (+0.0%); Memecoins Runner $0.00 (+0.0%); Memecoins Whale −$4.00 (−4.0%)."
    assert lines[2].startswith("Today: 2 of 7 desks traded")
    plain = wd.summary(b, today - timedelta(days=1))                     # any other evening: the usual push
    assert plain.title.startswith("Paper book · Mon 19 Oct")


def test_a_streak_counts_green_weeks_back_to_back():
    today = NOW.astimezone(LA).date()
    ts = [trade("memecoins", 2.0, day(n)) for n in (0, 2, 4, 7, 9, 11, 14, 16, 18)] + [trade("memecoins", -30.0, day(21))]
    b = small_book(["memecoins"], {"memecoins": ts})
    w = deck.week(b, "memecoins", today)
    assert w["green_week"] and w["streak"] == 3                          # this week, last week, the week before; then a red one
    b = small_book(["memecoins"], {"memecoins": ts[:6]})
    assert deck.week(b, "memecoins", today)["streak"] == 2
    assert deck.week(small_book(["memecoins"]), "memecoins", today)["streak"] == 0
    assert pb.render_standings(small_book(["memecoins"], {"memecoins": ts[:6]})).count("GREEN WEEK ×2") == 1


def test_a_green_week_is_pushed_once_a_week():
    ts = [trade("memecoins_sniper", 2.0, day(n)) for n in (0, 2, 4)]
    b = small_book(["memecoins_sniper", "memecoins_whale"], {"memecoins_sniper": ts})
    state = {}
    pushes = wd.check_green(NOW, state, b)
    assert [p.title for p in pushes] == ["Memecoins Sniper has a green week"]
    assert pushes[0].body.startswith("+$6.00 over the last 7 days: 3 green days, 0 red, traded on 3 of 7")
    assert wd.check_green(NOW + timedelta(days=1), state, b) == []        # not again tomorrow
    later = NOW + timedelta(days=7, hours=1)
    ts += [trade("memecoins_sniper", 1.0, day(-7 + n)) for n in (1, 3, 5)]
    b = small_book(["memecoins_sniper"], {"memecoins_sniper": ts}, now=later)
    assert [p.title for p in wd.check_green(later, state, b)] == ["Memecoins Sniper has a green week, 2 weeks in a row"]


def test_every_build_writes_the_standings_and_serves_them(tmp_path):
    c = cfg()
    b = pb.build(c, True, tmp_path / "out", NOW)
    text = (tmp_path / "out" / "standings.txt").read_text()
    assert text.startswith("STANDINGS (DEMO markets)") and len([ln for ln in text.splitlines() if ln.strip()[:2].strip().isdigit()]) == 30
    assert pb.SERVED["/standings"] == "standings.txt" and pb.TYPES[".txt"].startswith("text/plain")
    assert len(b.desks) == 30


def test_the_standings_are_kept_as_a_file_on_each_read_date(tmp_path):
    c = cfg()
    c["report"]["checkpoints"] = {"first look": NOW.astimezone(LA).date(), "month end": date(2026, 10, 31)}
    pb.build(c, True, tmp_path / "out", NOW)
    kept = tmp_path / "out" / f"standings-{NOW.astimezone(LA).date().isoformat()}.txt"
    assert kept.exists() and kept.read_text().startswith("FIRST LOOK · Tue 20 Oct 2026\nSTANDINGS")
    assert not (tmp_path / "out" / "standings-2026-10-31.txt").exists()
