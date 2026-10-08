import http.client
import json
import threading
from datetime import timedelta

import pytest

from postdesk import __main__ as cli
from postdesk import replay
from postdesk.server import Runner, make_server

from .helpers import T0, cfg
from .test_desk import make, run


@pytest.fixture
def served():
    desk = make()
    run(desk, T0, 2)
    clock = [T0 + timedelta(hours=2)]
    runner = Runner(desk, lambda: clock[0])
    server = make_server(runner, "127.0.0.1", 0, token="secret-token")
    th = threading.Thread(target=server.serve_forever, daemon=True)
    th.start()
    yield desk, server.server_address[1]
    server.shutdown()
    server.server_close()


def call(port, method, path, body=None, headers=None):
    c = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
    data = json.dumps(body).encode() if body is not None else None
    h = {"Content-Type": "application/json", **(headers or {})}
    c.request(method, path, body=data, headers=h)
    r = c.getresponse()
    return r.status, r.read()


def test_page_state_and_token(served):
    desk, port = served
    status, page = call(port, "GET", "/")
    assert status == 200 and b'content="secret-token"' in page
    status, state = call(port, "GET", "/api/state")
    assert status == 200 and json.loads(state)["mode"] == "demo"
    assert call(port, "GET", "/../desk.toml")[0] == 404
    assert call(port, "GET", "/desk.js")[0] == 200


def test_actions_need_the_token_and_the_right_host(served):
    desk, port = served
    d = desk.store.drafts(("queued",))[0]
    body = {"action": "approve", "id": d.id}
    assert call(port, "POST", "/api/action", body)[0] == 403
    assert call(port, "POST", "/api/action", body, {"X-Desk-Token": "wrong"})[0] == 403
    assert call(port, "POST", "/api/action", body, {"X-Desk-Token": "secret-token", "Host": "evil.example"})[0] == 403
    assert call(port, "POST", "/api/action", {"action": "rm -rf"}, {"X-Desk-Token": "secret-token"})[0] == 400
    status, out = call(port, "POST", "/api/action", body, {"X-Desk-Token": "secret-token"})
    assert status == 200 and json.loads(out)["ok"] and desk.store.draft(d.id).status == "approved"
    status, out = call(port, "POST", "/api/action", {"action": "approve", "id": "nope"}, {"X-Desk-Token": "secret-token"})
    assert status == 409 and json.loads(out)["message"] == "No such draft."


def test_replay_is_one_self_contained_file():
    data = replay.record(cfg(), T0 + timedelta(days=2), days=0.5, warmup_days=1.5, frame_minutes=30)
    assert len(data["frames"]) >= 20
    assert "growth" in data["frames"][0] and any("growth" not in f for f in data["frames"][1:])   # carried forward
    html = replay.page(data)
    assert html.startswith("<!doctype html>") and "window.POST_DESK_REPLAY=" in html
    payload = html.split("window.POST_DESK_REPLAY=", 1)[1].split(";</script>", 1)[0]
    assert "</script" not in payload
    assert 'src="desk.js"' not in html


def test_command_line(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(cli, "OUTPUT", tmp_path)
    assert cli.main(["sim", "--days", "2"]) == 0
    assert (tmp_path / "demo" / "desk.db").exists()
    capsys.readouterr()
    assert cli.main(["stats", "--demo"]) == 0
    assert "posts so far" in capsys.readouterr().out
    assert cli.main(["queue", "--demo"]) == 0
    waiting = [line.split()[0] for line in capsys.readouterr().out.splitlines() if " queued " in line]
    assert waiting
    assert cli.main(["approve", waiting[0], "--demo"]) == 0
    assert cli.main(["reject", "doesnotexist", "--demo"]) == 1
    assert cli.main(["add", "A post I wrote myself about small tools.", "--demo"]) == 0
    assert cli.main(["earned", "12.5", "--source", "sponsor", "--demo"]) == 0
    assert "$12.50" in capsys.readouterr().out
    assert cli.main(["review", "--demo"]) == 0
    assert (tmp_path / "demo" / "lessons.md").exists()
    assert cli.main(["draft", "--n", "2", "--demo"]) == 0
    assert "drafts written" in capsys.readouterr().out
