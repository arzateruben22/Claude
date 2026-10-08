"""Loads majors.toml into typed settings."""
from __future__ import annotations

from dataclasses import dataclass, field, fields
from pathlib import Path
from typing import List

try:
    import tomllib
except ModuleNotFoundError:  # Python 3.10
    import tomli as tomllib  # type: ignore[no-redef]

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "output"
MAX_CANDLES = 300          # Coinbase returns at most 300 candles per request


@dataclass
class DeskCfg:
    start_bank: float = 1000.0
    coins: List[str] = field(default_factory=lambda: ["BTC", "ETH", "SOL", "XRP", "ADA", "DOGE"])
    quote: str = "USD"


@dataclass
class RulesCfg:
    trend_hours: int = 100
    breakout_hours: int = 48
    exit_hours: int = 24
    atr_hours: int = 14
    stop_atr: float = 3.0
    risk_pct: float = 1.0
    max_position_pct: float = 25.0
    max_positions: int = 4
    cooldown_hours: float = 6

    def candles_needed(self) -> int:
        """History each decision looks at: twice the trend average (so it has settled), or a full breakout window."""
        return max(2 * self.trend_hours, self.breakout_hours + 1, self.exit_hours + 1, self.atr_hours + 1)


@dataclass
class CostsCfg:
    fee_pct: float = 0.40
    slippage_pct: float = 0.05


@dataclass
class Config:
    desk: DeskCfg = field(default_factory=DeskCfg)
    rules: RulesCfg = field(default_factory=RulesCfg)
    costs: CostsCfg = field(default_factory=CostsCfg)


def load(path: Path | None = None) -> Config:
    path = path or ROOT / "majors.toml"
    with open(path, "rb") as fh:
        raw = tomllib.load(fh)
    cfg = Config()
    for section in fields(Config):
        values = raw.pop(section.name, {})
        target = getattr(cfg, section.name)
        unknown = sorted(set(values) - {f.name for f in fields(target)})
        if unknown:
            raise ValueError(f"Unknown setting(s) in [{section.name}] of {path.name}: {', '.join(unknown)}")
        for key, value in values.items():
            setattr(target, key, value)
    if raw:
        raise ValueError(f"Unknown section(s) in {path.name}: {', '.join(sorted(raw))}")
    validate(cfg)
    return cfg


def validate(cfg: Config) -> None:
    r, c = cfg.rules, cfg.costs
    cfg.desk.coins = [x.strip().upper() for x in cfg.desk.coins if x.strip()]
    if not cfg.desk.coins:
        raise ValueError("[desk] coins is empty")
    if cfg.desk.start_bank <= 0:
        raise ValueError("[desk] start_bank must be above 0")
    if r.candles_needed() > MAX_CANDLES:
        raise ValueError(f"[rules] needs {r.candles_needed()} hours of history; the most one request returns is "
                         f"{MAX_CANDLES}. Keep trend_hours at {MAX_CANDLES // 2} or less.")
    for name in ("trend_hours", "breakout_hours", "exit_hours", "atr_hours", "max_positions"):
        if getattr(r, name) < 1:
            raise ValueError(f"[rules] {name} must be at least 1")
    if not 0 < r.risk_pct <= 5:
        raise ValueError("[rules] risk_pct must be between 0 and 5")
    if not 0 < r.max_position_pct <= 100:
        raise ValueError("[rules] max_position_pct must be between 0 and 100")
    if r.stop_atr <= 0:
        raise ValueError("[rules] stop_atr must be above 0")
    if c.fee_pct < 0 or c.slippage_pct < 0:
        raise ValueError("[costs] can't be negative")
