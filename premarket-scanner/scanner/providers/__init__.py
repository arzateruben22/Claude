"""Pick a data provider from the command line or .env."""
from __future__ import annotations

import os
from typing import Optional

from .base import Provider, ProviderError

NAMES = ("alpaca", "massive", "demo")


def make_provider(name: Optional[str] = None) -> Provider:
    name = (name or os.getenv("SCANNER_PROVIDER") or "").lower()
    if not name:
        if os.getenv("ALPACA_API_KEY"):
            name = "alpaca"
        elif os.getenv("MASSIVE_API_KEY") or os.getenv("POLYGON_API_KEY"):
            name = "massive"
        else:
            raise ProviderError(
                "No data provider configured. Copy .env.example to .env and add keys, "
                "or try it offline with:  python -m scanner scan --demo"
            )
    if name == "demo":
        from .demo import DemoProvider

        return DemoProvider()
    if name == "alpaca":
        from .alpaca import AlpacaProvider

        key, secret = os.getenv("ALPACA_API_KEY"), os.getenv("ALPACA_SECRET_KEY")
        if not (key and secret):
            raise ProviderError("Set ALPACA_API_KEY and ALPACA_SECRET_KEY in .env")
        paper = os.getenv("ALPACA_PAPER", "true").lower() != "false"
        return AlpacaProvider(key, secret, feed=os.getenv("ALPACA_FEED", "delayed_sip"), paper=paper)
    if name == "massive":
        from .massive import MassiveProvider

        key = os.getenv("MASSIVE_API_KEY") or os.getenv("POLYGON_API_KEY")
        if not key:
            raise ProviderError("Set MASSIVE_API_KEY in .env")
        return MassiveProvider(key, delay_minutes=int(os.getenv("MASSIVE_DELAY_MINUTES", "0")))
    raise ProviderError(f"Unknown provider '{name}'. Choose one of: {', '.join(NAMES)}")


__all__ = ["Provider", "ProviderError", "make_provider", "NAMES"]
