"""STATUS: the summary the running desk saves for the home screen on port 8790."""
import json
from datetime import timedelta

from postdesk import status
from postdesk.server import Runner

from .helpers import T0
from .test_desk import make, run


def test_the_summary_says_what_the_home_screen_shows_and_no_more(tmp_path):
    desk = make()
    run(desk, T0, 2)
    state = desk.state(T0 + timedelta(hours=2))
    s = status.summary(state, 8788)
    assert s["port"] == 8788 and s["pill"] == state["pill"] and s["handle"] == state["handle"]
    assert s["waiting"] == state["stats"]["waiting"] and s["posts_today"] == state["stats"]["posts_today"]
    assert len(s["preview"]) <= status.PREVIEW and all(len(p["text"]) <= status.PREVIEW_CHARS for p in s["preview"])
    assert not {"queue", "log", "scout", "lessons"} & set(s)                  # a summary, not the dashboard's state
    assert "token" not in json.dumps(s).lower()


def test_it_saves_every_half_minute_right_away_after_you_act_and_once_more_on_the_way_out(tmp_path, monkeypatch):
    desk = make()
    run(desk, T0, 1)
    clock = [0.0]
    monkeypatch.setattr(status.time, "monotonic", lambda: clock[0])
    clock[0] = 100.0
    f = status.StatusFile(tmp_path / "live" / "status.json", 8788)
    runner = Runner(desk, lambda: T0 + timedelta(hours=1), status=f)
    runner.refresh(step=True)
    first = json.loads(f.path.read_text())
    assert first["stopped"] is False
    f.path.unlink()
    clock[0] = 110.0
    runner.refresh(step=True)
    assert not f.path.exists()                                            # ten seconds later: not yet
    runner.refresh()                                                      # after an action: right away
    assert f.path.exists()
    runner.stop()
    assert json.loads(f.path.read_text())["stopped"] is True
    assert status.StatusFile(None).maybe_write(desk.state(T0), force=True) is False   # no file asked for: nothing
