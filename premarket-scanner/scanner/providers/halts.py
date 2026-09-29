"""Trading halts from Nasdaq Trader's free RSS feed.

Covers Nasdaq-listed and other-exchange-listed stocks. One request per day:
  https://www.nasdaqtrader.com/rss.aspx?feed=tradehalts&haltdate=MMDDYYYY
Times in the feed are Eastern. HaltTime looks like "09:32:12 .540".
"""
from __future__ import annotations

import re
import xml.etree.ElementTree as ET_XML
from collections import defaultdict
from datetime import date, datetime
from typing import Dict, List, Optional, Sequence

from ..market import ET
from ..models import Halt
from .base import Http

FEED = "https://www.nasdaqtrader.com/rss.aspx"

# The common codes. Anything else is shown as the raw code.
CODES = {
    "T1": "news pending", "T2": "news released", "T3": "news and resumption times",
    "T5": "single-stock pause", "T6": "extraordinary market activity", "T8": "ETF halt",
    "T12": "info requested by Nasdaq", "H4": "non-compliance", "H9": "not current in filings",
    "H10": "SEC trading suspension", "H11": "regulatory concern", "O1": "operations halt",
    "LUDP": "volatility pause", "LUDS": "volatility pause", "M": "volatility pause",
    "MWC1": "market-wide circuit breaker", "MWC2": "market-wide circuit breaker",
    "MWC3": "market-wide circuit breaker", "IPO1": "IPO not yet trading", "D": "delisted",
}
# Pauses that just mean "moved fast". Everything else is a real halt.
VOLATILITY = {"LUDP", "LUDS", "M"}

_TIME = re.compile(r"(\d{1,2}):(\d{2}):(\d{2})")


def describe(code: str) -> str:
    return f"{CODES.get(code, 'halt')} ({code})"


def _when(day: str, clock: str) -> Optional[datetime]:
    m = _TIME.search(clock or "")
    if not day or not m:
        return None
    d = datetime.strptime(day.strip(), "%m/%d/%Y").date()
    return datetime(d.year, d.month, d.day, *map(int, m.groups()), tzinfo=ET)


def parse(xml_text: str) -> List[Halt]:
    root = ET_XML.fromstring(xml_text)
    halts = []
    for item in root.iter("item"):
        f = {child.tag.split("}")[-1]: (child.text or "").strip() for child in item}
        symbol, halted_at = f.get("IssueSymbol"), _when(f.get("HaltDate", ""), f.get("HaltTime", ""))
        if not symbol or halted_at is None:
            continue
        resumed_at = _when(f.get("ResumptionDate") or f.get("HaltDate", ""), f.get("ResumptionTradeTime", ""))
        halts.append(Halt(symbol, f.get("ReasonCode", "").upper(), halted_at, resumed_at))
    return halts


def fetch(days: Sequence[date], http: Optional[Http] = None) -> Dict[str, List[Halt]]:
    # Nasdaq's site turns away bare script user agents.
    http = http or Http({"User-Agent": "Mozilla/5.0 (compatible; premarket-scanner/1.0)"})
    out: Dict[str, List[Halt]] = defaultdict(list)
    for d in days:
        for h in parse(http.get_text(FEED, {"feed": "tradehalts", "haltdate": d.strftime("%m%d%Y")})):
            out[h.symbol].append(h)
    return dict(out)
