"""Backtest: pipeline, caching, and — most important — no peeking at the future."""
from datetime import date, datetime, time, timedelta, timezone

from scanner import backtest, journal
from scanner.__main__ import main
from scanner.config import load_criteria
from scanner.engine import run_scan
from scanner.market import ET, parse_pt
from scanner.models import Bar, Halt
from scanner.providers import alpaca
from scanner.providers.base import aggregate
from scanner.providers.demo import DemoProvider

from helpers import FakeHttp, day_bars, et

CRIT = load_criteria()
TUE = date(2026, 9, 29)


def test_demo_backtest_end_to_end(tmp_path):
    out, stats = backtest.run_backtest(DemoProvider(), CRIT, date(2026, 9, 21), date(2026, 9, 25),
                                       out_dir=tmp_path, log=lambda s: None)
    rows = journal._read(out / "journal.csv")
    assert len({r["scan_date"] for r in rows}) == 5
    assert all(r["graded_at"] for r in rows)
    # halted stock never picked; DMWID passes because historical spreads are unknown
    assert "DMHLT" not in {r["symbol"] for r in rows}
    assert {r["symbol"] for r in rows} == {"DMBIO", "DMAI", "DMEV", "DMFRT", "DMWID"}
    assert "Profit factor" in stats and "By gap:" in stats
    summary = (out / "summary.md").read_text()
    assert "today's float" in summary and "Backtest 2026-09-21" in summary


def test_demo_backtest_evening_grades_next_day(tmp_path):
    out, _ = backtest.run_backtest(DemoProvider(), CRIT, date(2026, 9, 25), date(2026, 9, 25), session="afterhours",
                                   at=time(17, 0), out_dir=tmp_path, log=lambda s: None)
    rows = journal._read(out / "journal.csv")
    assert rows and all(r["trade_date"] == "2026-09-28" and r["graded_at"] for r in rows)  # Fri -> Mon


# --- no-lookahead guarantees ------------------------------------------------------------

class FakeMarket:
    """Serves 15-minute bars; one of them finishes after the cutoff."""

    name = "fake"

    def __init__(self):
        self.calls = []

    def bars(self, symbols, start, end, timeframe):
        self.calls.append((start, end, timeframe))
        d = start.astimezone(ET).date()
        mk = lambda hh, mm, px: Bar(datetime.combine(d, time(hh, mm), tzinfo=ET), px, px, px, px, 1000)  # noqa: E731
        return {"ABCD": [mk(8, 15, 5.0), mk(8, 30, 6.0), mk(8, 45, 99.0)]}


def test_screen_uses_only_finished_bars():
    m = FakeMarket()
    closes = {date(2026, 9, 28): {"ABCD": 4.0}}
    quotes = backtest.historical_screen(m, {"ABCD": "Abcd"}, closes, et(TUE, 8, 52), "premarket")
    # cutoff rounds 8:52 down to 8:45; the 8:30 bar ends at 8:45 (ok), the 8:45 bar hasn't finished
    assert [q.price for q in quotes] == [6.0]
    assert m.calls[0][1] == et(TUE, 8, 45)


def test_screen_cutoff_rounds_down_and_caps_at_session_end():
    assert backtest.screen_cutoff(et(TUE, 8, 44), "premarket") == et(TUE, 8, 30)
    assert backtest.screen_cutoff(et(TUE, 11, 0), "premarket") == et(TUE, 9, 30)


def test_engine_ignores_future_halts_and_bounds_news():
    seen = {}

    class Spy(DemoProvider):
        def halts(self, days):
            later = self.now + timedelta(hours=2)
            return {"DMBIO": [Halt("DMBIO", "LUDP", later, later + timedelta(minutes=5))]}

        def news(self, symbols, since, until=None):
            seen["until"] = until
            return super().news(symbols, since, until)

    now = parse_pt("2026-09-28 05:45")
    res = run_scan(Spy(), CRIT, now, "premarket")
    bio = next(c for c in res.passed if c.symbol == "DMBIO")
    assert not any("LUDP" in w for w in bio.warnings)  # a 7:45am halt can't be known at 5:45am
    assert seen["until"] == now


def test_news_cutoff_reaches_the_apis():
    http = FakeHttp({"/v1beta1/news": lambda url, p: {"news": []}})
    alpaca.AlpacaProvider("k", "s", feed="sip", http=http).news(["ABCD"], et(TUE, 0), until=et(TUE, 8, 45))
    assert http.calls[0][1]["end"] == "2026-09-29T12:45:00Z"


class CountingSource:
    """Inner provider for the cache: builds flat days and counts fetches."""

    name = "counting"
    delay_minutes = 0

    def __init__(self):
        self.fetches = 0

    def intraday_bars(self, symbols, start, end):
        self.fetches += 1
        out = {}
        for s in symbols:
            bars, d = [], start.astimezone(ET).date()
            while d <= end.astimezone(ET).date():
                bars += [b for b in day_bars(d) if start <= b.start < end] if d.weekday() < 5 else []
                d += timedelta(days=1)
            out[s] = bars
        return out


def test_cache_fetches_once_and_still_hides_the_future(tmp_path):
    src = CountingSource()
    start, end = et(date(2026, 9, 8), 4), et(date(2026, 9, 15), 8, 45)  # past days only
    first = backtest.CachedProvider(src, tmp_path).intraday_bars(["ABCD"], start, end)
    assert src.fetches == 1
    assert max(b.start for b in first["ABCD"]) < end  # whole days cached, nothing after `end` returned
    again = backtest.CachedProvider(src, tmp_path).intraday_bars(["ABCD"], start, end)
    assert src.fetches == 1 and len(again["ABCD"]) == len(first["ABCD"])
    later = backtest.CachedProvider(src, tmp_path).intraday_bars(["ABCD"], start, et(date(2026, 9, 15), 20))
    assert src.fetches == 1 and len(later["ABCD"]) > len(first["ABCD"])  # rest of the day came from cache
    assert (tmp_path / "bars" / "2026-09-15.json.gz").exists()


def test_cache_never_stores_an_unfinished_day(tmp_path):
    today = datetime.now(ET).date()
    cached = backtest.CachedProvider(CountingSource(), tmp_path)
    cached.intraday_bars(["ABCD"], datetime.combine(today, time(4), tzinfo=ET), datetime.now(timezone.utc))
    assert not (tmp_path / "bars" / f"{today}.json.gz").exists()


# --- building blocks -------------------------------------------------------------------

def test_aggregate_15min_and_daily():
    bars = day_bars(TUE, price=5.0, close=5.5)
    fifteen = aggregate(bars, "15Min")
    assert len(fifteen) == 64 and fifteen[0].start == et(TUE, 4) and fifteen[0].volume == 3 * 1000
    daily = aggregate(bars, "1Day")
    assert len(daily) == 1 and daily[0].close == 5.5 and daily[0].open == 5.0
    assert daily[0].volume == sum(b.volume for b in bars)


def test_alpaca_universe_includes_delisted(monkeypatch, tmp_path):
    monkeypatch.setattr(alpaca, "CACHE", tmp_path)

    def assets(url, p):
        if p["status"] == "active":
            return [{"symbol": "LIVE", "name": "Live", "tradable": True, "exchange": "NASDAQ"}]
        return [{"symbol": "GONE", "name": "Gone", "tradable": False, "exchange": "NYSE"},
                {"symbol": "OTCX", "name": "Otc", "tradable": False, "exchange": "OTC"}]

    prov = alpaca.AlpacaProvider("k", "s", http=FakeHttp({"/v2/assets": assets}))
    assert dict(prov.universe(include_inactive=True)) == {"LIVE": "Live", "GONE": "Gone"}
    assert dict(prov.universe()) == {"LIVE": "Live"}


def test_alpaca_bars_timeframes():
    http = FakeHttp({"/v2/stocks/bars": lambda url, p: {"bars": {}}})
    prov = alpaca.AlpacaProvider("k", "s", feed="sip", http=http)
    prov.bars(["A"] * 450, et(TUE, 4), et(TUE, 8), "15Min")
    prov.intraday_bars(["A"], et(TUE, 4), et(TUE, 8))
    assert [c[1]["timeframe"] for c in http.calls] == ["15Min", "15Min", "5Min"]  # 450 symbols -> 2 chunks


def test_risk_numbers(tmp_path):
    path = tmp_path / "j.csv"
    base = {"session": "premarket", "scan_time_pt": "05:45", "tags": "fda", "gap_pct": "25", "rvol": "8",
            "float_shares": "9000000", "scan_price": "4", "open_vs_scan_pct": "1", "max_up_pct": "5",
            "graded_at": "x"}
    pnls = [9.5, -5.5, -5.5, 4.5]
    journal._write(path, [dict(base, trade_date=f"2026-09-{21 + i}", symbol=f"S{i}", scan_date=f"2026-09-{21 + i}",
                               sim_pnl_pct=str(p)) for i, p in enumerate(pnls)])
    out = journal.stats(CRIT, path)
    assert "Profit factor 1.27" in out
    assert "Worst drawdown -11.0%" in out and "longest losing streak 2" in out
    assert "  +20-40%" in out and "  5-10M" in out and "  under $5" in out


def test_cli_rejects_times_between_bars(capsys):
    assert main(["backtest", "--demo", "--from", "2026-09-21", "--to", "2026-09-22", "--time", "05:47"]) == 2
    assert "5-minute mark" in capsys.readouterr().err
