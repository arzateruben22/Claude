import json
import sys
from datetime import datetime, time, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import paperbook as pb  # noqa: E402
import watchdog as wd  # noqa: E402

LA = ZoneInfo("America/Los_Angeles")
NOW = datetime(2026, 10, 9, 19, 0, tzinfo=timezone.utc)          # Fri 09 Oct, noon in Los Angeles


def book(memes=(), majors=()):
    return pb.Book({"memecoins": list(memes), "majors": list(majors), "stocks": []}, {d: [] for d in pb.DESKS},
                   {d: 100.0 for d in pb.DESKS}, {}, False, NOW, LA)


def trade(desk, pnl, at=NOW - timedelta(hours=1)):
    return pb.Trade(desk, "$X", at - timedelta(minutes=30), at, float(pnl), float(pnl), "stop")


def titles(pushes):
    return [p.title for p in pushes]


def test_a_stopped_desk_is_reported_once_and_its_return_too():
    state, status = {}, {"nightdesk": ("active", 0)}
    units = lambda n: status[n]                                     # noqa: E731
    assert wd.check_units(NOW, state, units, ["nightdesk"]) == []
    status["nightdesk"] = ("activating", 0)                         # a quick restart: not worth a push
    assert wd.check_units(NOW, state, units, ["nightdesk"]) == []
    status["nightdesk"] = ("failed", 0)
    assert titles(wd.check_units(NOW, state, units, ["nightdesk"])) == ["Memecoin desk stopped"]
    assert wd.check_units(NOW, state, units, ["nightdesk"]) == []   # once, not every 5 minutes
    status["nightdesk"] = ("active", 0)
    assert titles(wd.check_units(NOW, state, units, ["nightdesk"])) == ["Memecoin desk is running again"]


def test_crashes_are_reported_but_not_every_time():
    state, status = {}, {"majors": ("active", 0)}
    units = lambda n: status[n]                                     # noqa: E731
    wd.check_units(NOW, state, units, ["majors"])
    status["majors"] = ("active", 1)
    assert titles(wd.check_units(NOW, state, units, ["majors"])) == ["Big-coin desk crashed and restarted itself"]
    status["majors"] = ("active", 2)
    assert wd.check_units(NOW + timedelta(hours=1), state, units, ["majors"]) == []
    status["majors"] = ("active", 3)
    assert len(wd.check_units(NOW + timedelta(hours=4), state, units, ["majors"])) == 1


def test_a_running_desk_that_saves_nothing_has_gone_quiet(tmp_path):
    state = {"units": {"majors": {"active": "active"}, "nightdesk": {"active": "failed"}}}
    old = lambda p: NOW - timedelta(hours=3)                        # noqa: E731
    pushes = wd.check_quiet(NOW, state, old, tmp_path)
    assert titles(pushes) == ["Big-coin desk has gone quiet"]       # the stopped one is reported as stopped instead
    assert wd.check_quiet(NOW + timedelta(hours=1), state, old, tmp_path) == []
    later = NOW + timedelta(hours=8)
    fresh = lambda p: later - timedelta(minutes=10)                 # noqa: E731
    assert wd.check_quiet(later, state, fresh, tmp_path) == []


def test_a_bad_day_is_reported_once():
    state = {}
    b = book(memes=[trade("memecoins", -9), trade("memecoins", -7)], majors=[trade("majors", -3)])
    pushes = wd.check_losses(NOW, state, b, 10.0, 15.0)
    assert titles(pushes) == ["Memecoins down −$16.00 today"] and "stopped buying until tomorrow" in pushes[0].body
    assert wd.check_losses(NOW + timedelta(hours=1), state, b, 10.0, 15.0) == []
    yesterday = book(memes=[trade("memecoins", -30, NOW - timedelta(days=1))])
    assert wd.check_losses(NOW, {}, yesterday, 10.0, 15.0) == []     # only today's closed trades count


def test_missing_backups():
    state = {}
    assert wd.check_backup(NOW, state, None, False) == []          # backups not set up: nothing to say
    assert titles(wd.check_backup(NOW, state, NOW - timedelta(days=3), True)) == ["Nightly backup missing"]
    assert wd.check_backup(NOW + timedelta(hours=2), state, NOW - timedelta(days=3), True) == []
    assert wd.check_backup(NOW, {}, NOW - timedelta(hours=20), True) == []


def test_the_evening_summary_comes_once_a_day():
    state = {}
    b = book(memes=[trade("memecoins", 4.5), trade("memecoins", -1)], majors=[trade("majors", 2, NOW - timedelta(days=1))])
    assert wd.check_summary(NOW, state, b, time(20, 0)) == []          # noon: too early
    evening = NOW + timedelta(hours=8, minutes=5)
    pushes = wd.check_summary(evening, state, b, time(20, 0))
    assert titles(pushes) == ["Paper book · Fri 09 Oct: +$3.50 today"]
    body = pushes[0].body
    assert "Memecoins: +$3.50 today (2 closed)" in body and "Big coins: $0.00 today (0 closed) · +$2.00 since the start" in body
    assert "All desks: +$5.50 (+1.8% of $300)" in body
    assert wd.check_summary(evening + timedelta(hours=1), state, b, time(20, 0)) == []


def test_one_full_run_with_everything_fine():
    state = {}
    fine = dict(units=lambda n: ("active", 0), mtime_of=lambda p: NOW, book_of=book, backups=(NOW, True))
    assert wd.run_once(NOW, state, **fine) == []
    json.dumps(state)                                                  # the state file must stay plain JSON


def test_pushes_travel_as_json(monkeypatch):
    sent = {}

    class Resp:
        def read(self):
            return b"{}"

    def fake_urlopen(req, timeout):
        sent["url"], sent["body"] = req.full_url, json.loads(req.data.decode())
        return Resp()

    monkeypatch.setattr(wd.urllib.request, "urlopen", fake_urlopen)
    wd.send(wd.Push("Memecoins down −$16.00 today", "body · paper", 4, ("warning",)), "desks-abc")
    assert sent["url"] == "https://ntfy.sh" and sent["body"]["topic"] == "desks-abc"
    assert sent["body"]["title"] == "Memecoins down −$16.00 today" and sent["body"]["priority"] == 4


def test_topic_comes_from_the_alerts_file(tmp_path, monkeypatch):
    f = tmp_path / ".alerts"
    monkeypatch.delenv("NTFY_TOPIC", raising=False)
    monkeypatch.setattr(wd, "ALERTS", f)
    assert wd.topic() is None
    f.write_text("NTFY_TOPIC=desks-1234abcd\n")
    assert wd.topic() == "desks-1234abcd"
