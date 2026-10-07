"""Night Desk command line.

  python -m nightdesk run --demo        simulated market, opens the dashboard
  python -m nightdesk run               live market data, paper money
  python -m nightdesk check <mint>      run the whole desk on one coin, once
  python -m nightdesk report            paper results so far
  python -m nightdesk replay            record a demo night into one HTML file
"""
from __future__ import annotations

import argparse
import csv
import signal
import sys
import webbrowser
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

from . import config, rules
from .config import OUTPUT
from .desk import Desk
from .judge import describe, make_judge
from .models import Review


def cmd_run(args) -> int:
    from .server import Runner, SimClock, make_server, wall_clock

    cfg = config.load()
    now = datetime.now(timezone.utc)
    if args.demo:
        from .sources.sim import SimMarket

        start = now - timedelta(hours=args.warmup)
        source = SimMarket(start, seed=args.seed)
        judge = make_judge(cfg.judge, allow_ai=args.ai)
        desk = Desk(cfg, source, judge, start, OUTPUT / "demo", mode="demo")
        for f in ("trades.csv", "kills.csv", "state.json"):
            (OUTPUT / "demo" / f).unlink(missing_ok=True)
        print(f"Warming up the demo desk ({args.warmup:g} simulated hours)...")
        t = start
        while t < now:
            desk.step(t)
            t += timedelta(seconds=5)
        clock = SimClock(now, args.speed)
    else:
        from .sources.live import LiveSource

        source = LiveSource()
        judge = make_judge(cfg.judge, allow_ai=True)
        desk = Desk(cfg, source, judge, now, OUTPUT / "live", mode="live")
        if desk.resume():
            print(f"Resumed the paper book: bank ${desk.broker.equity():,.2f}, {len(desk.broker.positions)} open.")
        clock = wall_clock

    runner = Runner(desk, clock)
    runner.start()
    server = make_server(runner, args.host, args.port)
    url = f"http://{args.host}:{server.server_address[1]}/"
    mode = f"DEMO market at {args.speed:g}x speed" if args.demo else "LIVE market data"
    print(f"\nNight Desk is open: {url}\n  {mode} · paper money only · judge: {describe(judge)}\n  Ctrl+C to stop.")
    if not args.no_browser:
        webbrowser.open(url)

    def stop_signal(*_):        # `kill` or a server shutdown: close the books like Ctrl+C does
        raise KeyboardInterrupt

    signal.signal(signal.SIGTERM, stop_signal)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nClosing the desk...")
    finally:
        runner.stop()
        server.server_close()
    return 0


def cmd_check(args) -> int:
    from .sources.live import LiveSource

    cfg = config.load()
    now = datetime.now(timezone.utc)
    src = LiveSource()
    coin = src.snapshot([args.mint], now).get(args.mint)
    if not coin:
        print(f"DexScreener has no Solana pool for {args.mint}.")
        return 1
    review = Review(coin, first_seen=now)
    review.safety = src.safety(args.mint, now)
    desired = cfg.desk.start_bank * cfg.size.ticket_pct / 100
    outcome = rules.evaluate(review, now, cfg, desired)
    print(f"${coin.symbol}  {coin.name}\n  cap ${coin.mcap:,.0f} · pool ${coin.liquidity:,.0f} · "
          f"age {coin.age_minutes(now):.0f}m · {coin.dex}\n")
    for c in review.checks:
        print(f"  {'✓' if c.ok else '✗'} {c.kind:<5} {c.rule:<26} {c.value:<14} {c.limit}")
    print(f"\nDesk says: {outcome.upper()} · {review.note}")
    if outcome == "candidate":
        v = make_judge(cfg.judge, allow_ai=True).decide(review)
        print(f"Judge ({v.by}): {'YES' if v.buy else 'no'} {v.confidence:.2f} · {v.reason}")
    print("\nPaper analysis only. Not advice.")
    return 0


def _read(path: Path) -> list:
    if not path.exists():
        return []
    with open(path, newline="", encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


def cmd_report(args) -> int:
    folder = OUTPUT / ("demo" if args.demo else "live")
    trades, kills = _read(folder / "trades.csv"), _read(folder / "kills.csv")
    if not trades and not kills:
        print(f"No results yet in {folder}. Run the desk first.")
        return 0
    pnl = [float(t["pnl"]) for t in trades]
    wins, losses = [p for p in pnl if p > 0], [-p for p in pnl if p < 0]
    print(f"Paper results ({'demo' if args.demo else 'live'}): {len(trades)} closed trades")
    if trades:
        print(f"  net {sum(pnl):+,.2f} · won {len(wins)}/{len(trades)} ({len(wins) / len(trades):.0%})")
        if wins:
            print(f"  average win  {sum(wins) / len(wins):+,.2f}")
        if losses:
            print(f"  average loss {-sum(losses) / len(losses):+,.2f}")
            print(f"  profit factor {sum(wins) / sum(losses):.2f} (won ÷ lost; under 1.0 loses money)")
        print("  exits: " + ", ".join(f"{k} {v}" for k, v in Counter(t["exit"].split(":")[0] for t in trades).most_common()))
    if kills:
        reasons = Counter(k["reason"].split(" (")[0].rsplit(" ", 1)[0] for k in kills)
        print(f"\nStomped {len(kills)} coins. Rules they failed most:")
        for reason, n in reasons.most_common(6):
            print(f"  {n:>5}  ✗ {reason}")
    if len(trades) < 50:
        print(f"\nOnly {len(trades)} trades: too few to judge. Let it run for days, not hours.")
    return 0


def cmd_replay(args) -> int:
    from . import replay

    cfg = config.load()
    start = datetime.now(timezone.utc).replace(microsecond=0)
    print(f"Recording {args.hours:g} simulated hours (seed {args.seed})...")
    shown = {"pct": -1}

    def progress(p: float) -> None:
        if int(p * 10) != shown["pct"]:
            shown["pct"] = int(p * 10)
            print(f"\r  {min(p, 1):4.0%}", end="", flush=True)

    data = replay.record(cfg, start, args.hours, seed=args.seed, progress=progress)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(replay.fragment(data) if args.fragment else replay.page(data), encoding="utf-8")
    print(f"\nSaved {out} ({out.stat().st_size / 1e6:.1f} MB, {len(data['frames'])} frames). Open it in any browser.")
    return 0


def main(argv=None) -> int:
    config.load_env()
    ap = argparse.ArgumentParser(prog="python -m nightdesk", description="Night Desk: a paper-money memecoin desk")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("run", help="start the desk and its dashboard")
    p.add_argument("--demo", action="store_true", help="simulated market (no internet or keys needed)")
    p.add_argument("--speed", type=float, default=20, help="demo only: simulated seconds per real second")
    p.add_argument("--seed", type=int, default=7, help="demo only: which simulated night")
    p.add_argument("--warmup", type=float, default=2, help="demo only: hours to simulate before opening")
    p.add_argument("--ai", action="store_true", help="demo only: let Claude judge the fake coins too")
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--port", type=int, default=8787)
    p.add_argument("--no-browser", action="store_true")
    p.set_defaults(func=cmd_run)

    p = sub.add_parser("check", help="put one coin through every rule (live data)")
    p.add_argument("mint", help="token mint address")
    p.set_defaults(func=cmd_check)

    p = sub.add_parser("report", help="paper results so far")
    p.add_argument("--demo", action="store_true")
    p.set_defaults(func=cmd_report)

    p = sub.add_parser("replay", help="record a demo night into one HTML file")
    p.add_argument("--hours", type=float, default=6)
    p.add_argument("--seed", type=int, default=7)
    p.add_argument("--out", default=str(OUTPUT / "night-desk-replay.html"))
    p.add_argument("--fragment", action="store_true", help=argparse.SUPPRESS)
    p.set_defaults(func=cmd_replay)

    args = ap.parse_args(argv)
    try:
        return args.func(args)
    except KeyboardInterrupt:
        return 130


if __name__ == "__main__":
    sys.exit(main())
