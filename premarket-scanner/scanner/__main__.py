"""Command line.

  python -m scanner scan              scan now (session picked from the clock)
  python -m scanner scan --demo       offline demo with fake tickers
  python -m scanner grade             score past picks (paper trading)
  python -m scanner stats             paper-trading scoreboard
  python -m scanner journal           last few journal rows
  python -m scanner doctor            check keys and connectivity
"""
from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timezone

from . import journal, report
from .config import OUTPUT, ROOT, load_criteria, load_env
from .engine import run_scan
from .market import SESSIONS, detect_session, fmt_pt, in_pt_window, parse_pt
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
        added = journal.record(res, out_dir / "journal.csv")
        print(f"\nSaved {paths[0].relative_to(ROOT)} (+ .csv, latest.md); "
              f"{added} new pick(s) in the journal.")
    if args.notify:
        from .notify import send

        label = report.SESSION_LABEL[res.session]
        sent = send(f"{label} scan: {len(res.passed)} pick(s)", report.push_text(res))
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


def cmd_stats(args) -> int:
    out_dir = OUTPUT / "demo" if args.demo else OUTPUT
    print(journal.stats(load_criteria(), out_dir / "journal.csv"))
    return 0


def cmd_journal(args) -> int:
    out_dir = OUTPUT / "demo" if args.demo else OUTPUT
    print(journal.recent(out_dir / "journal.csv", args.limit))
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
        clock = provider.http.get(f"{provider.trading}/v2/clock")
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
    p.add_argument("--no-save", action="store_true", help="print only; don't write files or journal")
    p.set_defaults(func=cmd_scan)

    p = sub.add_parser("grade", help="grade finished picks in the journal")
    _provider_args(p)
    p.set_defaults(func=cmd_grade)

    for name, func in (("stats", cmd_stats), ("journal", cmd_journal)):
        p = sub.add_parser(name)
        p.add_argument("--demo", action="store_true", help="use the demo journal")
        p.add_argument("--limit", type=int, default=15)
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
