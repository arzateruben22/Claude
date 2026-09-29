"""The rules: judge a candidate, tag its catalyst, rank the survivors."""
from __future__ import annotations

import re
from typing import Dict, List

from . import fmt
from .config import Criteria
from .models import Candidate, NewsItem

_WARRANT_NAME = re.compile(r"\b(warrants?|units?|rights?)\b", re.IGNORECASE)


def symbol_allowed(symbol: str, name: str, exclude_warrants_units: bool) -> bool:
    """Common stock only: letters, and no warrants/units/rights if asked."""
    if not symbol.isalpha():
        return False
    if exclude_warrants_units:
        if len(symbol) == 5 and symbol[-1] in "WUR":
            return False
        if _WARRANT_NAME.search(name or ""):
            return False
    return True


def tag_news(news: List[NewsItem], catalysts: Dict[str, List[str]]) -> List[str]:
    text = " ".join(n.headline for n in news).lower()
    return [
        tag
        for tag, words in catalysts.items()
        if any(re.search(rf"\b{re.escape(w.lower())}\b", text) for w in words)
    ]


def evaluate(c: Candidate, crit: Criteria) -> None:
    """Fill c.failures (empty = passes) and c.warnings."""
    m = c.metrics
    fails: List[str] = []
    if m.price < crit.min_price:
        fails.append(f"price {fmt.money(m.price)} < ${crit.min_price:g}")
    if m.price > crit.max_price:
        fails.append(f"price {fmt.money(m.price)} > ${crit.max_price:g}")
    if m.gap_pct < crit.min_gap_pct:
        fails.append(f"gap {fmt.pct(m.gap_pct)} < +{crit.min_gap_pct:g}%")
    if m.rvol < crit.min_rvol:
        fails.append(f"RVOL {m.rvol:.1f}x < {crit.min_rvol:g}x")
    if m.session_volume < crit.min_session_volume:
        fails.append(f"volume {fmt.shares(m.session_volume)} < {fmt.shares(crit.min_session_volume)}")
    if c.float_shares is None:
        if crit.allow_unknown_float:
            c.warnings.append("float unknown")
        else:
            fails.append("float unknown")
    elif c.float_shares > crit.max_float_shares:
        fails.append(f"float {fmt.shares(c.float_shares)} > {fmt.shares(crit.max_float_shares)}")
    if crit.require_catalyst and not c.news:
        fails.append("no news")
    for tag in c.tags:
        if tag in crit.warn_tags:
            c.warnings.append(f"{tag} headline")
    c.failures = fails


_SORT_KEYS = {
    "gap": lambda c: c.metrics.gap_pct,
    "rvol": lambda c: c.metrics.rvol,
    "volume": lambda c: c.metrics.session_volume,
}


def rank(cands: List[Candidate], sort_by: str) -> List[Candidate]:
    return sorted(cands, key=_SORT_KEYS[sort_by], reverse=True)
