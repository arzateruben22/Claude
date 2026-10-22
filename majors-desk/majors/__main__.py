"""Majors Desk command line. Paper money only: nothing here can place a real order.

  python -m majors run                  paper trade live, one decision per coin every hour
  python -m majors run --with 4h        ...plus other rulebooks in the same process, each on its own paper bank
  python -m majors status               the paper bank, open positions, latest trades
  python -m majors backtest --days 180  the same rules over real past prices, vs just holding
  python -m majors sim --days 30        a month of an invented market (for trying it out)
  python -m majors doctor               can it reach Coinbase's prices?
  python -m majors why                  why each coin is or isn't a buy right now

Every command takes --book NAME: --book 4h reads majors-4h.toml (decisions on 4-hour candles) and keeps
its results in output/4h/ instead of majors.toml and output/.
"""
from __future__ import annotations

import argparse
import csv
import json
import signal
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

from . import config
from .config import OUTPUT, book_paths
from . import rules
from .desk import Desk, replay, summary
from .market import HOUR, AlpacaDaily, Bucketed, Coinbase, DemoMarket, MarketError, floor_hour, floor_to


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _book(args):
    """(settings, results folder) for --book; main = majors.toml and output/."""
    path, base = book_paths(getattr(args, "book", "main"), OUTPUT)
    return config.load(path), base


def _market(cfg, demo: bool = False, seed: int = 7, coinbase=None):
    """Hourly candles from Coinbase (cached on disk, shared by every rulebook) or the demo, bucketed if the
    rulebook decides on longer candles; or Alpaca's daily stock bars (raises MarketError without the keys)."""
    if cfg.desk.source == "alpaca" and not demo:
        return AlpacaDaily(cache_dir=OUTPUT / "cache")
    m = DemoMarket(seed) if demo else (coinbase or Coinbase(cache_dir=OUTPUT / "cache"))
    return Bucketed(m, cfg.desk.candle_hours) if cfg.desk.candle_hours > 1 else m


def _source(cfg) -> str:
    return "Alpaca's daily stock bars" if cfg.desk.source == "alpaca" else "Coinbase prices"


RETRY = timedelta(minutes=5)


def step_due(desks: list, now: datetime) -> None:
    """Step every desk whose candle has closed. A desk whose step fails unexpectedly says so and tries again in
    five minutes; it never takes the other desks down with it."""
    for entry in desks:
        book, cfg, desk, next_at = entry
        if now < next_at:
            continue
        tag = "" if book == "main" else f" [{book}]"
        before = len(desk.log)
        try:
            desk.step(now)
        except Exception as exc:  # noqa: BLE001 - one rulebook's surprise mustn't stop the rest
            print(f"{now:%Y-%m-%d %H:%M}{tag} step failed: {type(exc).__name__}: {exc}; trying again in 5 minutes",
                  flush=True)
            entry[3] = now + RETRY
            continue
        for line in list(desk.log)[: len(desk.log) - before][::-1]:
            print(line + tag, flush=True)
        print(f"{now:%Y-%m-%d %H:%M}{tag} bank ${desk.value():,.2f} · {len(desk.positions)} open", flush=True)
        h = cfg.desk.candle_hours                                 # just after the next candle closes
        entry[3] = floor_to(now, h) + h * HOUR + timedelta(seconds=90)


def cmd_run(args) -> int:
    """One process, one price feed, any number of rulebooks: each decides when its own candle closes."""
    books = list(dict.fromkeys([args.book] + (getattr(args, "also", None) or [])))
    coinbase = Coinbase(cache_dir=OUTPUT / "cache")          # shared: every book reads the same hourly candles
    desks = []
    for book in books:
        path, base = book_paths(book, OUTPUT)
        cfg = config.load(path)
        tag = "" if book == "main" else f" [{book}]"
        try:
            market = _market(cfg, coinbase=coinbase)
        except MarketError as exc:                            # a stock book without keys waits; the coins carry on
            print(f"Not starting{tag}: {exc}")
            continue
        desk = Desk(cfg, market, base / "live")
        if desk.resume():
            print(f"Resumed the paper bank{tag}: ${desk.value():,.2f}, {len(desk.positions)} open.")
        else:
            print(f"New paper bank{tag}: ${cfg.desk.start_bank:,.2f}.")
        print(f"  watching {', '.join(cfg.desk.coins)} on {_source(cfg)}, one decision per "
              f"{cfg.desk.asset_word()[:-1]} per finished {cfg.rules.candle_word()}")
        desks.append([book, cfg, desk, _now()])
    if not desks:
        print("No rulebook could start.")
        return 1
    print("Ctrl+C to stop.")

    def stop(*_):
        raise KeyboardInterrupt

    signal.signal(signal.SIGTERM, stop)
    try:
        while True:
            step_due(desks, _now())
            time.sleep(20)
    except KeyboardInterrupt:
        for _, _, desk, _ in desks:
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

    _, base = _book(args)
    folder = base / ("demo" if args.demo else "live")
    state = folder / "state.json"
    if not state.exists():
        which = "" if args.book == "main" else f" --book {args.book}"
        print(f"Nothing yet in {folder}. Start it with: python -m majors run{which}")
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
    cfg, base = _book(args)
    if args.coins:
        cfg.desk.coins = [c.strip().upper() for c in args.coins.split(",")]
    end = floor_to(_now(), cfg.desk.candle_hours)
    start = end - timedelta(days=args.days)
    label = f"{'demo-' if args.demo else ''}{start:%Y-%m-%d}_{end:%Y-%m-%d}"
    folder = base / "backtests" / label
    (folder / "trades.csv").unlink(missing_ok=True)
    if not args.demo:
        kind = "daily stock bars from Alpaca" if cfg.desk.source == "alpaca" else "hourly prices from Coinbase"
        print(f"Fetching {args.days:g} days of {kind} (kept in {OUTPUT / 'cache'} for next time)...")
    try:
        result = replay(cfg, _market(cfg, args.demo, args.seed), start, end, folder)
    except MarketError as exc:
        print(f"Couldn't get prices: {exc}")
        return 1
    text = summary(result["desk"], result["hold"], args.days, "Backtest (INVENTED demo prices)" if args.demo else "Backtest",
                   result["periods"], result["skipped"])
    folder.mkdir(parents=True, exist_ok=True)
    (folder / "summary.md").write_text(text + "\n")
    (folder / "periods.json").write_text(json.dumps({"book": args.book, "days": args.days, "demo": bool(args.demo),
                                                     "hold_pct": result["hold"]["return_pct"],
                                                     "first": start.isoformat(), "last": end.isoformat(),
                                                     "coins": [c for c in cfg.desk.coins if c not in result["skipped"]],
                                                     "source": cfg.desk.source, "skipped": result["skipped"],
                                                     "periods": result["periods"],
                                                     "quarters": result["quarters"], "years": result["years"]},
                                                    indent=1))
    print(text)
    print(f"\nTrades: {folder / 'trades.csv'}")
    print("Past prices don't predict future ones. A backtest that loses is a reason to stop; one that wins is "
          "only a reason to keep paper trading.")
    return 0


def cmd_sim(args) -> int:
    cfg, base = _book(args)
    folder = base / "demo"
    for f in ("trades.csv", "state.json"):
        (folder / f).unlink(missing_ok=True)
    end = floor_to(_now(), cfg.desk.candle_hours)
    result = replay(cfg, _market(cfg, True, args.seed), end - timedelta(days=args.days), end, folder, close_at_end=False)
    desk = result["desk"]
    desk.save()
    print(summary(desk, result["hold"], args.days, "Demo (INVENTED prices)"))
    which = "" if args.book == "main" else f" --book {args.book}"
    print(f"\nPaper results in {folder}. Look: python -m majors status --demo{which}")
    return 0


def cmd_doctor(args) -> int:
    cfg = _book(args)[0]
    try:
        cb = AlpacaDaily() if cfg.desk.source == "alpaca" else Coinbase()
    except MarketError as exc:
        print(f"  FIX  {exc}")
        return 1
    bad = 0
    for coin in cfg.desk.coins:
        try:
            cs = cb.recent(coin, cfg.desk.quote, _now(), 3)
            print(f"  ok   {coin}-{cfg.desk.quote}: ${cs[-1].c:,.6g} at {cs[-1].closed_at:%H:%M} UTC")
        except (MarketError, IndexError) as exc:
            bad += 1
            print(f"  FIX  {coin}-{cfg.desk.quote}: {exc or 'no candles'}")
    print("All good." if not bad else f"Some {cfg.desk.asset_word()} have no prices: check the names in the rulebook "
          "and the internet.")
    return 1 if bad else 0


def cmd_why(args) -> int:
    """Each coin against the buy rule, in plain words: how far it is from a buy, and whether it's held."""
    cfg, base = _book(args)
    r = cfg.rules
    try:
        market = _market(cfg, args.demo, args.seed)
    except MarketError as exc:
        print(f"Can't get prices: {exc}")
        return 1
    now = _now()
    held = set()
    state = base / ("demo" if args.demo else "live") / "state.json"
    if state.exists():
        import json

        held = {p["symbol"] for p in json.loads(state.read_text()).get("positions", [])}
    rule = (f"above the highest price of the {r.span(r.breakout_hours)} window before it (a breakout)"
            if r.breakout else "nothing more: a plain trend filter")
    print(f"A buy needs the last {r.candle_word()} to close above its {r.span(r.trend_hours)} average (an uptrend) "
          f"AND {rule}.")
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
        trend = rules.ema([c.c for c in cs], r.trend)
        trend_txt = (f"{'above' if last > trend else 'below'} its {r.span(r.trend_hours)} average "
                     f"({(last / trend - 1) * 100:+.1f}%)")
        need = ""
        if r.breakout:
            high = max(c.h for c in cs[-1 - r.breakout:-1])
            need = (f" · {(high / last - 1) * 100:+.1f}% short of its {r.span(r.breakout_hours)} high (${high:,.6g})"
                    if last <= high else f" · broke above its {r.span(r.breakout_hours)} high (${high:,.6g})")
        print(f"  {coin:<5} ${last:,.6g} · {trend_txt}{need}"
              + (" · BUY SIGNAL (taken on the desk's next check)" if ok else ""))
    return 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="python -m majors", description="Paper trading on the big coins.")
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("run", help="paper trade live (one decision per finished candle)")
    p.add_argument("--with", dest="also", action="append", metavar="BOOK",
                   help="also run another rulebook in this process, on its own paper bank (e.g. --with 4h)")
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
    for p in sub.choices.values():
        p.add_argument("--book", default="main", metavar="NAME",
                       help="which rulebook: main (majors.toml, the default) or another, e.g. 4h (majors-4h.toml)")
    args = ap.parse_args(argv)
    try:                               # a bad rulebook name, said plainly before anything runs
        for book in [args.book] + (getattr(args, "also", None) or []):
            book_paths(book)
    except ValueError as exc:
        print(f"✗ {exc}", file=sys.stderr)
        return 2
    try:
        return args.func(args)
    except KeyboardInterrupt:
        return 130


if __name__ == "__main__":
    sys.exit(main())
