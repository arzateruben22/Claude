"""The rulebook applied to one coin: kill checks (VET), readiness, scan scores.

Every rule produces a Check row, so the dashboard can show the whole sheet
for whichever coin is on the desk, the way thresholds.py does in the video.
"""
from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Optional

from .config import Config, KillCfg, ReadyCfg, ScanCfg
from .models import Check, Coin, Review, Safety

SOCIAL_KINDS = ("website", "twitter", "telegram")


def _money(x: float) -> str:
    for size, suffix in ((1e9, "B"), (1e6, "M"), (1e3, "K")):
        if abs(x) >= size:
            return f"${x / size:.1f}{suffix}"
    return f"${x:,.0f}"


def _pct(x: Optional[float]) -> str:
    return "?" if x is None else f"{x:.1f}%"


def kill_checks(s: Safety, cfg: KillCfg) -> List[Check]:
    """Rug signs. Unknown concentration passes (can't prove it); unknown
    authorities are handled by readiness instead (the coin waits)."""
    rows = []

    def add(rule: str, value: str, limit: str, ok: bool) -> None:
        rows.append(Check(rule, "kill", value, limit, ok))

    add("not already rugged", "rugged" if s.rugged else "no", "no", not s.rugged)
    if cfg.require_mint_revoked and s.mint_revoked is not None:
        add("mint authority revoked", "yes" if s.mint_revoked else "NO", "yes", s.mint_revoked)
    if cfg.require_freeze_revoked and s.freeze_revoked is not None:
        add("freeze authority revoked", "yes" if s.freeze_revoked else "NO", "yes", s.freeze_revoked)
    add("top wallet", _pct(s.top_wallet_pct), f"≤ {cfg.max_top_wallet_pct:g}%",
        s.top_wallet_pct is None or s.top_wallet_pct <= cfg.max_top_wallet_pct)
    add("top 10 wallets", _pct(s.top10_pct), f"≤ {cfg.max_top10_pct:g}%",
        s.top10_pct is None or s.top10_pct <= cfg.max_top10_pct)
    add("dev still holding", _pct(s.dev_pct), f"≤ {cfg.max_dev_pct:g}%",
        s.dev_pct is None or s.dev_pct <= cfg.max_dev_pct)
    if s.lp_locked_pct is not None:
        add("pool locked or burned", _pct(s.lp_locked_pct), f"≥ {cfg.min_lp_locked_pct:g}%",
            s.lp_locked_pct >= cfg.min_lp_locked_pct)
    if cfg.kill_on_danger_flags:
        add("no danger flags", ", ".join(s.danger[:2]) or "none", "none", not s.danger)
    return rows


def ready_checks(c: Coin, s: Optional[Safety], now: datetime, cfg: ReadyCfg, kill: KillCfg) -> List[Check]:
    """Not-yet rules: a coin that fails one keeps waiting on the watchlist."""
    rows = []

    def add(rule: str, value: str, limit: str, ok: bool) -> None:
        rows.append(Check(rule, "ready", value, limit, ok))

    age = c.age_minutes(now)
    add("age", f"{age:.0f}m", f"≥ {cfg.min_age_minutes:g}m", age >= cfg.min_age_minutes)
    add("pool size", _money(c.liquidity), f"≥ {_money(cfg.min_liquidity_usd)}", c.liquidity >= cfg.min_liquidity_usd)
    add("volume, last hour", _money(c.volume_h1), f"≥ {_money(cfg.min_volume_h1_usd)}",
        c.volume_h1 >= cfg.min_volume_h1_usd)
    add("market cap", _money(c.mcap), f"{_money(cfg.min_mcap_usd)}–{_money(cfg.max_mcap_usd)}",
        cfg.min_mcap_usd <= c.mcap <= cfg.max_mcap_usd)
    add("trades, last hour", f"{c.trades_h1:,}", f"≥ {cfg.min_trades_h1:,}", c.trades_h1 >= cfg.min_trades_h1)
    add("safety report", "in" if s else "waiting", "in", s is not None)
    if s is not None:
        if kill.require_mint_revoked and s.mint_revoked is None:
            add("mint authority reported", "not yet", "reported", False)
        if kill.require_freeze_revoked and s.freeze_revoked is None:
            add("freeze authority reported", "not yet", "reported", False)
    return rows


def scan_scores(c: Coin, ticket: float, max_pct_of_liquidity: float) -> Dict[str, float]:
    trades = c.buys_h1 + c.sells_h1
    trades_now = c.buys_m5 + c.sells_m5
    pool_room = c.liquidity * max_pct_of_liquidity / 100
    return {
        "buy_pressure": c.buys_h1 / trades if trades else 0.0,
        "buy_pressure_now": c.buys_m5 / trades_now if trades_now else 0.0,
        "momentum_spent": min(1.0, max(0.0, c.change_h1 / 300)),
        "heat": min(1.0, c.volume_m5 * 12 / c.volume_h1) if c.volume_h1 > 0 else 0.0,
        "liquidity_fit": min(1.0, pool_room / ticket) if ticket > 0 else 0.0,
        "social": len(set(c.socials) & set(SOCIAL_KINDS)) / len(SOCIAL_KINDS),
    }


SCAN_LABELS = {
    "buy_pressure": "buy pressure, 1h",
    "buy_pressure_now": "buy pressure, 5m",
    "momentum_spent": "move already spent",
    "heat": "still trading now",
    "liquidity_fit": "pool fits ticket",
    "social": "socials",
}


def scan_checks(scores: Dict[str, float], cfg: ScanCfg) -> List[Check]:
    limits = {
        "buy_pressure": (">=", cfg.min_buy_pressure),
        "buy_pressure_now": (">=", cfg.min_buy_pressure_now),
        "momentum_spent": ("<=", cfg.max_momentum_spent),
        "heat": (">=", cfg.min_heat),
        "liquidity_fit": (">=", cfg.min_liquidity_fit),
        "social": (">=", cfg.min_social),
    }
    rows = []
    for key, (op, limit) in limits.items():
        v = scores[key]
        ok = v >= limit if op == ">=" else v <= limit
        rows.append(Check(SCAN_LABELS[key], "scan", f"{v:.2f}", f"{'≥' if op == '>=' else '≤'} {limit:.2f}", ok))
    return rows


def evaluate(r: Review, now: datetime, cfg: Config, ticket: float) -> str:
    """Re-run the rulebook on a review. Returns the outcome:
    killed | expired | waiting | candidate (fill r.checks / r.scores / r.note)."""
    c = r.coin
    if c.age_minutes(now) > cfg.ready.max_age_hours * 60:
        r.note = f"older than {cfg.ready.max_age_hours:g}h"
        return "expired"
    kills = kill_checks(r.safety, cfg.kill) if r.safety else []
    ready = ready_checks(c, r.safety, now, cfg.ready, cfg.kill)
    r.scores = scan_scores(c, ticket, cfg.size.max_pct_of_liquidity)
    scan = scan_checks(r.scores, cfg.scan)
    r.checks = kills + ready + scan
    for group, outcome, prefix in ((kills, "killed", ""), (ready, "waiting", "waiting: "), (scan, "waiting", "not yet: ")):
        failed = [x for x in group if not x.ok]
        if failed:
            f = failed[0]
            r.note = f"{prefix}{f.rule} {f.value} (needs {f.limit})"
            return outcome
    r.note = "clears every rule"
    return "candidate"
