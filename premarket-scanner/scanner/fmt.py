"""Number formatting shared by rules and reports."""
from __future__ import annotations

from typing import Optional


def shares(n: Optional[float]) -> str:
    if n is None:
        return "?"
    for size, suffix in ((1e9, "B"), (1e6, "M"), (1e3, "k")):
        if abs(n) >= size:
            return f"{n / size:.1f}{suffix}"
    return f"{n:.0f}"


def pct(x: float) -> str:
    return f"{x:+.1f}%"


def money(x: float) -> str:
    return f"${x:,.2f}"
