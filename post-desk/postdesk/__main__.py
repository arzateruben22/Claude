"""Post Desk command line.

Try it (no accounts or keys needed):
  python -m postdesk run --demo            a make-believe X account; opens the dashboard
  python -m postdesk sim --days 14         two demo weeks headless, then: stats --demo, review --demo
  python -m postdesk replay                record the demo into one HTML file

Your account:
  python -m postdesk auth                  connect your X account (once)
  python -m postdesk doctor [--online]     check settings, keys and the connection
  python -m postdesk run                   the desk + dashboard (posts only what you approve)

Without the dashboard:
  python -m postdesk queue                 drafts waiting for you
  python -m postdesk approve <id> [<id>]   approve (reject works the same way)
  python -m postdesk add "text"            your own post, approved, into the next open slot
  python -m postdesk draft [--n 3]         ask the writer for drafts now
  python -m postdesk stats                 what's working, media kit, payout progress
  python -m postdesk review                the nightly review, now
  python -m postdesk earned 25 --source sponsor    log money the account made
"""
from __future__ import annotations

import argparse
import math
import os
import secrets
import signal
import sys
import webbrowser
from datetime import datetime, timedelta, timezone
from pathlib import Path

from . import analyst, config, review
from .config import OUTPUT, SECRETS


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(microsecond=0)


def _folder(args) -> Path:
    return OUTPUT / ("demo" if getattr(args, "demo", False) else "live")


def cmd_run(args) -> int:
    from .build import demo_desk, live_desk
    from .server import Runner, SimClock, make_server, wall_clock
    from .xapi import AuthError

    cfg = config.load()
    now = _now()
    if args.demo:
        start = now - timedelta(days=args.warmup)
        desk = demo_desk(cfg, start, OUTPUT / "demo", seed=args.seed, allow_ai=args.ai)
        print(f"Warming up the demo ({args.warmup:g} simulated days, so the charts have something to show)...")
        t = start
        while t < now:
            desk.step(t)
            t += timedelta(minutes=2)
        clock = SimClock(now, args.speed)
    else:
        try:
            desk = live_desk(cfg, now, OUTPUT / "live")
        except AuthError as exc:
            print(exc)
            return 1
        if cfg.account.handle == "yourhandle":
            print("Set [account] handle in desk.toml first.")
            return 1
        clock = wall_clock

    runner = Runner(desk, clock)
    runner.start()
    server = make_server(runner, args.host, args.port)
    url = f"http://{args.host}:{server.server_address[1]}/"
    if args.demo:
        how = f"DEMO account at {args.speed:g}x speed (one simulated hour every {3600 / args.speed:.0f} seconds)"
    else:
        how = f"LIVE as @{cfg.account.handle} · approval: {cfg.approval.mode}"
    print(f"\nPost Desk is open: {url}\n  {how}\n  writer: {desk.writer.name}\n  Ctrl+C to stop.")
    if not args.no_browser:
        webbrowser.open(url)

    def stop_signal(*_):
        raise KeyboardInterrupt

    signal.signal(signal.SIGTERM, stop_signal)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nClosing the desk. Approved drafts wait for the next run.")
    finally:
        runner.stop()
        server.server_close()
    return 0


def cmd_auth(args) -> int:
    import requests

    from .xapi import authorize_url, exchange_code, pkce_pair, save_tokens, wait_for_code

    client_id, secret = os.getenv("X_CLIENT_ID", ""), os.getenv("X_CLIENT_SECRET", "")
    if not client_id:
        print("Put X_CLIENT_ID (and X_CLIENT_SECRET, if X gave you one) in .env first. See README, step 2.")
        return 1
    redirect = f"http://127.0.0.1:{args.port}/callback"
    verifier, challenge = pkce_pair()
    state = secrets.token_urlsafe(16)
    url = authorize_url(client_id, redirect, state, challenge)
    print("Opening X so you can approve Post Desk for your account.\n"
          f"(The app's callback URL in the X developer console must be exactly {redirect})\n\n{url}\n")
    if not args.no_browser:
        webbrowser.open(url)
    code = wait_for_code(args.port, state)
    tok = exchange_code(requests.Session(), client_id, secret, code, verifier, redirect)
    save_tokens(tok)
    print(f"Connected. The keys are in {SECRETS / 'x_tokens.json'} (readable only by you). Never share that file.")
    return 0


def cmd_doctor(args) -> int:
    from .xapi import TOKENS, load_tokens

    ok = True

    def line(good: bool, text: str, fix: str = "") -> None:
        nonlocal ok
        ok &= good
        print(f"  {'ok ' if good else 'FIX'}  {text}" + (f"\n        → {fix}" if fix and not good else ""))

    print("Settings (desk.toml)")
    try:
        cfg = config.load()
    except Exception as exc:
        line(False, f"desk.toml: {exc}")
        return 1
    line(True, f"{cfg.schedule.posts_per_day} posts a day, {cfg.schedule.active_hours} {cfg.account.timezone}, "
               f"approval: {cfg.approval.mode}")
    line(cfg.account.handle != "yourhandle", f"handle: @{cfg.account.handle}", "set [account] handle")
    print(f"  ---  notes about you: {len(cfg.account.notes)}" + (" (the writer won't mention your own work or results "
                                                                 "until you add some)" if not cfg.account.notes else ""))
    print(f"  ---  budget: X ${cfg.budget.daily_usd:.2f}/day, ${cfg.budget.monthly_usd:.2f}/month; "
          f"Claude ${cfg.writer.ai_daily_usd:.2f}/day")
    print("\nKeys (.env)")
    line(bool(os.getenv("X_CLIENT_ID")), "X_CLIENT_ID", "create an app at developer.x.com and copy its OAuth 2.0 Client ID")
    has_claude = bool(os.getenv("ANTHROPIC_API_KEY") or os.getenv("ANTHROPIC_AUTH_TOKEN"))
    line(has_claude or not cfg.writer.use_ai, "ANTHROPIC_API_KEY" + ("" if has_claude else " (missing: you'd write every draft yourself)"),
         "add your Claude API key from console.anthropic.com, or set [writer] use_ai = false")
    for pkg in ("requests", "anthropic"):
        try:
            __import__(pkg)
            line(True, f"python package: {pkg}")
        except ImportError:
            line(False, f"python package: {pkg}", "pip install -r requirements.txt")
    print("\nX connection")
    tok = load_tokens(TOKENS)
    line(bool(tok), "signed in" if tok else "not signed in", "python -m postdesk auth")
    if tok and tok.get("expires_at"):
        exp = datetime.fromisoformat(tok["expires_at"])
        print(f"  ---  access key renews itself (current one {'expired' if exp < _now() else 'valid'}; "
              f"refresh key {'present' if tok.get('refresh_token') else 'MISSING: run auth again'})")
    if args.online and tok:
        from .budget import Budget
        from .store import Store
        from .xapi import XClient, XError

        store = Store(OUTPUT / "live" / "desk.db")
        try:
            me = XClient(Budget(cfg.budget, store, cfg.tz)).me(_now())
            line(me["username"].lower() == cfg.account.handle.lower(),
                 f"X says you're @{me['username']} with {me['followers']:,} followers (cost $0.001)",
                 f"desk.toml says @{cfg.account.handle}: fix one of them")
        except XError as exc:
            line(False, f"X: {exc}")
    print("\nBefore going live (X's automation rules)")
    print("  ---  turn on the Automated label: on X, Settings → Your account → Account information → Automation,\n"
          "       and name the account that runs it (yours). Put 'Posts drafted with AI, approved by @you' in your bio.")
    print("  ---  this desk never likes, follows, replies or mentions anyone; don't add code that does.")
    print("\nAll good." if ok else "\nFix the lines marked FIX, then run doctor again.")
    return 0 if ok else 1


def _show(d) -> str:
    flags = " ".join(f"[{c.level}: {c.rule}]" for c in d.checks if not c.ok)
    who = f"{d.kind}" + (f"/{d.format}" if d.kind == "original" else f" @{d.target_author}")
    body = d.text if d.kind != "repost" else f"(repost) {d.target_text[:200]}"
    return f"{d.id}  {d.status:<8} {who:<18} {flags}\n    {body.replace(chr(10), chr(10) + '    ')}"


def cmd_queue(args) -> int:
    from .store import Store

    store = Store(_folder(args) / "desk.db")
    drafts = store.drafts(("queued", "approved", "blocked"))
    if not drafts:
        print("Nothing waiting.")
    for d in drafts:
        print(_show(d) + "\n")
    return 0


def _act(args, action: str) -> int:
    from .build import offline_desk

    cfg = config.load()
    desk = offline_desk(cfg, _now(), _folder(args))
    code = 0
    for i in args.ids:
        ok, msg = desk.act(_now(), action, i)
        print(f"{i}: {msg}")
        code |= 0 if ok else 1
    if action == "approve" and not code:
        print("They go out in the next open slots while the desk is running.")
    return code


def cmd_approve(args) -> int:
    return _act(args, "approve")


def cmd_reject(args) -> int:
    return _act(args, "reject")


def cmd_add(args) -> int:
    from .build import offline_desk

    cfg = config.load()
    desk = offline_desk(cfg, _now(), _folder(args))
    ok, msg = desk.act(_now(), "add", text=args.text, fmt=args.format)
    print(msg)
    return 0 if ok else 1


def cmd_draft(args) -> int:
    from .budget import Budget
    from .build import offline_desk
    from .store import Store
    from .writer import make_writer

    cfg = config.load()
    cfg.writer.drafts_per_batch = args.n
    folder = _folder(args)
    store = Store(folder / "desk.db")
    writer = make_writer(cfg, Budget(cfg.budget, store, cfg.tz, cfg.writer.ai_daily_usd), demo=args.demo)
    desk = offline_desk(cfg, _now(), folder, writer=writer)
    before = {d.id for d in desk.store.drafts()}
    desk.act(_now(), "write")
    desk._refill(_now())
    new = [d for d in desk.store.drafts() if d.id not in before]
    if not new:
        print(f"No drafts. {writer.last_error}")
        return 1
    for d in new:
        print(_show(d) + "\n")
    print(f"{len(new)} drafts written by {writer.name}. Approve with: python -m postdesk approve <id>")
    return 0


def cmd_stats(args) -> int:
    from .store import Store

    cfg = config.load()
    store = Store(_folder(args) / "desk.db")
    me = store.get("me", {}) or {}
    print(analyst.render(store, cfg, _now(), int(me.get("followers", 0)), me.get("verified_followers")))
    return 0


def cmd_review(args) -> int:
    from .budget import Budget
    from .store import Store

    cfg = config.load()
    folder = _folder(args)
    store = Store(folder / "desk.db")
    now = _now()
    reviewer = review.make_reviewer(cfg, Budget(cfg.budget, store, cfg.tz, cfg.writer.ai_daily_usd),
                                    allow_ai=args.ai or not args.demo)
    result = review.nightly(store, cfg, now, reviewer)
    md = review.render(result, now.astimezone(cfg.tz))
    path = review.append(folder, md)
    print(md + f"Added to {path}. Nothing in desk.toml was changed.")
    return 0


def cmd_earned(args) -> int:
    from .store import Store

    store = Store(_folder(args) / "desk.db")
    store.add_income(_now(), args.usd, args.source, args.note)
    total = sum(x[1] for x in store.income(_now() - timedelta(days=30)))
    print(f"Logged ${args.usd:.2f} from {args.source}. Last 30 days: ${total:.2f}.")
    return 0


def cmd_sim(args) -> int:
    from .build import demo_desk

    cfg = config.load()
    end = _now()
    start = end - timedelta(days=args.days)
    desk = demo_desk(cfg, start, OUTPUT / "demo", seed=args.seed)
    print(f"Simulating {args.days:g} days of a make-believe account (seed {args.seed})...")
    t, day = start, -1
    while t <= end:
        desk.step(t)
        d = min(int((t - start).total_seconds() // 86400), math.ceil(args.days) - 1)
        if d != day:
            day = d
            print(f"\r  day {d + 1}/{math.ceil(args.days)} · {int(desk.me.get('followers', 0)):,} followers", end="", flush=True)
        t += timedelta(minutes=2)
    print(f"\nDone. Next: python -m postdesk stats --demo   (lessons so far: {OUTPUT / 'demo' / 'lessons.md'})")
    return 0


def cmd_replay(args) -> int:
    from . import replay

    cfg = config.load()
    print(f"Recording {args.days:g} demo days after a {args.warmup:g}-day warm-up (seed {args.seed})...")
    shown = {"p": -1}

    def progress(p: float) -> None:
        if int(p * 20) != shown["p"]:
            shown["p"] = int(p * 20)
            print(f"\r  {min(p, 1):4.0%}", end="", flush=True)

    data = replay.record(cfg, _now(), days=args.days, warmup_days=args.warmup, seed=args.seed, progress=progress)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(replay.fragment(data) if args.fragment else replay.page(data), encoding="utf-8")
    print(f"\nSaved {out} ({out.stat().st_size / 1e6:.1f} MB, {len(data['frames'])} frames). Open it in any browser.")
    return 0


def main(argv=None) -> int:
    config.load_env()
    ap = argparse.ArgumentParser(prog="python -m postdesk", description="Post Desk: Claude drafts, you approve, X posts.")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("run", help="start the desk and its dashboard")
    p.add_argument("--demo", action="store_true", help="a make-believe X account (no keys needed)")
    p.add_argument("--speed", type=float, default=60, help="demo only: simulated seconds per real second")
    p.add_argument("--warmup", type=float, default=14, help="demo only: simulated days before the dashboard opens")
    p.add_argument("--seed", type=int, default=7, help="demo only: which simulated account")
    p.add_argument("--ai", action="store_true", help="demo only: let Claude write the demo drafts (costs money)")
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--port", type=int, default=8788)
    p.add_argument("--no-browser", action="store_true")
    p.set_defaults(func=cmd_run)

    p = sub.add_parser("auth", help="connect your X account (OAuth 2.0, once)")
    p.add_argument("--port", type=int, default=8789)
    p.add_argument("--no-browser", action="store_true")
    p.set_defaults(func=cmd_auth)

    p = sub.add_parser("doctor", help="check settings, keys and the X connection")
    p.add_argument("--online", action="store_true", help="also ask X who you are (costs $0.001)")
    p.set_defaults(func=cmd_doctor)

    for name, fn, text in (("queue", cmd_queue, "drafts waiting for you"),
                           ("stats", cmd_stats, "what's working, media kit, payout progress")):
        p = sub.add_parser(name, help=text)
        p.add_argument("--demo", action="store_true")
        p.set_defaults(func=fn)

    for name, fn in (("approve", cmd_approve), ("reject", cmd_reject)):
        p = sub.add_parser(name, help=f"{name} drafts by id")
        p.add_argument("ids", nargs="+")
        p.add_argument("--demo", action="store_true")
        p.set_defaults(func=fn)

    p = sub.add_parser("add", help="your own post, approved, into the next open slot")
    p.add_argument("text")
    p.add_argument("--format", default="take")
    p.add_argument("--demo", action="store_true")
    p.set_defaults(func=cmd_add)

    p = sub.add_parser("draft", help="ask the writer for drafts now (they still need approval)")
    p.add_argument("--n", type=int, default=3)
    p.add_argument("--demo", action="store_true")
    p.set_defaults(func=cmd_draft)

    p = sub.add_parser("review", help="the nightly review, now (lessons + at most one proposal)")
    p.add_argument("--demo", action="store_true")
    p.add_argument("--ai", action="store_true", help="demo only: let Claude review the demo too")
    p.set_defaults(func=cmd_review)

    p = sub.add_parser("earned", help="log money the account made (payouts, sponsors, affiliates, products)")
    p.add_argument("usd", type=float)
    p.add_argument("--source", default="x payout", help="x payout | sponsor | affiliate | product | other")
    p.add_argument("--note", default="")
    p.add_argument("--demo", action="store_true")
    p.set_defaults(func=cmd_earned)

    p = sub.add_parser("sim", help="run the demo headless for days")
    p.add_argument("--days", type=float, default=14)
    p.add_argument("--seed", type=int, default=7)
    p.set_defaults(func=cmd_sim)

    p = sub.add_parser("replay", help="record the demo into one HTML file")
    p.add_argument("--days", type=float, default=2)
    p.add_argument("--warmup", type=float, default=12)
    p.add_argument("--seed", type=int, default=7)
    p.add_argument("--out", default=str(OUTPUT / "post-desk-replay.html"))
    p.add_argument("--fragment", action="store_true", help=argparse.SUPPRESS)
    p.set_defaults(func=cmd_replay)

    args = ap.parse_args(argv)
    try:
        return args.func(args)
    except KeyboardInterrupt:
        return 130


if __name__ == "__main__":
    sys.exit(main())
