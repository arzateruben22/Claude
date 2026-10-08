"""Majors Desk command line. Paper money only: nothing here can place a real order.

  python -m majors run                  paper trade live, one decision per coin every hour
  python -m majors status               the paper bank, open positions, latest trades
  python -m majors backtest --days 180  the same rules over real past prices, vs just holding
  python -m majors sim --days 30        a month of an invented market (for trying it out)
  python -m majors doctor               can it reach Coinbase's prices?
  python -m majors why                  why each coin is or isn't a buy right now
"""
from __future__ import annotations

import argparse
import csv
import signal
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

from . import config
from .config import OUTPUT
from . import rules
from .desk import Desk, replay, summary
from .market import HOUR, Coinbase, DemoMarket, MarketError, floor_hour


def _now() -> datetime:
    return datetime.now(timezone.utc)


def cmd_run(args) -> int:
    cfg = config.load()
    desk = Desk(cfg, Coinbase(cache_dir=OUTPUT / "cache"), OUTPUT / "live")
    if desk.resume():
        print(f"Resumed the paper bank: ${desk.value():,.2f}, {len(desk.positions)} open.")
    else:
        print(f"New paper bank: ${cfg.desk.start_bank:,.2f}.")
    print(f"Watching {', '.join(cfg.desk.coins)} on Coinbase prices, one decision per coin per finished hour. "
          "Ctrl+C to stop.")

    def stop(*_):
        raise KeyboardInterrupt

    signal.signal(signal.SIGTERM, stop)
    next_at = _now()
    try:
        while True:
            now = _now()
            if now >= next_at:
                before = len(desk.log)
                desk.step(now)
                for line in list(desk.log)[: len(desk.log) - before][::-1]:
                    print(line, flush=True)
                print(f"{now:%Y-%m-%d %H:%M} bank ${desk.value():,.2f} · {len(desk.positions)} open", flush=True)
                next_at = floor_hour(now) + HOUR + timedelta(seconds=90)   # just after the next hour closes
            time.sleep(20)
    except KeyboardInterrupt:
        desk.save()
        print("\nSaved. Open positions resume on the next run.")
    return 0


def _read(path: Path) -> list:
    if not path.exists():
        return []
    with open(path, newline="", encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


def cmd_status(args) -> int:
    import json

    folder = OUTPUT / ("demo" if args.demo else "live")
    state = folder / "state.json"
    if not state.exists():
        print(f"Nothing yet in {folder}. Start it with: python -m majors run")
        return 0
    data = json.loads(state.read_text())
    value = data["cash"] + sum(p["qty"] * p["last_price"] for p in data["positions"])
    start = data.get("start_bank", 1000.0)
    print(f"Paper bank ${value:,.2f} ({(value / start - 1) * 100:+.1f}% since ${start:,.0f}) · cash ${data['cash']:,.2f}")
    for p in data["positions"]:
        move = (p["last_price"] / p["entry_price"] - 1) * 100
        print(f"  holding {p['symbol']:<5} since {p['opened_at'][:16]} · {move:+.1f}% · ${p['qty'] * p['last_price']:,.2f}")
    trades = _read(folder / "trades.csv")
    if trades:
        net = sum(float(t["pnl"]) for t in trades)
        won = sum(float(t["pnl"]) > 0 for t in trades)
        print(f"{len(trades)} closed trades · won {won} · net ${net:+,.2f}")
        for t in trades[-8:][::-1]:
            print(f"  {t['closed'][:16]} {t['symbol']:<5} {float(t['pnl_pct']):+6.1f}%  ${float(t['pnl']):+8.2f}  {t['exit']}")
    for line in data.get("log", [])[:5]:
        print("  · " + line)
    return 0


def cmd_backtest(args) -> int:
    cfg = config.load()
    if args.coins:
        cfg.desk.coins = [c.strip().upper() for c in args.coins.split(",")]
    end = floor_hour(_now())
    start = end - timedelta(days=args.days)
    market = DemoMarket(args.seed) if args.demo else Coinbase(cache_dir=OUTPUT / "cache")
    label = f"{'demo-' if args.demo else ''}{start:%Y-%m-%d}_{end:%Y-%m-%d}"
    folder = OUTPUT / "backtests" / label
    (folder / "trades.csv").unlink(missing_ok=True)
    if not args.demo:
        print(f"Fetching {args.days:g} days of hourly prices from Coinbase (kept in {OUTPUT / 'cache'} for next time)...")
    try:
        result = replay(cfg, market, start, end, folder)
    except MarketError as exc:
        print(f"Couldn't get prices: {exc}")
        return 1
    text = summary(result["desk"], result["hold"], args.days, "Backtest (INVENTED demo prices)" if args.demo else "Backtest")
    folder.mkdir(parents=True, exist_ok=True)
    (folder / "summary.md").write_text(text + "\n")
    print(text)
    print(f"\nTrades: {folder / 'trades.csv'}")
    print("Past prices don't predict future ones. A backtest that loses is a reason to stop; one that wins is "
          "only a reason to keep paper trading.")
    return 0


def cmd_sim(args) -> int:
    cfg = config.load()
    folder = OUTPUT / "demo"
    for f in ("trades.csv", "state.json"):
        (folder / f).unlink(missing_ok=True)
    end = floor_hour(_now())
    result = replay(cfg, DemoMarket(args.seed), end - timedelta(days=args.days), end, folder, close_at_end=False)
    desk = result["desk"]
    desk.save()
    print(summary(desk, result["hold"], args.days, "Demo (INVENTED prices)"))
    print(f"\nPaper results in {folder}. Look: python -m majors status --demo")
    return 0


def cmd_doctor(args) -> int:
    cfg = config.load()
    cb = Coinbase()
    bad = 0
    for coin in cfg.desk.coins:
        try:
            cs = cb.recent(coin, cfg.desk.quote, _now(), 3)
            print(f"  ok   {coin}-{cfg.desk.quote}: ${cs[-1].c:,.6g} at {cs[-1].closed_at:%H:%M} UTC")
        except (MarketError, IndexError) as exc:
            bad += 1
            print(f"  FIX  {coin}-{cfg.desk.quote}: {exc or 'no candles'}")
    print("All good." if not bad else "Some coins have no prices: check the names in majors.toml and the internet.")
    return 1 if bad else 0


def cmd_why(args) -> int:
    """Each coin against the buy rule, in plain words: how far it is from a buy, and whether it's held."""
    cfg = config.load()
    r = cfg.rules
    market = DemoMarket(args.seed) if args.demo else Coinbase(cache_dir=OUTPUT / "cache")
    now = _now()
    held = set()
    state = OUTPUT / ("demo" if args.demo else "live") / "state.json"
    if state.exists():
        import json

        held = {p["symbol"] for p in json.loads(state.read_text()).get("positions", [])}
    print(f"A buy needs the last hour to close above its {r.trend_hours}h average (an uptrend) AND above the "
          f"highest price of the {r.breakout_hours} hours before it (a breakout).")
    for coin in cfg.desk.coins:
        try:
            cs = market.recent(coin, cfg.desk.quote, now, r.candles_needed() + 2)
        except MarketError as exc:
            print(f"  {coin:<5} can't get prices: {exc}")
            continue
        if coin in held:
            print(f"  {coin:<5} held now: it sells on its stop or when the trend ends")
            continue
        ok, why = rules.entry(cs, r)
        if len(cs) < r.candles_needed():
            print(f"  {coin:<5} {why}")
            continue
        last = cs[-1].c
        trend = rules.ema([c.c for c in cs], r.trend_hours)
        high = max(c.h for c in cs[-1 - r.breakout_hours:-1])
        trend_txt = f"{'above' if last > trend else 'below'} its {r.trend_hours}h average ({(last / trend - 1) * 100:+.1f}%)"
        need = (f"{(high / last - 1) * 100:+.1f}% short of its {r.breakout_hours}h high (${high:,.6g})" if last <= high
                else f"broke above its {r.breakout_hours}h high (${high:,.6g})")
        print(f"  {coin:<5} ${last:,.6g} · {trend_txt} · {need}"
              + (" · BUY SIGNAL (taken on the desk's next hourly check)" if ok else ""))
    return 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="python -m majors", description="Paper trading on the big coins.")
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("run", help="paper trade live (hourly decisions)")
    p.set_defaults(func=cmd_run)
    p = sub.add_parser("status", help="paper bank, open positions, latest trades")
    p.add_argument("--demo", action="store_true")
    p.set_defaults(func=cmd_status)
    p = sub.add_parser("backtest", help="the rules over past prices, compared with just holding")
    p.add_argument("--days", type=float, default=180)
    p.add_argument("--coins", help="e.g. BTC,ETH (default: majors.toml)")
    p.add_argument("--demo", action="store_true", help="invented prices instead of Coinbase's")
    p.add_argument("--seed", type=int, default=7)
    p.set_defaults(func=cmd_backtest)
    p = sub.add_parser("sim", help="paper trade an invented market (writes output/demo)")
    p.add_argument("--days", type=float, default=30)
    p.add_argument("--seed", type=int, default=7)
    p.set_defaults(func=cmd_sim)
    p = sub.add_parser("doctor", help="check that Coinbase's prices are reachable")
    p.set_defaults(func=cmd_doctor)
    p = sub.add_parser("why", help="why each coin is or isn't a buy right now")
    p.add_argument("--demo", action="store_true", help="invented prices instead of Coinbase's")
    p.add_argument("--seed", type=int, default=7)
    p.set_defaults(func=cmd_why)
    args = ap.parse_args(argv)
    try:
        return args.func(args)
    except KeyboardInterrupt:
        return 130


if __name__ == "__main__":
    sys.exit(main())
