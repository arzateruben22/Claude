from datetime import date, datetime, timedelta, timezone

import pytest

from scanner.config import Criteria, load_criteria
from scanner.criteria import evaluate
from scanner.engine import run_scan
from scanner.market import ET, parse_pt
from scanner.models import Candidate, Halt, Metrics, NewsItem, Quote
from scanner.providers import alpaca, halts, massive
from scanner.providers.demo import DemoProvider

from helpers import FakeHttp, et

TUE = date(2026, 9, 29)

RSS = """<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:ndaq="http://www.nasdaqtrader.com/">
 <channel><title>NASDAQTrader.com</title>
  <item>
   <title>ABCD</title>
   <ndaq:HaltDate>09/29/2026</ndaq:HaltDate>
   <ndaq:HaltTime>07:32:12 .540</ndaq:HaltTime>
   <ndaq:IssueSymbol>ABCD</ndaq:IssueSymbol>
   <ndaq:IssueName>Abcd Inc</ndaq:IssueName>
   <ndaq:Mkt>NASDAQ</ndaq:Mkt>
   <ndaq:ReasonCode>T1</ndaq:ReasonCode>
   <ndaq:ResumptionDate></ndaq:ResumptionDate>
   <ndaq:ResumptionQuoteTime></ndaq:ResumptionQuoteTime>
   <ndaq:ResumptionTradeTime></ndaq:ResumptionTradeTime>
  </item>
  <item>
   <title>WXYZ</title>
   <ndaq:HaltDate>09/29/2026</ndaq:HaltDate>
   <ndaq:HaltTime>10:04:01</ndaq:HaltTime>
   <ndaq:IssueSymbol>WXYZ</ndaq:IssueSymbol>
   <ndaq:Mkt>NYSE American</ndaq:Mkt>
   <ndaq:ReasonCode>LUDP</ndaq:ReasonCode>
   <ndaq:ResumptionDate>09/29/2026</ndaq:ResumptionDate>
   <ndaq:ResumptionTradeTime>10:09:01</ndaq:ResumptionTradeTime>
  </item>
 </channel>
</rss>"""


# --- spread -------------------------------------------------------------------

@pytest.mark.parametrize("bid,ask,expected", [
    (4.98, 5.02, 0.8), (5.00, 5.00, None), (5.02, 4.98, None), (None, 5.0, None), (0, 5.0, None),
])
def test_spread_pct(bid, ask, expected):
    got = Quote("ABCD", 5.0, 4.0, bid=bid, ask=ask).spread_pct
    assert got == (None if expected is None else pytest.approx(expected))


def test_snapshot_quotes_are_read():
    now_ns = int(datetime(2026, 9, 29, 12, 40, tzinfo=timezone.utc).timestamp() * 1e9)
    m = massive.quote_from_snapshot({"ticker": "ABCD", "lastTrade": {"p": 5, "t": now_ns}, "prevDay": {"c": 4},
                                     "lastQuote": {"p": 4.98, "P": 5.02}}, TUE, "premarket")
    a = alpaca.quote_from_snapshot("ABCD", {"latestTrade": {"p": 5, "t": "2026-09-29T12:40:00Z"},
                                            "latestQuote": {"bp": 4.98, "ap": 5.02},
                                            "dailyBar": {"t": "2026-09-28T04:00:00Z", "c": 4}}, TUE, "premarket")
    assert (m.bid, m.ask) == (a.bid, a.ask) == (4.98, 5.02)


# --- halts feed -------------------------------------------------------------------

def test_parse_nasdaq_halt_feed():
    parsed = {h.symbol: h for h in halts.parse(RSS)}
    abcd, wxyz = parsed["ABCD"], parsed["WXYZ"]
    assert abcd.code == "T1" and abcd.halted_at == datetime(2026, 9, 29, 7, 32, 12, tzinfo=ET)
    assert abcd.resumed_at is None and abcd.active(et(TUE, 8, 45))
    assert wxyz.resumed_at == datetime(2026, 9, 29, 10, 9, 1, tzinfo=ET)
    assert wxyz.active(et(TUE, 10, 5)) and not wxyz.active(et(TUE, 10, 10))
    assert not abcd.active(et(TUE, 7))  # not halted before it happened


def test_fetch_asks_for_each_day():
    http = FakeHttp({"rss.aspx": lambda url, p: RSS})
    http.get_text = http.get
    got = halts.fetch([date(2026, 9, 28), TUE], http=http)
    assert [c[1]["haltdate"] for c in http.calls] == ["09282026", "09292026"]
    assert all(c[1]["feed"] == "tradehalts" for c in http.calls)
    assert len(got["ABCD"]) == 2  # same fake feed served twice


# --- rules -------------------------------------------------------------------------

def _cand(**kw):
    m = Metrics(5.0, 4.0, 25.0, 200_000, 20_000, 10.0, 1e6, 5.2, 10)
    c = Candidate("ABCD", "Abcd", m, 8e6, news=[NewsItem("Abcd wins", et(TUE, 6))])
    for k, v in kw.items():
        setattr(c, k, v)
    return c


def test_spread_rule():
    c = _cand(spread_pct=0.6)
    evaluate(c, Criteria())
    assert c.passed
    c = _cand(spread_pct=3.2)
    evaluate(c, Criteria())
    assert c.failures == ["spread 3.2% > 1.5%"]
    c = _cand(spread_pct=None)
    evaluate(c, Criteria())
    assert c.passed and "spread unknown" in c.warnings
    c = _cand(spread_pct=None)
    evaluate(c, Criteria(allow_unknown_spread=False))
    assert c.failures == ["spread unknown"]


def test_halt_rules():
    c = _cand(spread_pct=0.5, halted_now="T1")
    evaluate(c, Criteria())
    assert c.failures == ["halted now: news pending (T1)"]
    c = _cand(spread_pct=0.5, halted_now="T1")
    evaluate(c, Criteria(exclude_halted=False))
    assert c.passed
    t = et(TUE, 10)
    c = _cand(spread_pct=0.5, halts=[Halt("ABCD", "LUDP", t, t + timedelta(minutes=5)),
                                     Halt("ABCD", "LUDP", t, t + timedelta(minutes=5)),
                                     Halt("ABCD", "T12", t, t + timedelta(hours=2))])
    evaluate(c, Criteria())
    assert c.passed
    assert c.warnings == ["volatility pause (LUDP) x2 since last session",
                          "halted: info requested by Nasdaq (T12) since last session"]


def test_scan_survives_halt_feed_outage():
    class NoHalts(DemoProvider):
        def halts(self, days):
            raise RuntimeError("HTTP 403 from www.nasdaqtrader.com")

    res = run_scan(NoHalts(), load_criteria(), parse_pt("2026-09-28 05:45"), "premarket")
    assert any("Halt check unavailable" in n for n in res.notes)
    assert "DMHLT" in [c.symbol for c in res.passed]  # can't know it's halted without the feed
