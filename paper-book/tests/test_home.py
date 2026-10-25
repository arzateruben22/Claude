"""Home: the trading desks and Post Desk side by side, on the first page of port 8790."""
import http.client
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import home  # noqa: E402
import paperbook as pb  # noqa: E402

LA = ZoneInfo("America/Los_Angeles")
NOW = datetime(2026, 10, 25, 22, 0, tzinfo=timezone.utc)          # Sun 25 Oct, 15:00 in Los Angeles


def book():
    t = lambda d, pnl, h: pb.Trade(d, "$X", NOW - timedelta(hours=h + 1), NOW - timedelta(hours=h), pnl, pnl / 10, "x")  # noqa: E731
    trades = {"memecoins_sniper": [t("memecoins_sniper", 40.0, 2), t("memecoins_sniper", -10.0, 30)],
              "majors_trend": [t("majors_trend", -25.0, 50)], "stocks": []}
    held = {"memecoins_sniper": [], "majors_trend": [pb.Holding("majors_trend", "BTC", NOW, 500.0, 520.0, "")], "stocks": []}
    meta = {"memecoins_sniper": pb.desk_meta("memecoins_sniper", {"label": "Sniper memecoins", "market": "memecoins"}),
            "majors_trend": pb.desk_meta("majors_trend", {"label": "Big coins trend filter", "market": "big coins"}),
            "stocks": pb.desk_meta("stocks", {})}
    b = pb.Book(trades, held, {d: 1000.0 for d in trades}, {}, False, NOW, LA, meta=meta, order=tuple(trades),
                checkpoints={"month end": "2026-10-31"})
    b.weather = {"demo": False, "trends": [{"symbol": "BTC", "pct": 10.9, "above": True}],
                 "mood": {"value": 68, "label": "Greed", "date": "2026-10-25"}}
    return b


def status(folder, **over):
    s = {"v": 1, "updated": NOW.isoformat(), "stopped": False, "mode": "live", "handle": "ruben", "pill": "ON AIR",
         "approval": "review", "port": 8788, "waiting": 3, "ready": 2, "posts_today": 4, "slots_today": 8,
         "next_at": "16:50", "followers": 335, "followers_7d": 12, "views_7d": 23598, "writer_error": "",
         "preview": [{"format": "dilemma", "text": 'Couple at brunch. <b>He</b>: "split it."'}]}
    s.update(over)
    (folder / "live").mkdir(parents=True, exist_ok=True)
    (folder / "live" / "status.json").write_text(json.dumps(s))


def test_the_trading_card_adds_up_every_desk():
    t = home.trading(book())
    assert (t["desks"], t["bank"], t["net"], t["open"], t["trades"], t["holding"]) == (3, 3000.0, 5.0, 20.0, 3, 1)
    assert t["pct"] == round(25 / 3000 * 100, 2) and t["today"] == {"pnl": 40.0, "closed": 1}
    assert t["best"] == {"label": "Sniper memecoins", "pct": 3.0} and t["worst"]["label"] == "Big coins trend filter"
    assert t["idle"] == 1 and t["next"] == {"label": "month end", "date": "2026-10-31"}
    assert t["weather"]["btc"] == {"pct": 10.9, "above": True} and t["weather"]["mood"]["value"] == 68


def test_the_post_desk_card_knows_running_stopped_and_not_set_up(tmp_path):
    assert home.post_desk(NOW, folder=tmp_path)["state"] == "not set up"
    status(tmp_path)
    assert home.post_desk(NOW + timedelta(minutes=2), folder=tmp_path)["state"] == "running"
    assert home.post_desk(NOW + timedelta(minutes=4), folder=tmp_path)["state"] == "stopped"     # silent: not running
    status(tmp_path, stopped=True)
    assert home.post_desk(NOW, folder=tmp_path)["state"] == "stopped"
    (tmp_path / "live" / "status.json").write_text("{half")
    assert home.post_desk(NOW, folder=tmp_path)["state"] == "not set up"


def test_the_page_shows_both_apps_and_links_post_desk_on_the_same_address(tmp_path):
    status(tmp_path)
    t = home.trading(book())
    page = home.render(t, home.post_desk(NOW, folder=tmp_path), host="100.101.7.8", now=NOW)
    assert "<title>Desks</title>" in page and "Open the Trading Deck" in page and 'href="/deck"' in page
    assert 'href="http://100.101.7.8:8788/"' in page and "Open Post Desk" in page
    assert "3<small> drafts waiting for you" in page and "@ruben" in page and "ON AIR" in page
    assert "&lt;b&gt;He&lt;/b&gt;" in page and "<b>He</b>" not in page                         # drafts are escaped
    assert "BTC</b> above its 150-day line" in page and "fear &amp; greed</b> 68" in page
    assert "month end</b> Sat 31 Oct · in 6 days" in page
    assert 'rel="manifest"' in page and 'rel="apple-touch-icon"' in page
    empty = home.render(t, {"state": "not set up"}, now=NOW)
    assert "Not connected" in empty and "bash server/connect-x.sh" in empty and "Open Post Desk" not in empty
    status(tmp_path, stopped=True)
    stopped = home.render(t, home.post_desk(NOW, folder=tmp_path), now=NOW)
    assert "STOPPED" in stopped and "sudo systemctl restart postdesk" in stopped


def test_every_build_writes_the_home_screen_and_the_app_icon(tmp_path):
    out = tmp_path / "out"
    home.write(book(), out)
    assert json.loads((out / "home.json").read_text())["desks"] == 3
    m = json.loads((out / "manifest.webmanifest").read_text())
    assert m["start_url"] == "/" and m["display"] == "standalone" and {i["sizes"] for i in m["icons"]} == {"180x180", "512x512"}
    assert (out / "icon-180.png").read_bytes()[:8] == b"\x89PNG\r\n\x1a\n" and (out / "home.html").exists()


def test_the_server_makes_the_home_page_for_each_request(tmp_path, monkeypatch):
    out = tmp_path / "out"
    home.write(book(), out)
    monkeypatch.setattr(home, "POST", tmp_path / "post")
    status(tmp_path / "post", updated=datetime.now(timezone.utc).isoformat(), waiting=7)
    server = pb.serve(out, "127.0.0.1", 0)
    try:
        c = http.client.HTTPConnection("127.0.0.1", server.server_address[1], timeout=5)
        c.request("GET", "/", headers={"Host": "127.0.0.1"})
        r = c.getresponse()
        body = r.read().decode()
        assert r.status == 200 and "7<small> drafts waiting for you" in body          # read now, not at the last build
        assert 'href="http://127.0.0.1:8788/"' in body
        c.request("GET", "/icon-180.png", headers={"Host": "127.0.0.1"})
        r = c.getresponse()
        assert r.status == 200 and r.getheader("Content-Type") == "image/png" and r.read()[:4] == b"\x89PNG"
        c.request("GET", "/manifest.webmanifest", headers={"Host": "127.0.0.1"})
        r = c.getresponse()
        assert r.getheader("Content-Type") == "application/manifest+json" and json.loads(r.read())["name"] == "Desks"
    finally:
        server.shutdown()
        server.server_close()
