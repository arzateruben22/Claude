"""Command line.

  python -m scanner scan              scan now (session picked from the clock)
  python -m scanner scan --demo       offline demo with fake tickers
  python -m scanner grade             score past picks (paper trading)
  python -m scanner stats             paper-trading scoreboard
  python -m scanner backtest --from 2026-06-01   replay past days through the rules
  python -m scanner journal           last few journal rows
  python -m scanner doctor            check keys and connectivity

Before real money (paper only, they change nothing):
  python -m scanner scorecard         every gate, pass or fail
  python -m scanner risk              the risk officer tries to kill the rules
  python -m scanner lessons           nightly review: losing picks, patterns, one proposal
  python -m scanner nightly           lessons + risk + scorecard, after `grade`
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import date, datetime, timezone

from . import gates, journal, report, review
from .config import OUTPUT, ROOT, load_criteria, load_env
from .engine import run_scan
from .market import ET, SESSIONS, detect_session, fmt_pt, in_pt_window, parse_pt, previous_trading_day, trade_date_for
from .providers import NAMES, ProviderError, make_provider


def _provider_args(p: argparse.ArgumentParser) -> None:
    p.add_argument("--provider", choices=NAMES, help="data source (default: from .env)")
    p.add_argument("--demo", action="store_true", help="offline demo data, fake tickers")
    p.add_argument("--at", metavar='"YYYY-MM-DD HH:MM"', help="pretend it's this Pacific time (demo only)")


def _setup(args):
    name = "demo" if args.demo else args.provider
    provider = make_provider(name)
    if args.at and provider.name != "demo":
        raise ProviderError("--at only works with --demo: live snapshots can't be rewound.")
    now = parse_pt(args.at) if args.at else datetime.now(timezone.utc)
    out_dir = OUTPUT / "demo" if provider.name == "demo" else OUTPUT
    return provider, now, out_dir


def cmd_scan(args) -> int:
    crit = load_criteria()
    provider, now, out_dir = _setup(args)
    if args.window and not args.at and not in_pt_window(now, args.window):
        print(f"Outside the {args.window} PT window ({fmt_pt(now)}); skipping.")
        return 0
    session = args.session
    if provider.name == "demo" and not args.at:
        from .providers.demo import anchor_for

        session, now = anchor_for(session if session != "auto" else "premarket", now)
    if session == "auto":
        session = detect_session(now)
    if session == "closed":
        print(f"Market is closed today ({fmt_pt(now)}): weekend or holiday. Nothing to scan.")
        return 0

    res = run_scan(provider, crit, now, session)
    print(report.terminal(res, crit))
    if not args.no_save:
        paths = report.write_outputs(res, crit, out_dir)
        added = journal.record(res, out_dir / "journal.csv", rules=gates.rules_id(crit))
        print(f"\nSaved {paths[0].relative_to(ROOT)} (+ .md, .csv); open "
              f"{paths[-1].relative_to(ROOT)} in a browser. {added} new pick(s) in the journal.")
        if args.open:
            import webbrowser

            webbrowser.open(paths[-1].resolve().as_uri())
    if args.notify:
        from . import html_report
        from .notify import send

        label = report.SESSION_LABEL[res.session]
        sent = send(f"{label} scan: {len(res.passed)} pick(s)", report.push_text(res),
                    page=html_report.page(res, crit), summary=report.one_line(res))
        print(f"Notified: {', '.join(sent) or 'nothing (set NTFY_TOPIC or DISCORD_WEBHOOK_URL)'}")
    return 0


def cmd_grade(args) -> int:
    crit = load_criteria()
    provider, now, out_dir = _setup(args)
    graded, pending = journal.grade(provider, crit, now, out_dir / "journal.csv")
    print(f"Graded {graded} pick(s); {pending} waiting for their trade day to finish.")
    if graded:
        print()
        print(journal.stats(crit, out_dir / "journal.csv"))
    return 0


def cmd_backtest(args) -> int:
    from .backtest import run_backtest, trading_days

    crit = load_criteria()
    provider = make_provider("demo" if args.demo else args.provider)
    today = datetime.now(ET).date()
    last = args.last or previous_trading_day(today)
    while provider.name != "demo" and trade_date_for(args.session, last) >= today:
        last = previous_trading_day(last)  # its trade day hasn't finished yet, so it can't be graded
    first = args.first
    if first > last:
        raise ProviderError(f"--from {first} is after --to {last}.")
    at = datetime.strptime(args.time or ("17:00" if args.session == "afterhours" else "05:45"), "%H:%M").time()
    if at.minute % 5:
        raise ProviderError("--time must be on a 5-minute mark (e.g. 05:45) so no bar peeks past it.")
    n = len(trading_days(first, last))
    print(f"Backtest {first} → {last}: {n} trading days, {args.session} scan at {at:%H:%M} PT, "
          f"provider {provider.name}. Rules: {crit.summary()}")
    if provider.name != "demo":
        print(f"First run downloads history (roughly {max(1, n // 4)}-{max(2, n // 2)} min on the free plan); "
              "re-runs with new rules use the cache in .cache/backtest.\n")
    out_dir, stats = run_backtest(provider, crit, first, last, args.session, at)
    print("\n" + stats)
    print(f"\nSaved {(out_dir / 'summary.md').relative_to(ROOT)} and journal.csv")
    return 0


def cmd_stats(args) -> int:
    out_dir = OUTPUT / "demo" if args.demo else OUTPUT
    print(journal.stats(load_criteria(), out_dir / "journal.csv"))
    return 0


def cmd_journal(args) -> int:
    out_dir = OUTPUT / "demo" if args.demo else OUTPUT
    print(journal.recent(out_dir / "journal.csv", args.limit))
    return 0


def _evidence(crit, settings, folder, demo, now) -> dict:
    """Everything the scorecard, the officer and the review read, for the current rules."""
    from .backtest import trading_days

    def days_of(picks, extra=()):
        ds = [p["trade_date"] for p in picks] + [d for d in extra if d]
        return trading_days(min(ds), max(ds)) if ds else []

    rid = gates.rules_id(crit)
    bt_dir, meta = gates.find_backtest(folder, rid)
    bt_picks = [p for p in gates.read_picks(bt_dir / "journal.csv") if p["rules"] == rid] if bt_dir else []
    bounds = (date.fromisoformat(meta["first"]), date.fromisoformat(meta["last"])) if bt_dir else ()
    bt = gates.summarize(bt_picks, crit, settings.gates, days_of(bt_picks, bounds)) if bt_dir else None
    paper_all = gates.read_picks(folder / "journal.csv")
    paper = [p for p in paper_all if p["rules"] == rid]
    paper_sum = gates.summarize(paper, crit, settings.gates, days_of(paper))
    officer, why = review.load_officer(folder, rid, now)
    gs = gates.gates(bt, meta, paper_sum, settings.gates, crit, demo, officer, why or "not run")
    breakdown = journal.stats(crit, bt_dir / "journal.csv") if bt_dir else ""
    return {"rid": rid, "bt_dir": bt_dir, "meta": meta, "bt_picks": bt_picks, "bt": bt, "paper": paper,
            "paper_sum": paper_sum, "others": len(paper_all) - len(paper), "gates": gs, "breakdown": breakdown}


def _review_setup(args):
    from .gates import load_settings

    crit, settings = load_criteria(), load_settings()
    folder = OUTPUT / "demo" if args.demo else OUTPUT
    analyst = None if (args.demo and not getattr(args, "ai", False)) else review.make_analyst(settings.review)
    return crit, settings, folder, analyst


def _scorecard_text(crit, settings, folder, demo, now):
    ev = _evidence(crit, settings, folder, demo, now)
    text = gates.render(ev["gates"], ev["rid"], ev["bt_dir"], ev["meta"], ev["paper_sum"], demo)
    if ev["others"]:
        text += f"\n{ev['others']} older paper picks were made with different rules and don't count here."
    folder.mkdir(parents=True, exist_ok=True)
    (folder / "scorecard.md").write_text(text + "\n", encoding="utf-8")
    (folder / "scorecard.json").write_text(json.dumps(gates.to_json(ev["gates"], ev["rid"], ev["bt"],
                                                                    ev["paper_sum"], demo), indent=1, default=str))
    return text


def cmd_scorecard(args) -> int:
    crit, settings, folder, _ = _review_setup(args)
    print(_scorecard_text(crit, settings, folder, args.demo, datetime.now(timezone.utc)))
    return 0


def _officer(crit, settings, folder, demo, now, analyst) -> dict:
    ev = _evidence(crit, settings, folder, demo, now)
    case = review.case_file(crit, ev["gates"], ev["bt_picks"], ev["bt"], ev["paper"], ev["paper_sum"],
                            ev["breakdown"], demo, ev["rid"])
    result = review.run_officer(case, ev["gates"], ev["rid"], demo, now, analyst)
    review.save_officer(folder, result)
    return result


def cmd_risk(args) -> int:
    crit, settings, folder, analyst = _review_setup(args)
    result = _officer(crit, settings, folder, args.demo, datetime.now(timezone.utc), analyst)
    print(review.render_officer(result))
    if analyst and analyst.cost:
        print(f"(about ${analyst.cost:.2f} of Claude usage)")
    return 0


def _lessons(crit, settings, folder, demo, now, analyst) -> dict:
    ev = _evidence(crit, settings, folder, demo, now)
    night = review.nightly(ev["paper"], ev["bt_picks"], crit, settings.review, ev["rid"], demo,
                           now.astimezone(ET).date(), analyst)
    review.append_lessons(folder, review.render_lessons(night))
    return night


def cmd_lessons(args) -> int:
    crit, settings, folder, analyst = _review_setup(args)
    night = _lessons(crit, settings, folder, args.demo, datetime.now(timezone.utc), analyst)
    print(review.render_lessons(night) + f"Added to {folder / 'lessons.md'}")
    return 0


def cmd_nightly(args) -> int:
    """The whole review in one go, after `grade`: lessons, then the officer, then the scorecard."""
    now = datetime.now(timezone.utc)
    if args.window and not in_pt_window(now, args.window):
        print(f"Outside the {args.window} PT window ({fmt_pt(now)}); skipping.")
        return 0
    crit, settings, folder, analyst = _review_setup(args)
    night = _lessons(crit, settings, folder, args.demo, now, analyst)
    officer = _officer(crit, settings, folder, args.demo, now, analyst)
    print(_scorecard_text(crit, settings, folder, args.demo, now))
    p = night["proposal"]
    print(f"\nRisk officer ({officer['by']}): {officer['verdict']}. {officer['biggest_reason']}")
    print("Proposal: " + (f"[{p['section']}] {p['setting']} {p['from']} → {p['to']}" if p else "none tonight")
          + f"  (details in {folder / 'lessons.md'})")
    if analyst and analyst.cost:
        print(f"About ${analyst.cost:.2f} of Claude usage tonight.")
    print("Nothing was changed. Paper only.")
    return 0


def cmd_doctor(args) -> int:
    now = datetime.now(timezone.utc)
    print(f"Python {sys.version.split()[0]} · {fmt_pt(now)} · session: {detect_session(now)}")
    crit = load_criteria()
    print(f"criteria.toml OK — {crit.summary()}")
    for var in ("SCANNER_PROVIDER", "ALPACA_API_KEY", "ALPACA_SECRET_KEY", "ALPACA_FEED", "MASSIVE_API_KEY",
                "NTFY_TOPIC", "DISCORD_WEBHOOK_URL"):
        val = os.getenv(var)
        shown = "not set" if not val else (val if var in ("SCANNER_PROVIDER", "ALPACA_FEED") else val[:4] + "…")
        print(f"  {var:<20} {shown}")
    try:
        import yfinance  # noqa: F401

        print("  yfinance             installed (free float fallback)")
    except ImportError:
        print("  yfinance             not installed — floats only from Massive (pip install yfinance)")
    try:
        provider = make_provider(args.provider)
    except ProviderError as exc:
        print(f"\n✗ {exc}")
        return 1
    print(f"\nProvider: {provider.name}" + (f" (delayed ~{provider.delay_minutes} min)" if provider.delay_minutes else ""))
    if provider.name == "alpaca":
        try:
            clock = provider.http.get(f"{provider.trading}/v2/clock")
        except ProviderError as exc:
            if "HTTP 401" in str(exc) or "HTTP 403" in str(exc):
                print("✗ Alpaca turned these keys down. They must come from your Paper account (the key ID starts "
                      "with PK), and the secret must belong to that same key ID. Easiest fix: regenerate the keys "
                      "in Alpaca and save both again (on the always-on server: bash server/keys.sh).")
            else:
                print(f"✗ {exc}")
            return 1
        print(f"✓ Alpaca keys work · market open now: {clock.get('is_open')} · next open {clock.get('next_open')}")
    elif provider.name == "massive":
        status = provider.http.get("https://api.massive.com/v1/marketstatus/now")
        print(f"✓ Massive key works · market: {status.get('market')}")
    return 0


def main(argv=None) -> int:
    load_env()
    ap = argparse.ArgumentParser(prog="python -m scanner", description="Small-cap momentum scanner")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("scan", help="run a scan")
    _provider_args(p)
    p.add_argument("--session", choices=("auto",) + SESSIONS, default="auto")
    p.add_argument("--window", metavar="HH:MM-HH:MM", help="only run inside this Pacific-time window (for schedulers)")
    p.add_argument("--notify", action="store_true", help="push results via ntfy/Discord")
    p.add_argument("--open", action="store_true", help="open the watchlist page in your browser")
    p.add_argument("--no-save", action="store_true", help="print only; don't write files or journal")
    p.set_defaults(func=cmd_scan)

    p = sub.add_parser("backtest", help="replay past days through the rules (Alpaca or demo)")
    p.add_argument("--provider", choices=NAMES, help="data source (default: from .env)")
    p.add_argument("--demo", action="store_true", help="offline demo data, fake tickers")
    p.add_argument("--from", dest="first", required=True, type=date.fromisoformat, metavar="YYYY-MM-DD")
    p.add_argument("--to", dest="last", type=date.fromisoformat, metavar="YYYY-MM-DD",
                   help="last scan day (default: the last finished trading day)")
    p.add_argument("--session", choices=("premarket", "afterhours"), default="premarket")
    p.add_argument("--time", metavar="HH:MM", help="Pacific scan time (default 05:45, or 17:00 for afterhours)")
    p.set_defaults(func=cmd_backtest)

    p = sub.add_parser("grade", help="grade finished picks in the journal")
    _provider_args(p)
    p.set_defaults(func=cmd_grade)

    for name, func in (("stats", cmd_stats), ("journal", cmd_journal)):
        p = sub.add_parser(name)
        p.add_argument("--demo", action="store_true", help="use the demo journal")
        p.add_argument("--limit", type=int, default=15)
        p.set_defaults(func=func)

    p = sub.add_parser("scorecard", help="every gate before real money, pass or fail")
    p.add_argument("--demo", action="store_true", help="use the demo journal and backtests")
    p.set_defaults(func=cmd_scorecard)

    for name, func, text in (("risk", cmd_risk, "the risk officer tries to kill the rules"),
                             ("lessons", cmd_lessons, "nightly review: losing picks, patterns, at most one proposal"),
                             ("nightly", cmd_nightly, "lessons + risk officer + scorecard (run after grade)")):
        p = sub.add_parser(name, help=text)
        p.add_argument("--demo", action="store_true", help="use the demo journal and backtests")
        p.add_argument("--ai", action="store_true", help="demo only: use Claude on the demo data too")
        if name == "nightly":
            p.add_argument("--window", metavar="HH:MM-HH:MM", help="only run inside this Pacific-time window")
        p.set_defaults(func=func)

    p = sub.add_parser("doctor", help="check setup")
    p.add_argument("--provider", choices=NAMES)
    p.set_defaults(func=cmd_doctor)

    args = ap.parse_args(argv)
    try:
        return args.func(args)
    except ProviderError as exc:
        print(f"✗ {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
