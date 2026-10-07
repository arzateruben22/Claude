"""Loads desk.toml into typed settings, and .env into the environment."""
from __future__ import annotations

import os
from dataclasses import dataclass, field, fields
from pathlib import Path

try:
    import tomllib
except ModuleNotFoundError:  # Python 3.10
    import tomli as tomllib  # type: ignore[no-redef]

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "output"


@dataclass
class DeskCfg:
    start_bank: float = 1000.0
    discover_seconds: float = 60
    poll_seconds: float = 15
    watch_minutes: float = 90


@dataclass
class KillCfg:
    max_top_wallet_pct: float = 5.0
    max_top10_pct: float = 35.0
    max_dev_pct: float = 5.0
    require_mint_revoked: bool = True
    require_freeze_revoked: bool = True
    min_lp_locked_pct: float = 90.0
    kill_on_danger_flags: bool = True


@dataclass
class ReadyCfg:
    min_age_minutes: float = 15
    max_age_hours: float = 24
    min_liquidity_usd: float = 12000
    min_volume_h1_usd: float = 15000
    min_mcap_usd: float = 60000
    max_mcap_usd: float = 5_000_000
    min_trades_h1: int = 150


@dataclass
class ScanCfg:
    min_buy_pressure: float = 0.55
    min_buy_pressure_now: float = 0.55
    max_momentum_spent: float = 0.60
    min_heat: float = 0.30
    min_liquidity_fit: float = 0.60
    min_social: float = 0.34


@dataclass
class JudgeCfg:
    use_ai: bool = True
    model: str = "claude-opus-5-5"
    effort: str = "low"
    min_confidence: float = 0.6


@dataclass
class SizeCfg:
    ticket_pct: float = 10.0
    max_pct_of_liquidity: float = 1.0
    max_open: int = 3
    fee_pct: float = 1.0
    slippage_pct: float = 1.0


@dataclass
class RiskCfg:
    take_profit_pct: float = 40.0
    stop_loss_pct: float = 20.0
    trail_arm_pct: float = 20.0
    trail_pct: float = 15.0
    max_hold_minutes: float = 120
    rug_liquidity_drop_pct: float = 50.0
    daily_loss_limit_pct: float = 15.0
    cooldown_minutes: float = 60


@dataclass
class Config:
    desk: DeskCfg = field(default_factory=DeskCfg)
    kill: KillCfg = field(default_factory=KillCfg)
    ready: ReadyCfg = field(default_factory=ReadyCfg)
    scan: ScanCfg = field(default_factory=ScanCfg)
    judge: JudgeCfg = field(default_factory=JudgeCfg)
    size: SizeCfg = field(default_factory=SizeCfg)
    risk: RiskCfg = field(default_factory=RiskCfg)


def load(path: Path | None = None) -> Config:
    path = path or ROOT / "desk.toml"
    with open(path, "rb") as fh:
        raw = tomllib.load(fh)
    cfg = Config()
    for section in fields(Config):
        values = raw.pop(section.name, {})
        target = getattr(cfg, section.name)
        known = {f.name for f in fields(target)}
        unknown = sorted(set(values) - known)
        if unknown:
            raise ValueError(f"Unknown setting(s) in [{section.name}] of {path.name}: {', '.join(unknown)}")
        for key, value in values.items():
            setattr(target, key, value)
    if raw:
        raise ValueError(f"Unknown section(s) in {path.name}: {', '.join(sorted(raw))}")
    if cfg.judge.effort not in ("low", "medium", "high", "xhigh", "max"):
        raise ValueError("[judge] effort must be low, medium, high, xhigh or max")
    return cfg


def load_env(path: Path | None = None) -> None:
    """KEY=value lines from .env; real environment variables win."""
    path = path or ROOT / ".env"
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        value = value.strip()
        if value[:1] in ("'", '"') and value[:1] in value[1:]:
            value = value[1 : value.index(value[0], 1)]
        else:
            value = value.split(" #", 1)[0].strip()
        os.environ.setdefault(key.strip(), value)
