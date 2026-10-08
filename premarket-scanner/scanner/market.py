"""Market clock: sessions, trading days, time zones.

All market logic runs in New York time; display uses Pacific time.
"""
from __future__ import annotations

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

ET = ZoneInfo("America/New_York")
PT = ZoneInfo("America/Los_Angeles")

PRE_OPEN = time(4, 0)
RTH_OPEN = time(9, 30)
RTH_CLOSE = time(16, 0)
POST_CLOSE = time(20, 0)

# Full-day NYSE/Nasdaq closures. Extend each December from the exchange's
# published calendar. (Early 1pm closes are not modelled.)
HOLIDAYS = {
    date(2025, 1, 1), date(2025, 1, 9), date(2025, 1, 20), date(2025, 2, 17),
    date(2025, 4, 18), date(2025, 5, 26), date(2025, 6, 19), date(2025, 7, 4),
    date(2025, 9, 1), date(2025, 11, 27), date(2025, 12, 25),
    date(2026, 1, 1), date(2026, 1, 19), date(2026, 2, 16), date(2026, 4, 3),
    date(2026, 5, 25), date(2026, 6, 19), date(2026, 7, 3), date(2026, 9, 7),
    date(2026, 11, 26), date(2026, 12, 25),
    date(2027, 1, 1), date(2027, 1, 18), date(2027, 2, 15), date(2027, 3, 26),
    date(2027, 5, 31), date(2027, 6, 18), date(2027, 7, 5), date(2027, 9, 6),
    date(2027, 11, 25), date(2027, 12, 24),
}

SESSIONS = ("premarket", "regular", "afterhours")


def is_trading_day(d: date) -> bool:
    return d.weekday() < 5 and d not in HOLIDAYS


def next_trading_day(d: date) -> date:
    d += timedelta(days=1)
    while not is_trading_day(d):
        d += timedelta(days=1)
    return d


def previous_trading_day(d: date) -> date:
    d -= timedelta(days=1)
    while not is_trading_day(d):
        d -= timedelta(days=1)
    return d


def detect_session(now: datetime) -> str:
    """premarket before 9:30 ET, regular until 4pm, afterhours from 4pm on.

    Returns "closed" on weekends and holidays.
    """
    local = now.astimezone(ET)
    if not is_trading_day(local.date()):
        return "closed"
    t = local.time()
    if t < RTH_OPEN:
        return "premarket"
    if t < RTH_CLOSE:
        return "regular"
    return "afterhours"


def session_window(session: str, d: date) -> tuple[datetime, datetime]:
    """Start/end of a session on day `d`, as ET-aware datetimes."""
    start, end = {
        "premarket": (PRE_OPEN, RTH_OPEN),
        "regular": (RTH_OPEN, RTH_CLOSE),
        "afterhours": (RTH_CLOSE, POST_CLOSE),
    }[session]
    return (datetime.combine(d, start, tzinfo=ET), datetime.combine(d, end, tzinfo=ET))


def trade_date_for(session: str, d: date) -> date:
    """The day you'd actually trade a pick: evening picks trade tomorrow."""
    return next_trading_day(d) if session == "afterhours" else d


def parse_pt(text: str) -> datetime:
    """'2026-09-29 05:45' (Pacific) -> aware datetime."""
    return datetime.strptime(text, "%Y-%m-%d %H:%M").replace(tzinfo=PT)


def in_pt_window(now: datetime, window: str) -> bool:
    """window like '05:25-06:20' in Pacific time."""
    lo, hi = (datetime.strptime(x.strip(), "%H:%M").time() for x in window.split("-"))
    t = now.astimezone(PT).time()
    return lo <= t <= hi


def fmt_pt(dt: datetime) -> str:
    p = dt.astimezone(PT)  # built by hand: %-d / %-I don't exist on Windows
    return f"{p:%a %b} {p.day}, {p.hour % 12 or 12}:{p:%M} {p:%p} PT"
