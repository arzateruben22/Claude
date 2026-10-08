"""Night Desk command line.

  python -m nightdesk run --demo        simulated market, opens the dashboard
  python -m nightdesk run               live market data, paper money
  python -m nightdesk check <mint>      run the whole desk on one coin, once
  python -m nightdesk report            paper results so far
  python -m nightdesk replay            record a demo night into one HTML file

Before real money (paper only, they change nothing):
  python -m nightdesk scorecard         every gate, pass or fail
  python -m nightdesk risk              the risk officer tries to kill the strategy
  python -m nightdesk lessons           nightly review: losers, patterns, one proposal
  python -m nightdesk nightly           lessons + risk + scorecard, for a schedule
  python -m nightdesk sim --days 30     a month of demo market (about 10 minutes)
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import signal
import sys
import webbrowser
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

from . import config, gates, review, rules
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
        _reset_demo()
        desk = Desk(cfg, source, judge, start, OUTPUT / "demo", mode="demo")
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


DEMO_FILES = ("trades.csv", "kills.csv", "state.json", "rulebook.json", "risk_review.json", "risk_review.md",
              "scorecard.json", "scorecard.md", "lessons.md")


def _reset_demo() -> None:
    for f in DEMO_FILES:
        (OUTPUT / "demo" / f).unlink(missing_ok=True)


def _where(args):
    mode = "demo" if args.demo else "live"
    return OUTPUT / mode, mode


def _analyst(cfg, args):
    """Claude for the reviews on live data; on the demo only when asked (--ai), since it costs money."""
    if args.demo and not args.ai:
        return None
    return review.make_analyst(cfg.review)


def _score(cfg, folder, mode, now, every=False):
    rb = gates.current_rulebook(cfg, folder)
    trades = gates.load_trades(folder)
    mine = trades if every else [t for t in trades if t["rulebook"] == rb["id"]]
    s = gates.summarize(mine, cfg, None if every else rb["since"])
    officer, why = review.load_officer(folder, rb["id"], now)
    return rb, trades, mine, s, gates.gates(s, cfg, mode, officer, why or "not run")


def _scorecard_text(cfg, folder, mode, now, every=False):
    rb, trades, mine, s, gs = _score(cfg, folder, mode, now, every)
    text = gates.render(gs, s, rb, mode, cfg)
    others = len(trades) - len(mine)
    if others:
        text += f"\n{others} older trades were made under a different rulebook and don't count here."
    (folder / "scorecard.md").write_text(text + "\n")
    (folder / "scorecard.json").write_text(json.dumps(gates.to_json(gs, s, rb, mode), indent=1, default=str))
    return text, gs


def cmd_scorecard(args) -> int:
    cfg = config.load()
    folder, mode = _where(args)
    if not (folder / "trades.csv").exists() and not (folder / "rulebook.json").exists():
        print(f"No paper results yet in {folder}. Run the desk first"
              + (" (or: python -m nightdesk sim --days 30)." if args.demo else "."))
        return 0
    text, _ = _scorecard_text(cfg, folder, mode, datetime.now(timezone.utc), args.all)
    print(text)
    return 0


def cmd_risk(args) -> int:
    cfg = config.load()
    folder, mode = _where(args)
    folder.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc)
    rb, _, mine, s, gs = _score(cfg, folder, mode, now)
    analyst = _analyst(cfg, args)
    result = review.run_officer(mine, s, gs, cfg, mode, rb, now, analyst)
    review.save_officer(folder, result)
    print(review.render_officer(result))
    if analyst and analyst.cost:
        print(f"(about ${analyst.cost:.2f} of Claude usage)")
    return 0


def cmd_lessons(args) -> int:
    cfg = config.load()
    folder, mode = _where(args)
    folder.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc)
    rb = gates.current_rulebook(cfg, folder)
    mine = [t for t in gates.load_trades(folder) if t["rulebook"] == rb["id"]]
    analyst = _analyst(cfg, args)
    md = review.render_lessons(review.nightly(mine, cfg, mode, rb, now, analyst))
    path = review.append_lessons(folder, md)
    print(md + f"Added to {path}")
    return 0


def cmd_nightly(args) -> int:
    """The whole review in one go, for a schedule: lessons, then the officer, then the scorecard."""
    cfg = config.load()
    folder, mode = _where(args)
    folder.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc)
    analyst = _analyst(cfg, args)
    rb = gates.current_rulebook(cfg, folder)
    mine = [t for t in gates.load_trades(folder) if t["rulebook"] == rb["id"]]
    night = review.nightly(mine, cfg, mode, rb, now, analyst)
    review.append_lessons(folder, review.render_lessons(night))
    rb, _, mine, s, gs = _score(cfg, folder, mode, now)
    officer = review.run_officer(mine, s, gs, cfg, mode, rb, now, analyst)
    review.save_officer(folder, officer)
    text, gs = _scorecard_text(cfg, folder, mode, now)
    p = night["proposal"]
    print(text)
    print(f"\nRisk officer ({officer['by']}): {officer['verdict']}. {officer['biggest_reason']}")
    print("Proposal: " + (f"[{p['section']}] {p['setting']} {p['from']} → {p['to']}" if p else "none tonight")
          + f"  (details in {folder / 'lessons.md'})")
    if analyst and analyst.cost:
        print(f"About ${analyst.cost:.2f} of Claude usage tonight.")
    print("Nothing was changed. Paper only.")
    return 0


def cmd_sim(args) -> int:
    """Run the demo market headless for days at a time, so the reviews have something to read."""
    from .judge import RulesJudge
    from .sources.sim import SimMarket

    cfg = config.load()
    end = datetime.now(timezone.utc).replace(microsecond=0)
    start = end - timedelta(days=args.days)
    _reset_demo()
    desk = Desk(cfg, SimMarket(start, seed=args.seed), RulesJudge(cfg.judge), start, OUTPUT / "demo", mode="demo")
    desk.last_save = end          # write state once at the end, not every simulated minute
    print(f"Simulating {args.days:g} days of the demo market (seed {args.seed}, rules judge)...")
    t, day = start, -1
    while t <= end:
        desk.step(t)
        d = min(int((t - start).total_seconds() // 86400), math.ceil(args.days) - 1)
        if d != day:
            day = d
            print(f"\r  day {d + 1}/{math.ceil(args.days)} · {len(desk.broker.trades)} trades · "
                  f"bank ${desk.broker.equity():,.0f}", end="", flush=True)
        t += timedelta(seconds=15)
    desk.save()
    print(f"\nDone: {len(desk.broker.trades)} paper trades in {OUTPUT / 'demo'}.\n"
          "Next: python -m nightdesk nightly --demo")
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

    p = sub.add_parser("scorecard", help="every gate before real money, pass or fail")
    p.add_argument("--demo", action="store_true")
    p.add_argument("--all", action="store_true", help="count trades from older rulebooks too")
    p.set_defaults(func=cmd_scorecard)

    for name, fn, text in (("risk", cmd_risk, "the risk officer tries to kill the strategy"),
                           ("lessons", cmd_lessons, "nightly review: losers, patterns, at most one proposal"),
                           ("nightly", cmd_nightly, "lessons + risk officer + scorecard, for a schedule")):
        p = sub.add_parser(name, help=text)
        p.add_argument("--demo", action="store_true")
        p.add_argument("--ai", action="store_true", help="demo only: use Claude on the demo data too")
        p.set_defaults(func=fn)

    p = sub.add_parser("sim", help="run the demo market headless for days (for trying the reviews)")
    p.add_argument("--days", type=float, default=30)
    p.add_argument("--seed", type=int, default=7)
    p.set_defaults(func=cmd_sim)

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
