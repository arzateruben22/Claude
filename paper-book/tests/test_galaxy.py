import http.client
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import galaxy  # noqa: E402
import paperbook as pb  # noqa: E402

LA = ZoneInfo("America/Los_Angeles")
NOW = datetime(2026, 10, 8, 20, 0, tzinfo=timezone.utc)


def trades(desk, n, start=datetime(2026, 9, 1, 17, tzinfo=timezone.utc), every=timedelta(hours=7), pnl=lambda i: 10 if i % 3 else -5,
           symbol=lambda i: f"S{i % 6}", exit_=lambda i: "target" if i % 3 else "stop", held=timedelta(minutes=40)):
    out = []
    for i in range(n):
        closed = start + i * every
        out.append(pb.Trade(desk, symbol(i), closed - held, closed, float(pnl(i)), float(pnl(i)), exit_(i)))
    return out


def book(memes=0, majors=0, stocks=0, **kw):
    t = {"memecoins": trades("memecoins", memes, **kw), "majors": trades("majors", majors, **kw),
         "stocks": trades("stocks", stocks, **kw)}
    return pb.Book(t, {d: [] for d in pb.DESKS}, {d: 1000.0 for d in pb.DESKS}, {}, False, NOW, LA)


def by_id(pats):
    return {p["id"]: p for p in pats}


def test_constellations_unlock_with_enough_trades():
    few = by_id(galaxy.desk_patterns("majors", trades("majors", 10), LA))
    assert not few["majors:exits"]["unlocked"] and "(10 to go)" in few["majors:exits"]["detail"]
    some = by_id(galaxy.desk_patterns("majors", trades("majors", 25), LA))
    assert some["majors:exits"]["unlocked"] and "'target' exits" in some["majors:exits"]["detail"]
    assert some["majors:sources"]["unlocked"] and some["majors:sources"]["symbols"]
    assert not some["majors:hold"]["unlocked"] and not some["majors:hours"]["unlocked"]
    many = by_id(galaxy.desk_patterns("majors", trades("majors", 60), LA))
    assert many["majors:hold"]["unlocked"] and many["majors:hours"]["unlocked"]


def test_stocks_get_weekdays_not_hours():
    ids = set(by_id(galaxy.desk_patterns("stocks", trades("stocks", 60, every=timedelta(days=1)), LA)))
    assert "stocks:weekday" in ids and "stocks:hours" not in ids and "stocks:hold" not in ids


def test_streaks_and_concentration():
    p = by_id(galaxy.desk_patterns("memecoins", trades("memecoins", 30, pnl=lambda i: 5 if i < 12 else -5,
                                                       symbol=lambda i: "ONE" if i < 12 else f"X{i}"), LA))
    assert "12 in a row" in p["memecoins:streaks"]["detail"] and "18" in p["memecoins:streaks"]["detail"]
    assert "ONE made 100%" in p["memecoins:sources"]["detail"] and "carrying" in p["memecoins:sources"]["detail"]


def test_desks_compared_once_they_share_enough_days():
    b = book(memes=40, majors=40, every=timedelta(days=1))
    shared = by_id(galaxy.shared_patterns(b))
    assert shared["memecoins+majors"]["unlocked"] and "same days" in shared["memecoins+majors"]["detail"]   # identical P&L
    assert not shared["memecoins+stocks"]["unlocked"]
    opposite = book(memes=20, majors=20, every=timedelta(days=1))
    opposite.trades["majors"] = [pb.Trade("majors", t.symbol, t.opened, t.closed, -t.pnl, -t.pnl_pct, t.exit)
                                 for t in opposite.trades["majors"]]
    assert "opposite" in by_id(galaxy.shared_patterns(opposite))["memecoins+majors"]["detail"]


def test_milestones():
    m = {x["title"]: x for x in galaxy.milestones(book(memes=30, majors=5, stocks=3))}
    assert m["First light"]["at"] and m["10 trades"]["at"] and not m["100 trades"]["at"]
    assert m["Every desk trading"]["at"] and m["$100 of paper profit"]["at"]
    assert not galaxy.milestones(book())[0]["at"]


def test_page_data_and_safety(tmp_path):
    b = book(memes=25, majors=8, symbol=lambda i: "<script>" if i == 0 else f"S{i % 4}")
    b.held["majors"] = [pb.Holding("majors", "XRP", NOW - timedelta(hours=3), 60.0, 55.0, "")]
    payload = galaxy.write(b, tmp_path)
    assert [d["key"] for d in payload["desks"]] == list(pb.DESKS)
    assert len(payload["trades"]) == 33 and payload["trades"] == sorted(payload["trades"], key=lambda r: r[1])
    assert any(s["s"] == "XRP" for s in payload["symbols"]) and payload["held"][0][3] == 55.0
    page = (tmp_path / "galaxy.html").read_text()
    blob = page.split("window.PAPER_GALAXY=", 1)[1].split(";</script>", 1)[0]
    assert "</script" not in blob and "<title>Paper Galaxy</title>" in page
    assert json.loads((tmp_path / "galaxy.json").read_text())["meta"]["demo"] is False
    assert not (tmp_path / "galaxy.fragment.html").read_text().startswith("<!doctype")


def test_served_read_only(tmp_path):
    (tmp_path / "crawler.html").write_text("<p>crawler</p>")
    (tmp_path / "galaxy.html").write_text("<p>galaxy</p>")
    (tmp_path / "secret.txt").write_text("no")
    server = pb.serve(tmp_path, "127.0.0.1", 0)
    port = server.server_address[1]

    def get(path, host="127.0.0.1"):
        c = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
        c.request("GET", path, headers={"Host": host})
        r = c.getresponse()
        return r.status, r.read()

    try:
        assert get("/") == (200, b"<p>crawler</p>") and get("/galaxy") == (200, b"<p>galaxy</p>")
        assert get("/secret.txt")[0] == 404 and get("/../book.toml")[0] == 404
        assert get("/book")[0] == 404                      # not written yet
        assert get("/", host="evil.example")[0] == 403
    finally:
        server.shutdown()
        server.server_close()
