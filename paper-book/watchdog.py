"""Watchdog: a push to your phone when something needs you, and a short summary every evening.

  python watchdog.py              one check (the watchdog timer runs this every 5 minutes)
  python watchdog.py --test       send a test push
  python watchdog.py --summary    send today's summary now
  python watchdog.py --dry-run    print what it would send, send nothing

You hear about it when a desk stops or keeps crashing, goes quiet (running but saving nothing, usually
no prices), loses a lot in a day, or the nightly backup stops happening. Pushes go through ntfy (free app,
no account) to the topic in ../server/.alerts, made by server/alerts.sh. Without a topic it does nothing.
It only reads: paper money only, and it never changes a desk.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import urllib.request
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from typing import Callable, Dict, List, Optional, Tuple

try:
    import tomllib
except ModuleNotFoundError:  # Python 3.10
    import tomli as tomllib  # type: ignore[no-redef]

import benchmark
import paperbook as pb

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
ALERTS = ROOT / "server" / ".alerts"
STATE = HERE / "output" / "watchdog.json"
BACKUPS = Path("/var/backups/desks")
NTFY = "https://ntfy.sh"
UNITS = {"nightdesk": "Memecoin desk", "majors": "Big-coin desk", "paperbook": "Paper book and crawler",
         "postdesk": "Post Desk"}
QUIET = {"nightdesk": ("night-desk/output/live/state.json", 20),     # saves every minute
         "majors": ("majors-desk/output/live/state.json", 150)}       # saves every hour
DESK_OF = {"memecoins": "Memecoins", "majors": "Big coins", "stocks": "Stocks"}


@dataclass
class Push:
    title: str
    body: str
    priority: int = 3           # ntfy: 1 min, 3 default, 4 high, 5 urgent
    tags: Tuple[str, ...] = ()


def topic() -> Optional[str]:
    t = os.getenv("NTFY_TOPIC", "")
    if not t and ALERTS.exists():
        for line in ALERTS.read_text().splitlines():
            if line.startswith("NTFY_TOPIC="):
                t = line.split("=", 1)[1].strip()
    return t or None


def send(p: Push, to: str, server: str = NTFY) -> None:
    body = json.dumps({"topic": to, "title": p.title, "message": p.body, "priority": p.priority,
                       "tags": list(p.tags)}).encode()
    req = urllib.request.Request(server, data=body, method="POST", headers={"Content-Type": "application/json"})
    urllib.request.urlopen(req, timeout=15).read()


def unit_state(name: str) -> Tuple[str, int]:
    """(ActiveState, NRestarts) from systemd."""
    try:
        out = subprocess.run(["systemctl", "show", f"{name}.service", "-p", "ActiveState", "-p", "NRestarts"],
                             capture_output=True, text=True, timeout=10).stdout
    except (OSError, subprocess.SubprocessError):
        return "unknown", 0
    vals = dict(line.split("=", 1) for line in out.splitlines() if "=" in line)
    return vals.get("ActiveState", "unknown"), int(vals.get("NRestarts") or 0)


def mtime(path: Path) -> Optional[datetime]:
    try:
        return datetime.fromtimestamp(path.stat().st_mtime, timezone.utc)
    except OSError:
        return None


def newest_backup(folder: Path = BACKUPS) -> Optional[datetime]:
    try:
        stamps = [mtime(p) for p in folder.glob("desks-*.tar.gz")]
    except OSError:
        return None
    stamps = [s for s in stamps if s]
    return max(stamps) if stamps else None


def _usd(v: float) -> str:
    return pb._usd(round(v, 2))


def _ago(now: datetime, iso: Optional[str], hours: float) -> bool:
    return not iso or now - datetime.fromisoformat(iso) >= timedelta(hours=hours)


# -- the checks ------------------------------------------------------------------------------------

def check_units(now: datetime, state: dict, units: Callable[[str], Tuple[str, int]], names: List[str]) -> List[Push]:
    out: List[Push] = []
    seen = state.setdefault("units", {})
    for name in names:
        active, restarts = units(name)
        u = seen.setdefault(name, {"bad": 0, "alerted": False, "restarts": restarts})
        label = UNITS[name]
        if active == "active":
            if u["alerted"]:
                out.append(Push(f"{label} is running again", "Back to normal. Nothing was lost: open paper "
                                "positions were saved and picked up again.", 3, ("white_check_mark",)))
            u["bad"], u["alerted"] = 0, False
        else:
            u["bad"] += 1                                   # two checks in a row (5+ minutes), not a quick restart
            if u["bad"] >= 2 and not u["alerted"]:
                out.append(Push(f"{label} stopped", f"It has been '{active}' for over 5 minutes. To see why, on the "
                                f"server run: journalctl -u {name} -n 30 --no-pager", 4, ("warning",)))
                u["alerted"] = True
        if restarts > u.get("restarts", restarts) and not u["alerted"] and _ago(now, u.get("crash_at"), 3):
            out.append(Push(f"{label} crashed and restarted itself",
                            f"{restarts} automatic restart{'s' if restarts > 1 else ''} so far. It's running, but if this "
                            f"keeps happening, check: journalctl -u {name} -n 50 --no-pager", 3, ("arrows_counterclockwise",)))
            u["crash_at"] = now.isoformat()
        u["restarts"] = restarts
        u["active"] = active
    return out


def check_quiet(now: datetime, state: dict, mtime_of: Callable[[Path], Optional[datetime]], root: Path = ROOT) -> List[Push]:
    out: List[Push] = []
    sent = state.setdefault("sent", {})
    for name, (rel, minutes) in QUIET.items():
        if state.get("units", {}).get(name, {}).get("active") != "active":
            continue                                        # a stopped desk is already reported as stopped
        m = mtime_of(root / rel)
        if m is None:
            continue
        age = (now - m).total_seconds() / 60
        if age > minutes and _ago(now, sent.get(f"quiet:{name}"), 6):
            out.append(Push(f"{UNITS[name]} has gone quiet",
                            f"It's running but hasn't saved anything for {age:.0f} minutes, usually because it can't get "
                            f"prices. To see why: journalctl -u {name} -n 30 --no-pager", 4, ("zzz",)))
            sent[f"quiet:{name}"] = now.isoformat()
    return out


def check_losses(now: datetime, state: dict, book: pb.Book, limit_pct: float, night_limit_pct: float) -> List[Push]:
    out: List[Push] = []
    sent = state.setdefault("sent", {})
    today = now.astimezone(book.tz).date()
    for d in pb.DESKS:
        bank = book.banks[d]
        day = pb.daily(book.trades[d], book.tz).get(today, 0.0)
        if not bank or day > -limit_pct / 100 * bank or sent.get(f"loss:{d}") == today.isoformat():
            continue
        body = f"{day / bank * 100:+.1f}% of its ${bank:,.0f} paper bank in trades closed today."
        if d == "memecoins" and day <= -night_limit_pct / 100 * bank:
            body += f" It hit its own {night_limit_pct:g}% daily limit, so it has stopped buying until tomorrow."
        out.append(Push(f"{DESK_OF[d]} down {_usd(day)} today", body + " Paper money only.", 4, ("chart_with_downwards_trend",)))
        sent[f"loss:{d}"] = today.isoformat()
    return out


def check_backup(now: datetime, state: dict, newest: Optional[datetime], folder_exists: bool) -> List[Push]:
    sent = state.setdefault("sent", {})
    if not folder_exists or (newest and now - newest < timedelta(hours=50)) or not _ago(now, sent.get("backup"), 24):
        return []
    sent["backup"] = now.isoformat()
    return [Push("Nightly backup missing", "No backup of the paper records in over two days. On the server run: "
                 "sudo bash server/backup.sh", 3, ("floppy_disk",))]


def summary(book: pb.Book, day: date) -> Push:
    lines, today_total, since_total = [], 0.0, 0.0
    for d in pb.DESKS:
        trades = book.trades[d]
        closed = [t for t in trades if t.closed.astimezone(book.tz).date() == day]
        today_pnl, net = sum(t.pnl for t in closed), sum(t.pnl for t in trades)
        today_total += today_pnl
        since_total += net
        lines.append(f"{DESK_OF[d]}: {_usd(today_pnl)} today ({len(closed)} closed) · {_usd(net)} since the start")
    held = [h for d in pb.DESKS for h in book.held[d]]
    bank = sum(book.banks.values())
    lines.append(f"All desks: {_usd(since_total)} ({since_total / bank * 100:+.1f}% of ${bank:,.0f})"
                 + (f" · {len(held)} open, {_usd(book.unrealized)} not banked" if held else ""))
    if book.benchmark:
        lines.append(benchmark.line(book))
    return Push(f"Paper book · {day:%a %d %b}: {_usd(today_total)} today", "\n".join(lines), 2, ("spider",))


def check_summary(now: datetime, state: dict, book: pb.Book, at: time) -> List[Push]:
    sent = state.setdefault("sent", {})
    local = now.astimezone(book.tz)
    if local.time() < at or sent.get("summary") == local.date().isoformat():
        return []
    sent["summary"] = local.date().isoformat()
    return [summary(book, local.date())]


# -- one run ---------------------------------------------------------------------------------------

def settings(path: Path = HERE / "book.toml") -> Tuple[dict, float, time, float]:
    with open(path, "rb") as fh:
        cfg = tomllib.load(fh)
    a = cfg.get("alerts", {})
    hh, mm = (int(x) for x in str(a.get("summary_at", "20:00")).split(":"))
    night = 15.0
    try:
        with open(ROOT / "night-desk" / "desk.toml", "rb") as fh:
            night = float(tomllib.load(fh).get("risk", {}).get("daily_loss_limit_pct", night))
    except OSError:
        pass
    return cfg, float(a.get("day_loss_pct", 10.0)), time(hh, mm), night


def run_once(now: datetime, state: dict, *, units=unit_state, mtime_of=mtime, book_of=None,
             backups: Tuple[Optional[datetime], bool] = None) -> List[Push]:
    cfg, limit, at, night = settings()
    names = [n for n in UNITS if n != "postdesk" or (ROOT / "post-desk" / ".secrets" / "x_tokens.json").exists()]
    pushes = check_units(now, state, units, names) + check_quiet(now, state, mtime_of)
    try:
        book = book_of() if book_of else pb.load(cfg, False, now)
    except Exception as exc:  # a half-written file: say so once a day rather than fail silently
        sent = state.setdefault("sent", {})
        if _ago(now, sent.get("book"), 24):
            sent["book"] = now.isoformat()
            pushes.append(Push("Couldn't read the paper results", f"{type(exc).__name__}: {exc}", 3, ("warning",)))
        return pushes
    pushes += check_losses(now, state, book, limit, night)
    if backups is None:
        backups = (newest_backup(), BACKUPS.is_dir())
    pushes += check_backup(now, state, *backups)
    if now.astimezone(book.tz).time() >= at and state.get("sent", {}).get("summary") != now.astimezone(book.tz).date().isoformat():
        book.benchmark = benchmark.load(HERE / "output", book)
        pushes += check_summary(now, state, book, at)
    return pushes


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="python watchdog.py", description="Phone alerts for the desks.")
    ap.add_argument("--test", action="store_true", help="send a test push")
    ap.add_argument("--summary", action="store_true", help="send today's summary now")
    ap.add_argument("--dry-run", action="store_true", help="print what would be sent")
    args = ap.parse_args(argv)
    to = topic()
    if not to and not args.dry_run:
        print("No alerts topic yet. Set one up with: bash server/alerts.sh")
        return 0
    now = datetime.now(timezone.utc)
    if args.test:
        pushes = [Push("Alerts are on", "You'll hear from the desks if one stops, goes quiet or has a bad day, plus a "
                       "summary every evening. Paper money only.", 3, ("spider",))]
    elif args.summary:
        cfg = settings()[0]
        book = pb.load(cfg, False, now)
        book.benchmark = benchmark.load(HERE / "output", book)
        pushes = [summary(book, now.astimezone(book.tz).date())]
    else:
        try:
            state = json.loads(STATE.read_text())
        except (OSError, ValueError):
            state = {}
        pushes = run_once(now, state)
        STATE.parent.mkdir(parents=True, exist_ok=True)
        tmp = STATE.with_suffix(".tmp")
        tmp.write_text(json.dumps(state))
        tmp.replace(STATE)
    failed = 0
    for p in pushes:
        if args.dry_run:
            print(f"[{p.priority}] {p.title}\n    {p.body}")
            continue
        try:
            send(p, to)
        except Exception as exc:  # offline: the next check tries again for anything still wrong
            failed += 1
            print(f"couldn't send '{p.title}': {exc}", file=sys.stderr)
    if args.test and not args.dry_run and not failed:
        print(f"Sent a test push to ntfy topic {to}.")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
