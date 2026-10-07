from datetime import timedelta

import pytest

from nightdesk import config, rules
from nightdesk.models import Review
from nightdesk.paper import PaperBroker, impact

from helpers import T0, coin, safety

CFG = config.load()


def review(c=None, s=None):
    r = Review(c or coin(), first_seen=T0)
    r.safety = s if s is not None else safety()
    return r


# --- the rulebook --------------------------------------------------------------

def test_shipped_rulebook_loads_and_rejects_typos(tmp_path):
    assert CFG.kill.max_top_wallet_pct == 5 and CFG.judge.model == "claude-opus-5-5"
    bad = tmp_path / "desk.toml"
    bad.write_text("[kill]\nmax_top_walet_pct = 5\n")
    with pytest.raises(ValueError, match="max_top_walet_pct"):
        config.load(bad)


def test_clean_coin_is_a_candidate():
    r = review()
    assert rules.evaluate(r, T0, CFG, ticket=100) == "candidate"
    assert all(c.ok for c in r.checks) and r.note == "clears every rule"


@pytest.mark.parametrize("s,needle", [
    (dict(mint_revoked=False), "mint authority revoked NO"),
    (dict(freeze_revoked=False), "freeze authority revoked NO"),
    (dict(top_wallet_pct=22.0), "top wallet 22.0%"),
    (dict(top10_pct=50.0), "top 10 wallets 50.0%"),
    (dict(dev_pct=12.0), "dev still holding 12.0%"),
    (dict(lp_locked_pct=10.0), "pool locked or burned 10.0%"),
    (dict(danger=["Single holder ownership"]), "no danger flags Single holder ownership"),
    (dict(rugged=True), "not already rugged rugged"),
])
def test_each_rug_sign_stomps_the_coin(s, needle):
    r = review(s=safety(**s))
    assert rules.evaluate(r, T0, CFG, ticket=100) == "killed"
    assert r.note.startswith(needle)


@pytest.mark.parametrize("c,needle", [
    (dict(created_at=T0 - timedelta(minutes=5)), "waiting: age 5m"),
    (dict(liquidity=5_000), "waiting: pool size $5.0K"),
    (dict(volume_h1=2_000, volume_m5=200), "waiting: volume, last hour"),
    (dict(mcap=20_000), "waiting: market cap"),
    (dict(buys_h1=50, sells_h1=40), "waiting: trades, last hour 90"),
])
def test_not_ready_coins_wait(c, needle):
    r = review(coin(**c))
    assert rules.evaluate(r, T0, CFG, ticket=100) == "waiting"
    assert r.note.startswith(needle)


def test_unknown_authority_waits_instead_of_dying():
    r = review(s=safety(mint_revoked=None))
    assert rules.evaluate(r, T0, CFG, ticket=100) == "waiting"
    assert "mint authority reported" in r.note
    r = Review(coin(), first_seen=T0)          # no safety report at all yet
    assert rules.evaluate(r, T0, CFG, ticket=100) == "waiting" and "safety report" in r.note


def test_scan_scores():
    s = rules.scan_scores(coin(buys_h1=600, sells_h1=400, buys_m5=10, sells_m5=30, change_h1=150,
                               volume_m5=2_500, volume_h1=60_000, liquidity=20_000, socials=["twitter"]),
                          ticket=100, max_pct_of_liquidity=1.0)
    assert s["buy_pressure"] == 0.6 and s["buy_pressure_now"] == 0.25
    assert s["momentum_spent"] == 0.5 and s["heat"] == 0.5
    assert s["liquidity_fit"] == 1.0 and s["social"] == pytest.approx(1 / 3)


@pytest.mark.parametrize("c,needle", [
    (dict(buys_m5=10, sells_m5=40), "not yet: buy pressure, 5m"),
    (dict(change_h1=290.0), "not yet: move already spent"),
    (dict(volume_m5=500), "not yet: still trading now"),
    (dict(socials=[]), "not yet: socials"),
])
def test_scan_rules_make_coins_wait(c, needle):
    r = review(coin(**c))
    assert rules.evaluate(r, T0, CFG, ticket=100) == "waiting" and r.note.startswith(needle)


def test_old_coins_expire():
    r = review(coin(created_at=T0 - timedelta(hours=30)))
    assert rules.evaluate(r, T0, CFG, ticket=100) == "expired"


# --- paper money -----------------------------------------------------------------

def test_impact_is_capped():
    assert impact(100, 20_000) == pytest.approx(0.01)
    assert impact(1_000_000, 100) == 0.95 and impact(5, 0) == 0.95


def test_buy_sizes_by_bank_and_pool_and_charges_costs():
    b = PaperBroker(CFG, 1000)
    pos = b.buy(coin(liquidity=40_000, price=0.001), T0)
    assert pos.cost == 100                       # 10% of $1,000; 1% of the pool would allow $400
    net = 100 * 0.99
    expected_price = 0.001 * (1 + 2 * net / 40_000 + 0.01)
    assert pos.entry_price == pytest.approx(expected_price)
    assert pos.qty == pytest.approx(net / expected_price)
    assert b.cash == 900
    small = PaperBroker(CFG, 1000).buy(coin(liquidity=5_000), T0)
    assert small.cost == 50                      # capped at 1% of a $5K pool


def test_round_trip_at_flat_price_loses_the_costs():
    b = PaperBroker(CFG, 1000)
    b.buy(coin(), T0)
    t = b.sell("MINT1", T0 + timedelta(minutes=5), "test")
    assert -6 < t.pnl_pct < -3                   # 2 fees + 2 slippages + impact
    assert b.cash == pytest.approx(900 + t.proceeds)


def _held(price_path, liquidity=40_000, minutes=1):
    b = PaperBroker(CFG, 1000)
    b.buy(coin(price=1.0), T0)
    now = T0
    for p in price_path:
        now += timedelta(minutes=minutes)
        b.mark(coin(price=p, liquidity=liquidity))
    return b, b.exit_reason(b.positions["MINT1"], now)


def test_exit_rules():
    assert _held([1.0, 0.75])[1] == "stop"
    assert _held([1.2, 1.5])[1] == "target"
    assert _held([1.3, 1.08])[1] == "trailing stop"     # up 30%, then 17% off the peak
    assert _held([1.05], minutes=130)[1] == "time limit"
    assert _held([1.0], liquidity=10_000)[1] == "rug exit: pool drained"
    assert _held([1.1])[1] is None


def test_rug_exit_fills_terribly():
    b = PaperBroker(CFG, 1000)
    b.buy(coin(price=1.0, liquidity=40_000), T0)
    b.mark(coin(price=0.05, liquidity=300))
    t = b.sell("MINT1", T0 + timedelta(minutes=1), "rug exit")
    assert t.pnl_pct < -95


def test_buying_limits():
    b = PaperBroker(CFG, 1000)
    for i in range(3):
        b.buy(coin(mint=f"M{i}"), T0)
    assert b.can_buy("M9", T0) == (False, "3 positions already open")
    b.sell("M0", T0, "test")
    assert b.can_buy("M0", T0 + timedelta(minutes=10))[1] == "cooling down after a recent sell"
    assert b.can_buy("M0", T0 + timedelta(minutes=61))[0]


def test_daily_loss_limit_and_new_day():
    b = PaperBroker(CFG, 1000)
    b.roll_day(T0)
    b.cash = 840                                  # -16% on the day
    assert b.halted() and "daily loss limit" in b.can_buy("X", T0)[1]
    b.roll_day(T0 + timedelta(days=1))
    assert not b.halted()
