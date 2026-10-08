"""Loads criteria.toml and .env (no extra dependencies)."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List

try:
    import tomllib
except ModuleNotFoundError:  # Python < 3.11
    import tomli as tomllib  # type: ignore[no-redef]

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "output"
CACHE = ROOT / ".cache"


@dataclass
class Criteria:
    min_price: float = 2.0
    max_price: float = 20.0
    min_gap_pct: float = 10.0
    min_rvol: float = 3.0
    max_float_shares: float = 20_000_000
    require_catalyst: bool = True
    min_session_volume: float = 50_000
    allow_unknown_float: bool = True
    max_spread_pct: float = 1.5
    allow_unknown_spread: bool = True
    exclude_halted: bool = True

    news_lookback_hours: float = 24
    lookback_days: int = 10
    max_candidates: int = 60
    sort_by: str = "gap"
    exclude_warrants_units: bool = True
    show_near_misses: bool = True

    target_pct: float = 10.0
    stop_pct: float = 5.0
    cost_pct: float = 0.5

    catalysts: Dict[str, List[str]] = field(default_factory=dict)
    warn_tags: List[str] = field(default_factory=list)

    def summary(self) -> str:
        parts = [
            f"${self.min_price:g}-${self.max_price:g}",
            f"gap >= +{self.min_gap_pct:g}%",
            f"RVOL >= {self.min_rvol:g}x",
            f"float <= {self.max_float_shares / 1e6:g}M",
            f"vol >= {self.min_session_volume / 1e3:g}k",
            f"spread <= {self.max_spread_pct:g}%",
        ]
        if self.exclude_halted:
            parts.append("not halted")
        if self.require_catalyst:
            parts.append("news catalyst")
        return " · ".join(parts)


def load_criteria(path: Path | None = None) -> Criteria:
    path = path or ROOT / "criteria.toml"
    with open(path, "rb") as fh:
        raw = tomllib.load(fh)
    flat: dict = {}
    for section in ("filters", "scan", "paper"):
        flat.update(raw.get(section, {}))
    cats = dict(raw.get("catalysts", {}))
    flat["warn_tags"] = list(cats.pop("warn_tags", []))
    flat["catalysts"] = {k: list(v) for k, v in cats.items()}
    known = set(Criteria.__dataclass_fields__)
    unknown = sorted(set(flat) - known)
    if unknown:
        raise ValueError(f"Unknown setting(s) in {path.name}: {', '.join(unknown)}")
    c = Criteria(**flat)
    if c.sort_by not in ("gap", "rvol", "volume"):
        raise ValueError("sort_by must be gap, rvol or volume")
    return c


def load_env(path: Path | None = None) -> None:
    """Minimal .env reader: KEY=value lines; real env vars win."""
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
            value = value.split(" #", 1)[0].strip()  # allow trailing comments
        os.environ.setdefault(key.strip(), value)
