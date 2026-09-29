from datetime import timedelta

from scanner import html_report, notify, report
from scanner.config import load_criteria
from scanner.engine import run_scan
from scanner.market import parse_pt
from scanner.models import NewsItem
from scanner.providers.demo import DemoProvider

CRIT = load_criteria()


def _res(at="2026-09-28 05:45", session="premarket"):
    return run_scan(DemoProvider(), CRIT, parse_pt(at), session)


def test_page_is_a_complete_document():
    page = html_report.page(_res(), CRIT)
    assert page.startswith("<!doctype html>") and page.rstrip().endswith("</html>")
    assert page.index("</head>") < page.index("<body>") < page.index("<main")
    assert "<title>Pre-market Watchlist</title>" in page
    for sym in ("DMBIO", "DMAI", "DMEV", "DMFRT"):
        assert f'id="p-{sym}"' in page
    assert "Demo data · fake tickers" in page
    assert "halted now: news pending (T1)" in page      # near-miss table
    assert "⚠ dilution" in page and "volatility pause (LUDP) x2" in page
    assert "gap ≥ +10%" in page and "$2–$20" in page


def test_fragment_has_no_document_shell():
    frag = html_report.fragment(_res(), CRIT)
    assert frag.startswith("<title>") and "<html" not in frag and "<body" not in frag


def test_outside_text_is_escaped_and_only_web_links_survive():
    res = _res()
    c = res.passed[0]
    c.name = '<img src=x onerror="alert(1)">'
    c.news = [NewsItem('Big <script>alert("x")</script> news', res.now - timedelta(hours=1),
                       "Wire", "javascript:alert(1)")]
    page = html_report.page(res, CRIT)
    assert "<script>alert" not in page and "<img src=x" not in page
    assert "javascript:" not in page
    assert "&lt;script&gt;" in page


def test_labels_follow_the_session_and_empty_state():
    evening = html_report.page(_res("2026-09-28 17:00", "afterhours"), CRIT)
    assert "After-hours Watchlist" in evening and "Night-before scan" in evening and "AH high" in evening
    res = _res()
    res.passed = []
    assert "Nothing passes every rule right now" in html_report.page(res, CRIT)


def test_one_line_summary():
    assert report.one_line(_res()).startswith("4 picks: DMBIO +62%, DMAI +35%")


class FakeResponse:
    def __init__(self, ok):
        self.ok = ok


def test_ntfy_attaches_the_page_and_falls_back_to_text(monkeypatch):
    import requests

    calls = []

    def put(url, data=None, headers=None, timeout=None):
        calls.append(("PUT", url, headers))
        return FakeResponse(put_ok)

    def post(url, data=None, headers=None, timeout=None, json=None, files=None):
        calls.append(("POST", url, headers))
        return FakeResponse(True)

    monkeypatch.setattr(requests, "put", put)
    monkeypatch.setattr(requests, "post", post)
    monkeypatch.setenv("NTFY_TOPIC", "test-topic")
    monkeypatch.delenv("DISCORD_WEBHOOK_URL", raising=False)

    put_ok = True
    assert notify.send("Pre-market scan: 4 pick(s)", "text", page="<html></html>", summary="4 picks: A +10% →") == ["ntfy"]
    method, url, headers = calls[-1]
    assert method == "PUT" and url == "https://ntfy.sh/test-topic"
    assert headers["Filename"] == "watchlist.html" and headers["Message"].isascii()

    calls.clear()
    put_ok = False
    assert notify.send("t", "text", page="<html></html>") == ["ntfy"]
    assert [c[0] for c in calls] == ["PUT", "POST"]  # attachment refused -> plain text
