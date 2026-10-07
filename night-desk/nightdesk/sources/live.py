"""Real Solana data, all free and keyless:

  GeckoTerminal  /networks/solana/new_pools      discovery (30 requests/min)
  DexScreener    /tokens/v1/solana/{up to 30}    live price, pool, volume, trades (300/min)
  RugCheck       /v1/tokens/{mint}/report        authorities, holders, pool lock, risk flags
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Dict, List, Optional, Sequence, Tuple

from ..models import Coin, Safety
from .base import Http, Source, num, parse_ts

GECKO = "https://api.geckoterminal.com/api/v2"
DEXSCREENER = "https://api.dexscreener.com"
RUGCHECK = "https://api.rugcheck.xyz/v1"
QUOTE_SYMBOLS = {"SOL", "WSOL", "USDC", "USDT"}
SAFETY_TTL = timedelta(minutes=20)


def coins_from_gecko(payload: dict, now: datetime) -> List[Coin]:
    """GeckoTerminal JSON:API pools (with include=base_token,dex) -> Coins."""
    tokens = {i.get("id"): i.get("attributes", {}) for i in payload.get("included") or []}
    out = []
    for pool in payload.get("data") or []:
        a = pool.get("attributes") or {}
        rel = pool.get("relationships") or {}
        base_id = ((rel.get("base_token") or {}).get("data") or {}).get("id", "")
        mint = base_id.split("_", 1)[1] if "_" in base_id else ""
        tok = tokens.get(base_id, {})
        symbol = tok.get("symbol") or (a.get("name") or "?").split(" / ")[0]
        created = parse_ts(a.get("pool_created_at"))
        if not mint or not created or symbol.upper() in QUOTE_SYMBOLS:
            continue
        tx = a.get("transactions") or {}
        m5, h1 = tx.get("m5") or {}, tx.get("h1") or {}
        vol = a.get("volume_usd") or {}
        chg = a.get("price_change_percentage") or {}
        out.append(Coin(
            mint=mint, symbol=symbol, name=tok.get("name") or "", pool=a.get("address", ""),
            dex=((rel.get("dex") or {}).get("data") or {}).get("id", ""),
            created_at=created, price=num(a.get("base_token_price_usd")),
            liquidity=num(a.get("reserve_in_usd")),
            mcap=num(a.get("market_cap_usd")) or num(a.get("fdv_usd")),
            volume_m5=num(vol.get("m5")), volume_h1=num(vol.get("h1")), volume_h24=num(vol.get("h24")),
            buys_m5=int(num(m5.get("buys"))), sells_m5=int(num(m5.get("sells"))),
            buys_h1=int(num(h1.get("buys"))), sells_h1=int(num(h1.get("sells"))),
            change_m5=num(chg.get("m5")), change_h1=num(chg.get("h1")), seen_at=now,
        ))
    return out


def coin_from_dexscreener(pairs: List[dict], mint: str, now: datetime) -> Optional[Coin]:
    """Pick the token's deepest pool and turn it into a Coin."""
    mine = [p for p in pairs if (p.get("baseToken") or {}).get("address") == mint]
    if not mine:
        return None
    p = max(mine, key=lambda p: num((p.get("liquidity") or {}).get("usd")))
    base = p.get("baseToken") or {}
    tx = p.get("txns") or {}
    vol = p.get("volume") or {}
    chg = p.get("priceChange") or {}
    info = p.get("info") or {}
    socials = sorted({(s.get("type") or "").lower() for s in info.get("socials") or [] if s.get("type")})
    if info.get("websites"):
        socials.append("website")
    created = parse_ts(p.get("pairCreatedAt")) or now
    return Coin(
        mint=mint, symbol=base.get("symbol") or "?", name=base.get("name") or "", pool=p.get("pairAddress", ""),
        dex=p.get("dexId", ""), created_at=created, price=num(p.get("priceUsd")),
        liquidity=num((p.get("liquidity") or {}).get("usd")), mcap=num(p.get("marketCap")) or num(p.get("fdv")),
        volume_m5=num(vol.get("m5")), volume_h1=num(vol.get("h1")), volume_h24=num(vol.get("h24")),
        buys_m5=int(num((tx.get("m5") or {}).get("buys"))), sells_m5=int(num((tx.get("m5") or {}).get("sells"))),
        buys_h1=int(num((tx.get("h1") or {}).get("buys"))), sells_h1=int(num((tx.get("h1") or {}).get("sells"))),
        change_m5=num(chg.get("m5")), change_h1=num(chg.get("h1")), socials=socials, seen_at=now,
    )


def safety_from_rugcheck(rep: dict) -> Safety:
    """RugCheck full report -> Safety. Pool and locker accounts don't count as holders."""
    token = rep.get("token") or {}
    known = rep.get("knownAccounts") or {}

    def is_pool(addr: Optional[str]) -> bool:
        return bool(addr) and (known.get(addr) or {}).get("type") in ("AMM", "LOCKER")

    def authority(key: str) -> Optional[bool]:
        for src in (rep, token):
            if key in src:
                return not src[key]
        return None

    holders = [h for h in rep.get("topHolders") or [] if not (is_pool(h.get("owner")) or is_pool(h.get("address")))]
    pcts = sorted((num(h.get("pct")) for h in holders), reverse=True)
    creator = rep.get("creator")
    dev = None
    if creator:
        dev = sum(num(h.get("pct")) for h in holders if creator in (h.get("owner"), h.get("address")))
    # A coin still on pump.fun's bonding curve has no pool tokens to lock yet;
    # only real pools count toward "locked or burned".
    locks = [num((m.get("lp") or {}).get("lpLockedPct")) for m in rep.get("markets") or []
             if m.get("lp") and (m.get("marketType") or "") != "pump_fun"]
    risks = rep.get("risks") or []
    return Safety(
        mint_revoked=authority("mintAuthority"),
        freeze_revoked=authority("freezeAuthority"),
        top_wallet_pct=pcts[0] if pcts else None,
        top10_pct=sum(pcts[:10]) if pcts else None,
        dev_pct=dev,
        lp_locked_pct=max(locks) if locks else None,
        holders=int(rep["totalHolders"]) if rep.get("totalHolders") else None,
        danger=[r.get("name", "?") for r in risks if r.get("level") == "danger"],
        warnings=[r.get("name", "?") for r in risks if r.get("level") == "warn"],
        rugged=bool(rep.get("rugged")),
    )


class LiveSource(Source):
    name = "live"

    def __init__(self, gecko: Optional[Http] = None, dex: Optional[Http] = None, rug: Optional[Http] = None):
        self.gecko = gecko or Http(per_minute=25)
        self.dex = dex or Http(per_minute=240)
        self.rug = rug or Http(per_minute=30)
        self._safety: Dict[str, Tuple[datetime, Safety]] = {}

    def discover(self, now: datetime) -> List[Coin]:
        coins: List[Coin] = []
        for page in (1, 2):
            data = self.gecko.get(f"{GECKO}/networks/solana/new_pools", {"include": "base_token,dex", "page": page})
            coins += coins_from_gecko(data or {}, now)
        return coins

    def snapshot(self, mints: Sequence[str], now: datetime) -> Dict[str, Coin]:
        out: Dict[str, Coin] = {}
        mints = list(dict.fromkeys(mints))
        for i in range(0, len(mints), 30):
            chunk = mints[i : i + 30]
            data = self.dex.get(f"{DEXSCREENER}/tokens/v1/solana/{','.join(chunk)}") or []
            pairs = data.get("pairs") or [] if isinstance(data, dict) else data
            for mint in chunk:
                coin = coin_from_dexscreener(pairs, mint, now)
                if coin:
                    out[mint] = coin
        return out

    def safety(self, mint: str, now: datetime) -> Optional[Safety]:
        hit = self._safety.get(mint)
        if hit and now - hit[0] < SAFETY_TTL:
            return hit[1]
        rep = self.rug.get(f"{RUGCHECK}/tokens/{mint}/report")
        if not rep:
            return None
        s = safety_from_rugcheck(rep)
        self._safety[mint] = (now, s)
        return s
