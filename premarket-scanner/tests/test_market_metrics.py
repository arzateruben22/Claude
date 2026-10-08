from datetime import date, timedelta, timezone

import pytest

from scanner import market
from scanner.metrics import compute
from scanner.models import Bar

from helpers import day_bars, et

MON, TUE = date(2026, 9, 28), date(2026, 9, 29)


# --- market clock ------------------------------------------------------------

@pytest.mark.parametrize("hh,mm,expected", [
    (3, 0, "premarket"), (8, 45, "premarket"), (9, 29, "premarket"),
    (9, 30, "regular"), (15, 59, "regular"), (16, 0, "afterhours"), (20, 0, "afterhours"),
])
def test_detect_session(hh, mm, expected):
    assert market.detect_session(et(TUE, hh, mm)) == expected


def test_closed_on_weekends_and_holidays():
    assert market.detect_session(et(date(2026, 10, 3), 8)) == "closed"      # Saturday
    assert market.detect_session(et(date(2026, 11, 26), 8)) == "closed"     # Thanksgiving


def test_trading_day_math():
    assert market.next_trading_day(date(2026, 10, 2)) == date(2026, 10, 5)    # Fri -> Mon
    assert market.next_trading_day(date(2026, 11, 25)) == date(2026, 11, 27)  # skips Thanksgiving
    assert market.previous_trading_day(date(2026, 9, 8)) == date(2026, 9, 4)  # skips Labor Day
    assert market.trade_date_for("afterhours", date(2026, 10, 2)) == date(2026, 10, 5)
    assert market.trade_date_for("premarket", TUE) == TUE


def test_pacific_helpers_handle_dst():
    summer = market.parse_pt("2026-09-29 05:45")
    winter = market.parse_pt("2026-12-01 05:45")
    assert summer.astimezone(market.ET).hour == 8 and winter.astimezone(market.ET).hour == 8
    assert summer.astimezone(timezone.utc).hour == 12 and winter.astimezone(timezone.utc).hour == 13
    assert market.in_pt_window(summer, "05:25-06:20")
    assert not market.in_pt_window(summer + timedelta(hours=1), "05:25-06:20")
    assert market.fmt_pt(summer) == "Tue Sep 29, 5:45 AM PT"


# --- metrics -------------------------------------------------------------------

def _history(days=10):
    bars, d = [], TUE
    for _ in range(days):
        d = market.previous_trading_day(d)
        bars += day_bars(d, price=4.0, pre_vol=200, rth_vol=10_000, post_vol=100, close=4.0)
    return bars


def test_premarket_gap_and_time_of_day_rvol():
    today = [Bar(et(TUE, 4) + timedelta(minutes=5 * i), 5.0, 5.1, 4.9, 5.0, 2_000) for i in range(57)]
    m = compute(_history() + today, "premarket", et(TUE, 8, 45), lookback_days=10)
    assert m.ref_close == 4.0
    assert m.gap_pct == pytest.approx(25.0)
    assert m.session_volume == 57 * 2_000
    # normal = 57 bars x 200 = 11,400 by 8:45; floor = 0.5% of ADV (~791k) ~ 3,955
    assert m.expected_volume == pytest.approx(57 * 200)
    assert m.rvol == pytest.approx(10.0)
    assert m.days_used == 10


def test_quiet_history_uses_volume_floor():
    history = []
    d = TUE
    for _ in range(10):
        d = market.previous_trading_day(d)
        history += day_bars(d, pre_vol=0, rth_vol=10_000, post_vol=0)
    today = [Bar(et(TUE, 8), 5.5, 5.5, 5.5, 5.5, 50_000)]
    m = compute(history + today, "premarket", et(TUE, 8, 30), lookback_days=10)
    adv = 78 * 10_000
    assert m.expected_volume == 0
    assert m.rvol == pytest.approx(50_000 / (adv * 0.005))


def test_afterhours_uses_todays_close():
    regular_day = [b for b in day_bars(TUE, price=6.0, close=6.0) if b.start < et(TUE, 16)]
    bars = _history() + regular_day + [Bar(et(TUE, 16, 30), 6.0, 7.5, 6.0, 7.2, 90_000)]
    m = compute(bars, "afterhours", et(TUE, 20), lookback_days=10)
    assert m.ref_close == 6.0
    assert m.gap_pct == pytest.approx(20.0)


def test_no_trades_this_session_returns_none():
    assert compute(_history(), "premarket", et(TUE, 8, 45), 10) is None
