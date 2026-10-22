"""PAPER FACTS: true numbers from the owner's paper-trading bots, for bot_diary posts.

Reads the paper book's deck file (../paper-book/output/deck.json), which it rewrites every few minutes. Only a
fresh, live file counts: a demo file is invented, and a stale one isn't today's news. Only plain facts are kept:
how many bots, how long they've run, the fake money they're up or down, the best and the worst, the ones that
haven't traded, a green week if any, and the market weather. Never a coin, token or stock picked by a bot, and
never a price: these posts are jokes about the experiment, not about what to buy.

Paper money only. The desks this reads can't place a real order, and the posts say the money is fake.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Optional

DECK = Path(__file__).resolve().parent.parent.parent / "paper-book" / "output" / "deck.json"
FRESH = timedelta(hours=36)


def _usd(v: float) -> str:
    return ("up " if v >= 0 else "down ") + f"${abs(v):,.2f}"


def load(now: datetime, path: Optional[Path] = None) -> Optional[dict]:
    """The deck file when it's live and fresh, else None."""
    path = path or DECK
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        meta = data["meta"]
        updated = datetime.fromisoformat(meta["updated"])
    except (OSError, ValueError, KeyError, TypeError):
        return None
    if meta.get("demo") or not data.get("desks"):
        return None
    if updated.tzinfo is None:
        updated = updated.replace(tzinfo=timezone.utc)
    if not timedelta(0) - timedelta(hours=1) <= now - updated <= FRESH:
        return None
    return data


def facts(now: datetime, path: Optional[Path] = None) -> List[str]:
    """Today's true facts, in plain sentences. Empty when there's no fresh live paper book."""
    data = load(now, path)
    if not data:
        return []
    meta, desks = data["meta"], data["desks"]
    out = []
    n = len(desks)
    banks = {round(float(d.get("bank") or 0)) for d in desks}
    each = f" each started on ${banks.pop():,} of fake money" if len(banks) == 1 else " each on its own fake money"
    day_one = meta.get("day_one")
    if day_one:
        days = (now - datetime.fromtimestamp(int(day_one), timezone.utc)).days + 1
        out.append(f"{n} paper-trading bots,{each}; the oldest has run for {days} day{'s' if days != 1 else ''}")
    else:
        out.append(f"{n} paper-trading bots,{each}; none has made a trade yet")
    total = float(meta.get("net", 0)) + float(meta.get("open", 0))
    bank = float(meta.get("bank") or 0)
    if bank:
        out.append(f"all of them together: {_usd(total)} of fake money ({total / bank * 100:+.1f}%) "
                   f"over {int(meta.get('trades', 0)):,} paper trades")
    traded = [d for d in desks if d.get("trades")]
    if traded:
        def ret(d):
            return (float(d.get("net", 0)) + float((d.get("open") or {}).get("value", 0))) / float(d.get("bank") or 1)
        best, worst = max(traded, key=ret), min(traded, key=ret)
        out.append(f"best bot so far: '{best['label']}', {ret(best) * 100:+.1f}% of its fake money "
                   f"in {best['trades']} trades")
        if worst is not best:
            out.append(f"worst bot so far: '{worst['label']}', {ret(worst) * 100:+.1f}% in {worst['trades']} trades")
    idle = n - len(traded)
    if idle:
        out.append(f"{idle} of the {n} bots haven't made a single trade yet (their rules say wait)")
    green = [d["label"] for d in desks if (d.get("week") or {}).get("green_week")]
    out.append("bots with a green week (3+ trading days in 7, net up, no day wiping out the week): "
               + (", ".join(f"'{g}'" for g in green[:3]) if green else "none yet"))
    w = meta.get("weather") or {}
    for t in w.get("trends") or []:
        if t.get("symbol") == "BTC":
            out.append("Bitcoin is " + ("above" if t.get("above") else "below") + " its 150-day average, so the "
                       "trend-following bots are " + ("allowed to hold it" if t.get("above") else
                                                      "sitting in cash on purpose"))
    mood = w.get("mood")
    if mood and isinstance(mood.get("value"), int):
        out.append(f"the crypto fear & greed index reads {mood['value']} ({str(mood.get('label', '')).lower()})")
    return out
