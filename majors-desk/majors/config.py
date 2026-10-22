"""Loads majors.toml (or another rulebook, majors-<name>.toml) into typed settings."""
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
    candle_hours: int = 1        # decide on 1-hour candles, or on 4-hour (6, 12, 24...) candles built from them


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
    exit_below_trend: bool = False   # also sell when a candle closes below the trend average (a trend filter)
    candle_hours: int = 1        # copied from [desk] by load(); every window above is in hours, whatever the candle

    # The windows as candle counts: on 4-hour candles, trend_hours = 200 means 50 candles.
    @property
    def trend(self) -> int:
        return self.trend_hours // self.candle_hours

    @property
    def breakout(self) -> int:
        return self.breakout_hours // self.candle_hours

    @property
    def exit(self) -> int:
        return self.exit_hours // self.candle_hours

    @property
    def atr(self) -> int:
        return self.atr_hours // self.candle_hours

    def candles_needed(self) -> int:
        """History each decision looks at: twice the trend average (so it has settled), or a full breakout window."""
        return max(2 * self.trend, self.breakout + 1, self.exit + 1, self.atr + 1)

    def candle_word(self) -> str:
        return "hour" if self.candle_hours == 1 else f"{self.candle_hours}-hour candle"


@dataclass
class CostsCfg:
    fee_pct: float = 0.40
    slippage_pct: float = 0.05


@dataclass
class Config:
    desk: DeskCfg = field(default_factory=DeskCfg)
    rules: RulesCfg = field(default_factory=RulesCfg)
    costs: CostsCfg = field(default_factory=CostsCfg)


def book_paths(book: str = "main", output: Path | None = None) -> tuple[Path, Path]:
    """Each rulebook has its own settings file and results folder:
    main = majors.toml and output/; any other name = majors-<name>.toml and output/<name>/."""
    output = output or OUTPUT
    if book == "main":
        return ROOT / "majors.toml", output
    if not book.replace("-", "").isalnum() or not book.islower():
        raise ValueError(f"A rulebook name is lowercase letters, digits and dashes, not {book!r}")
    path = ROOT / f"majors-{book}.toml"
    if not path.exists() and (ROOT / "retired" / path.name).exists():
        path = ROOT / "retired" / path.name            # retired: never run by the server, still replayable by name
    if not path.exists():
        raise ValueError(f"No rulebook called {book!r}: {path.name} doesn't exist")
    return path, output / book


def load(path: Path | None = None) -> Config:
    path = path or ROOT / "majors.toml"
    with open(path, "rb") as fh:
        raw = tomllib.load(fh)
    cfg = Config()
    if "candle_hours" in raw.get("rules", {}):
        raise ValueError(f"[rules] candle_hours belongs under [desk] in {path.name}")
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
    h = cfg.desk.candle_hours
    if not isinstance(h, int) or h < 1 or 24 % h:
        raise ValueError("[desk] candle_hours must be 1, 2, 3, 4, 6, 8, 12 or 24")
    r.candle_hours = h
    for name in ("trend_hours", "breakout_hours", "exit_hours", "atr_hours"):
        if getattr(r, name) % h:
            raise ValueError(f"[rules] {name} must be a multiple of candle_hours ({h})")
    if r.candles_needed() > MAX_CANDLES:
        raise ValueError(f"[rules] needs {r.candles_needed()} {r.candle_word()}s of history; the most it reads is "
                         f"{MAX_CANDLES}. Keep trend_hours at {MAX_CANDLES // 2 * h} or less.")
    for name in ("trend_hours", "atr_hours", "max_positions"):
        if getattr(r, name) < 1:
            raise ValueError(f"[rules] {name} must be at least 1")
    for name in ("breakout_hours", "exit_hours"):      # 0 = not used: no breakout needed, no window-low exit
        if getattr(r, name) < 0:
            raise ValueError(f"[rules] {name} must be 0 (not used) or more")
    if not isinstance(r.exit_below_trend, bool):
        raise ValueError("[rules] exit_below_trend must be true or false")
    if not 0 < r.risk_pct <= 5:
        raise ValueError("[rules] risk_pct must be between 0 and 5")
    if not 0 < r.max_position_pct <= 100:
        raise ValueError("[rules] max_position_pct must be between 0 and 100")
    if r.stop_atr <= 0:
        raise ValueError("[rules] stop_atr must be above 0")
    if c.fee_pct < 0 or c.slippage_pct < 0:
        raise ValueError("[costs] can't be negative")
