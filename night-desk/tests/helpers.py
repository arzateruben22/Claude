from __future__ import annotations

from datetime import datetime, timedelta, timezone

from nightdesk.models import Coin, Safety

T0 = datetime(2026, 10, 7, 12, 0, tzinfo=timezone.utc)


def coin(**kw) -> Coin:
    """A coin that clears every default rule unless told otherwise."""
    base = dict(
        mint="MINT1", symbol="GOOD", name="Good Coin", pool="POOL1", dex="raydium",
        created_at=T0 - timedelta(minutes=45), price=0.0002, liquidity=40_000, mcap=200_000,
        volume_m5=6_000, volume_h1=60_000, volume_h24=90_000,
        buys_m5=70, sells_m5=40, buys_h1=700, sells_h1=400,
        change_m5=2.0, change_h1=60.0, socials=["website", "twitter"],
    )
    base.update(kw)
    return Coin(**base)


def safety(**kw) -> Safety:
    base = dict(mint_revoked=True, freeze_revoked=True, top_wallet_pct=3.0, top10_pct=20.0, dev_pct=1.0,
                lp_locked_pct=100.0, holders=900)
    base.update(kw)
    return Safety(**base)


class FakeHttp:
    """Routes GETs by URL substring; records calls."""

    def __init__(self, routes):
        self.routes, self.calls = routes, []

    def get(self, url, params=None):
        self.calls.append((url, dict(params or {})))
        for key, fn in self.routes.items():
            if key in url:
                return fn(url, params or {})
        raise AssertionError(f"unexpected URL {url}")
