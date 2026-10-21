"""Watchdog: a push to your phone when something needs you, and a short summary every evening.

  python watchdog.py              one check (the watchdog timer runs this every 5 minutes)
  python watchdog.py --test       send a test push
  python watchdog.py --summary    send today's summary now
  python watchdog.py --dry-run    print what it would send, send nothing

You hear about it when a desk stops or keeps crashing, goes quiet (running but saving nothing, usually
no prices), loses a lot in a day, has a green week (the bar the tournament waits for), or the nightly backup
stops happening. Pushes go through ntfy (free app,
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
UNITS = {"nightdesk": "Memecoin desks", "majors": "Big-coin desks", "paperbook": "Paper book and deck",
         "postdesk": "Post Desk"}
# What should keep saving while its service runs: name -> (service, file, minutes, label). The memecoin desks save
# every minute; a big-coin desk saves once per finished candle, so the slack is a candle and a half plus an hour.
QUIET = {"nightdesk": ("nightdesk", "night-desk/output/live/state.json", 20, "Memecoin desk"),
         "majors": ("majors", "majors-desk/output/live/state.json", 150, "Big-coin desk")}
for _b in ("wild", "strict", "sniper", "momentum", "patient", "scalper", "whale", "runner", "tiny"):
    QUIET[f"nightdesk-{_b}"] = ("nightdesk", f"night-desk/output/{_b}/live/state.json", 20, f"{_b.title()} memecoin desk")
for _b, _h in (("4h", 4), ("daily", 24), ("fast", 1), ("tight", 1), ("loose", 4), ("btc", 4), ("alts", 1),
               ("single", 1), ("slow", 24)):
    QUIET[f"majors-{_b}"] = ("majors", f"majors-desk/output/{_b}/live/state.json", 90 * _h + 60, f"Big-coin {_b} desk")


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
                verb = "are" if label.endswith("desks") else "is"
                out.append(Push(f"{label} {verb} running again", "Back to normal. Nothing was lost: open paper "
                                "positions were saved and picked up again.", 3, ("white_check_mark",)))
            u["bad"], u["alerted"] = 0, False
        else:
            u["bad"] += 1                                   # two checks in a row (5+ minutes), not a quick restart
            if u["bad"] >= 2 and not u["alerted"]:
                out.append(Push(f"{label} stopped", f"The service has been '{active}' for over 5 minutes. To see why, "
                                f"on the server run: journalctl -u {name} -n 30 --no-pager", 4, ("warning",)))
                u["alerted"] = True
        if restarts > u.get("restarts", restarts) and not u["alerted"] and _ago(now, u.get("crash_at"), 3):
            out.append(Push(f"{label} crashed and restarted",
                            f"{restarts} automatic restart{'s' if restarts > 1 else ''} so far. Running again, but if this "
                            f"keeps happening, check: journalctl -u {name} -n 50 --no-pager", 3, ("arrows_counterclockwise",)))
            u["crash_at"] = now.isoformat()
        u["restarts"] = restarts
        u["active"] = active
    return out


def check_quiet(now: datetime, state: dict, mtime_of: Callable[[Path], Optional[datetime]], root: Path = ROOT) -> List[Push]:
    """One push per service, however many of its desks have gone quiet at once (they share one price feed)."""
    out: List[Push] = []
    sent = state.setdefault("sent", {})
    quiet: Dict[str, List[Tuple[str, float]]] = {}
    for name, (unit, rel, minutes, label) in QUIET.items():
        if state.get("units", {}).get(unit, {}).get("active") != "active":
            continue                                        # a stopped desk is already reported as stopped
        m = mtime_of(root / rel)
        if m is None:
            continue
        age = (now - m).total_seconds() / 60
        if age > minutes and _ago(now, sent.get(f"quiet:{name}"), 6):
            quiet.setdefault(unit, []).append((label, age))
            sent[f"quiet:{name}"] = now.isoformat()
    for unit, desks in quiet.items():
        if len(desks) == 1:
            title = f"{desks[0][0]} has gone quiet"
            body = f"It's running but hasn't saved anything for {desks[0][1]:.0f} minutes, usually because it can't get prices."
        else:
            kind = UNITS[unit].lower().rstrip("s")
            title = f"{len(desks)} {kind}s have gone quiet"
            body = (f"They're running but haven't saved anything for {max(a for _, a in desks):.0f} minutes, usually "
                    f"because they can't get prices ({', '.join(label for label, _ in desks)}).")
        out.append(Push(title, body + f" To see why: journalctl -u {unit} -n 30 --no-pager", 4, ("zzz",)))
    return out


def check_losses(now: datetime, state: dict, book: pb.Book, limit_pct: float, night_limit_pct: float) -> List[Push]:
    out: List[Push] = []
    sent = state.setdefault("sent", {})
    today = now.astimezone(book.tz).date()
    for d in book.desks:
        bank = book.banks[d]
        day = pb.daily(book.trades[d], book.tz).get(today, 0.0)
        if not bank or day > -limit_pct / 100 * bank or sent.get(f"loss:{d}") == today.isoformat():
            continue
        body = f"{day / bank * 100:+.1f}% of its ${bank:,.0f} paper bank in trades closed today."
        if d == "memecoins" and day <= -night_limit_pct / 100 * bank:
            body += f" It hit its own {night_limit_pct:g}% daily limit, so it has stopped buying until tomorrow."
        out.append(Push(f"{book.label(d)} down {_usd(day)} today", body + " Paper money only.", 4, ("chart_with_downwards_trend",)))
        sent[f"loss:{d}"] = today.isoformat()
    return out


def check_green(now: datetime, state: dict, book: pb.Book) -> List[Push]:
    """The push the whole tournament waits for: a desk has a green week (deck.week). Once per desk per week."""
    import deck

    out: List[Push] = []
    sent = state.setdefault("sent", {})
    today = now.astimezone(book.tz).date()
    for d in book.desks:
        w = deck.week(book, d, today)
        if not w["green_week"] or not _ago(now, sent.get(f"green:{d}"), 24 * 7):
            continue
        sent[f"green:{d}"] = now.isoformat()
        times = f", {w['streak']} weeks in a row" if w["streak"] > 1 else ""
        out.append(Push(f"{book.label(d)} has a green week{times}",
                        f"{_usd(w['net'])} over the last 7 days: {w['green']} green day{'s' if w['green'] != 1 else ''}, "
                        f"{w['red']} red, traded on {w['traded']} of 7, and no day lost more than the week made. "
                        "Paper money only: one green week is a start, not proof.", 3, ("seedling",)))
    return out


def check_backup(now: datetime, state: dict, newest: Optional[datetime], folder_exists: bool) -> List[Push]:
    sent = state.setdefault("sent", {})
    if not folder_exists or (newest and now - newest < timedelta(hours=50)) or not _ago(now, sent.get("backup"), 24):
        return []
    sent["backup"] = now.isoformat()
    return [Push("Nightly backup missing", "No backup of the paper records in over two days. On the server run: "
                 "sudo bash server/backup.sh", 3, ("floppy_disk",))]


def summary(book: pb.Book, day: date) -> Push:
    """The evening push: every desk's day with a few desks; with a crowd of them, today's best and worst, the
    week's best and worst, and which desks have a green week (deck.week) so far."""
    import deck

    lines, today_total, since_total, rows = [], 0.0, 0.0, []
    for d in book.desks:
        trades = book.trades[d]
        closed = [t for t in trades if t.closed.astimezone(book.tz).date() == day]
        today_pnl, net = sum(t.pnl for t in closed), sum(t.pnl for t in trades)
        today_total += today_pnl
        since_total += net
        rows.append((d, today_pnl, len(closed), net, deck.week(book, d, day)))
    if len(rows) <= 6:
        lines += [f"{book.label(d)}: {_usd(t)} today ({n} closed) · {_usd(net)} since the start" for d, t, n, net, _ in rows]
    else:
        active = [r for r in rows if r[2]]
        if active:
            best, worst = max(active, key=lambda r: r[1]), min(active, key=lambda r: r[1])
            lines.append(f"Today: {len(active)} of {len(rows)} desks traded · best {book.label(best[0])} {_usd(best[1])}"
                         + (f" · worst {book.label(worst[0])} {_usd(worst[1])}" if worst is not best else ""))
        else:
            lines.append(f"Today: none of the {len(rows)} desks closed a trade")
        weekly = [r for r in rows if r[4]["traded"]]
        if weekly:
            best, worst = max(weekly, key=lambda r: r[4]["net"]), min(weekly, key=lambda r: r[4]["net"])
            lines.append(f"Last 7 days: best {book.label(best[0])} {_usd(best[4]['net'])} · worst {book.label(worst[0])} "
                         f"{_usd(worst[4]['net'])}")
        green = [book.label(d) + (f" ×{w['streak']}" if w["streak"] > 1 else "") for d, _, _, _, w in rows if w["green_week"]]
        lines.append("Green week: " + (", ".join(green) if green else "none yet"))
    held = [h for d in book.desks for h in book.held[d]]
    bank = book.bank_total
    lines.append(f"All desks: {_usd(since_total)} ({since_total / bank * 100:+.1f}% of ${bank:,.0f})"
                 + (f" · {len(held)} open, {_usd(book.unrealized)} not banked" if held else ""))
    if book.benchmark:
        lines.append(benchmark.line(book))
    # on a date the book is read (first look, month end): the ranking, top and bottom, in the same push
    reads = {deck._as_date(when): label for label, when in (book.checkpoints or {}).items() if deck._as_date(when)}
    title = f"Paper book · {day:%a %d %b}: {_usd(today_total)} today"
    if day in reads and len(rows) > 1:
        ranked = sorted(rows, key=lambda r: (-(r[3] / book.banks[r[0]]), book.desks.index(r[0])))
        line = lambda r: f"{book.label(r[0])} {_usd(r[3])} ({r[3] / book.banks[r[0]] * 100:+.1f}%)".replace("(-", "(−")  # noqa: E731
        n = min(5, len(ranked) // 2)
        lines.insert(0, f"{reads[day].capitalize()}, day {day:%d %b}. Top {n}: " + "; ".join(line(r) for r in ranked[:n]) + ".")
        lines.insert(1, f"Bottom {n}: " + "; ".join(line(r) for r in ranked[-n:]) + ".")
        title = f"{reads[day].capitalize()} · {day:%a %d %b}: {_usd(since_total)} since the start"
    return Push(title, "\n".join(lines), 2, ("spider",))


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
    pushes += check_losses(now, state, book, limit, night) + check_green(now, state, book)
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
