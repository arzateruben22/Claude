import json
from collections import Counter
from datetime import timedelta

import pytest

from nightdesk import config
from nightdesk.desk import Desk
from nightdesk.judge import RulesJudge
from nightdesk.paper import impact
from nightdesk.sources import live
from nightdesk.sources.sim import SimMarket

from helpers import T0, FakeHttp

CFG = config.load()


def run(hours=4, seed=7, out_dir=None):
    market = SimMarket(T0, seed=seed)
    desk = Desk(CFG, market, RulesJudge(CFG.judge), T0, out_dir)
    bought_at = []
    orig_buy = desk.broker.buy

    def spy(coin, now, reason=""):
        pos = orig_buy(coin, now, reason)
        if pos:
            bought_at.append((pos.cost, coin.liquidity))
        return pos

    desk.broker.buy = spy
    now = T0
    while now < T0 + timedelta(hours=hours):
        desk.step(now)
        now += timedelta(seconds=5)
    return desk, market, bought_at, now


@pytest.fixture(scope="module")
def night():
    return run()


# --- the whole desk on the demo market -------------------------------------------

def test_desk_finds_kills_and_trades(night):
    desk, market, bought, _ = night
    c = desk.counts
    assert c["seen"] > 150 and c["killed"] > 50 and c["bought"] >= 3
    killed = Counter(market.fate(k["mint"]) for k in desk.kills)
    assert killed["scam"] >= max(killed.values()) * 0.5     # the kill list mostly catches scams


def test_books_balance(night):
    desk, _, _, _ = night
    b = desk.broker
    assert b.equity() == pytest.approx(b.cash + sum(b.position_value(p) for p in b.positions.values()))
    closed = sum(t.pnl for t in b.trades)
    open_cost = sum(p.cost for p in b.positions.values())
    assert b.cash == pytest.approx(CFG.desk.start_bank + closed - open_cost)


def test_never_more_than_one_percent_of_a_pool(night):
    _, _, bought, _ = night
    assert bought and all(cost <= liq * CFG.size.max_pct_of_liquidity / 100 + 1e-6 for cost, liq in bought)


def test_same_seed_same_night():
    a, *_ = run(hours=2, seed=11)
    b, *_ = run(hours=2, seed=11)
    assert [(t.symbol, round(t.pnl, 6)) for t in a.broker.trades] == [(t.symbol, round(t.pnl, 6)) for t in b.broker.trades]


def test_state_is_json_and_snapshots_dont_share_agents(night):
    desk, _, _, now = night
    first = desk.state(now)
    json.dumps(first)
    desk.say("chief", "something new", now)
    assert first["agents"]["chief"]["status"] != "something new"
    assert {"agents", "web", "focus", "equity", "trades", "kills", "verdicts"} <= set(first)


def test_files_and_resume(tmp_path):
    desk, _, _, now = run(hours=3, out_dir=tmp_path)
    desk.save()
    assert (tmp_path / "kills.csv").exists() and (tmp_path / "state.json").exists()
    again = Desk(CFG, SimMarket(T0), RulesJudge(CFG.judge), now, tmp_path)
    assert again.resume()
    assert again.broker.cash == pytest.approx(desk.broker.cash)
    assert set(again.broker.positions) == set(desk.broker.positions)
    assert len(again.broker.trades) == len(desk.broker.trades)


def test_sim_rugs_drain_the_pool():
    m = SimMarket(T0, seed=3)
    m._spawn_until(T0 + timedelta(hours=1))
    rug = next(c for c in m.coins.values() if c.fate == "rug")
    before = m.snapshot([rug.mint], rug.born + timedelta(minutes=rug.end_min - 1))[rug.mint]
    after = m.snapshot([rug.mint], rug.born + timedelta(minutes=rug.end_min + 1))[rug.mint]
    assert after.liquidity < before.liquidity * 0.1
    assert m.safety(rug.mint, rug.born + timedelta(minutes=rug.end_min + 1)).rugged


# --- live API parsing -------------------------------------------------------------

GECKO = {
    "data": [{
        "id": "solana_POOLA",
        "attributes": {
            "address": "POOLA", "name": "FROG / SOL", "pool_created_at": "2026-10-07T11:30:00Z",
            "base_token_price_usd": "0.000123", "reserve_in_usd": "25000.5", "fdv_usd": "150000",
            "market_cap_usd": None, "volume_usd": {"m5": "1200", "h1": "40000", "h24": "52000"},
            "transactions": {"m5": {"buys": 30, "sells": 12}, "h1": {"buys": 400, "sells": 250}},
            "price_change_percentage": {"m5": "1.5", "h1": "42.0"},
        },
        "relationships": {"base_token": {"data": {"id": "solana_FROGMINT"}},
                          "dex": {"data": {"id": "pumpswap"}}},
    }, {
        "id": "solana_POOLB",
        "attributes": {"address": "POOLB", "name": "SOL / USDC", "pool_created_at": "2026-10-07T11:00:00Z"},
        "relationships": {"base_token": {"data": {"id": "solana_So111"}}},
    }],
    "included": [{"id": "solana_FROGMINT", "attributes": {"symbol": "FROG", "name": "Frog Coin"}},
                 {"id": "solana_So111", "attributes": {"symbol": "SOL", "name": "Wrapped SOL"}}],
}


def test_gecko_new_pools_parse():
    coins = live.coins_from_gecko(GECKO, T0)
    assert len(coins) == 1      # SOL/USDC skipped
    c = coins[0]
    assert (c.mint, c.symbol, c.dex, c.pool) == ("FROGMINT", "FROG", "pumpswap", "POOLA")
    assert c.liquidity == 25000.5 and c.mcap == 150000 and c.price == 0.000123
    assert (c.buys_h1, c.sells_h1, c.volume_h1, c.change_h1) == (400, 250, 40000, 42.0)
    assert c.age_minutes(T0) == 30


def _pair(mint, liq, price="0.001"):
    return {"pairAddress": f"P{liq}", "dexId": "raydium", "baseToken": {"address": mint, "symbol": "FROG", "name": "Frog"},
            "priceUsd": price, "liquidity": {"usd": liq}, "marketCap": 90000, "fdv": 100000,
            "volume": {"m5": 100, "h1": 20000, "h24": 30000},
            "txns": {"m5": {"buys": 5, "sells": 3}, "h1": {"buys": 200, "sells": 150}},
            "priceChange": {"m5": 1, "h1": 20}, "pairCreatedAt": 1791374400000,
            "info": {"socials": [{"type": "twitter", "url": "x"}], "websites": [{"url": "y"}]}}


def test_dexscreener_picks_the_deepest_pool_and_both_shapes():
    pairs = [_pair("FROGMINT", 5000), _pair("FROGMINT", 30000), _pair("OTHER", 99999)]
    c = live.coin_from_dexscreener(pairs, "FROGMINT", T0)
    assert c.liquidity == 30000 and c.mcap == 90000 and sorted(c.socials) == ["twitter", "website"]
    calls = []
    for shape in (pairs, {"pairs": pairs}):
        http = FakeHttp({"/tokens/v1/solana/": lambda url, p, s=shape: (calls.append(url), s)[1]})
        src = live.LiveSource(gecko=http, dex=http, rug=http)
        assert src.snapshot(["FROGMINT"], T0)["FROGMINT"].liquidity == 30000


def test_dexscreener_batches_thirty_at_a_time():
    http = FakeHttp({"/tokens/v1/solana/": lambda url, p: []})
    live.LiveSource(gecko=http, dex=http, rug=http).snapshot([f"M{i}" for i in range(65)], T0)
    assert [u.rsplit("/", 1)[1].count(",") + 1 for u, _ in http.calls] == [30, 30, 5]


REPORT = {
    "mintAuthority": None, "freezeAuthority": None, "creator": "DEV", "totalHolders": 812, "rugged": False,
    "token": {"supply": 1000000000},
    "knownAccounts": {"POOLVAULT": {"name": "Raydium", "type": "AMM"}},
    "topHolders": [
        {"address": "A1", "owner": "POOLVAULT", "pct": 61.2},
        {"address": "A2", "owner": "WHALE", "pct": 4.1},
        {"address": "A3", "owner": "DEV", "pct": 2.5},
        {"address": "A4", "owner": "W4", "pct": 1.0},
    ],
    "markets": [{"marketType": "pump_fun", "lp": {"lpLockedPct": 0}},
                {"marketType": "raydium", "lp": {"lpLockedPct": 100}}],
    "risks": [{"name": "Low Liquidity", "level": "warn"}, {"name": "Copycat token", "level": "danger"}],
}


def test_rugcheck_report_parse():
    s = live.safety_from_rugcheck(REPORT)
    assert s.mint_revoked and s.freeze_revoked
    assert s.top_wallet_pct == 4.1 and s.top10_pct == pytest.approx(7.6)   # pool vault excluded
    assert s.dev_pct == 2.5 and s.holders == 812 and s.lp_locked_pct == 100
    assert s.danger == ["Copycat token"] and s.warnings == ["Low Liquidity"]
    assert live.safety_from_rugcheck({**REPORT, "mintAuthority": "SOMEKEY"}).mint_revoked is False
    bonding = live.safety_from_rugcheck({**REPORT, "markets": [{"marketType": "pump_fun", "lp": {"lpLockedPct": 0}}]})
    assert bonding.lp_locked_pct is None     # no pool yet: not a failed lock
    assert live.safety_from_rugcheck({"topHolders": []}).mint_revoked is None


def test_safety_is_cached():
    http = FakeHttp({"/report": lambda url, p: REPORT})
    src = live.LiveSource(gecko=http, dex=http, rug=http)
    src.safety("FROGMINT", T0)
    src.safety("FROGMINT", T0 + timedelta(minutes=5))
    assert len(http.calls) == 1
    src.safety("FROGMINT", T0 + timedelta(minutes=30))
    assert len(http.calls) == 2


def test_impact_is_the_average_fill_of_a_constant_product_pool():
    # x*y=k pool holding $L in total ($L/2 per side), price P = y/x.
    L, d, P = 40_000, 200, 0.001
    y = L / 2
    x = y / P
    tokens_out = x - (x * y) / (y + d)          # what $d actually buys
    avg_price = d / tokens_out
    assert impact(d, L) == pytest.approx(avg_price / P - 1)


def test_held_coins_always_stay_on_the_web(night):
    desk, _, _, now = night
    for _ in range(3):        # open positions even if the night ended flat
        r = next((r for r in desk.reviews.values() if r.status == "watching" and r.coin.mint not in desk.broker.positions), None)
        if r and desk.broker.can_buy(r.coin.mint, now)[0]:
            desk.broker.buy(r.coin, now)
            r.status = "bought"
    held = set(desk.broker.positions)
    for r in desk.reviews.values():            # make every other coin look more recent
        if r.coin.mint not in held:
            r.updated = now + timedelta(minutes=5)
    web = {n["id"] for n in desk.state(now)["web"]}
    assert held and held <= web and len(web) <= 40
