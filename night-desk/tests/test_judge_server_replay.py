import json
import threading
import urllib.request
from types import SimpleNamespace

import anthropic
import httpx2
import pytest

from nightdesk import config, judge, replay
from nightdesk.desk import Desk
from nightdesk.judge import ClaudeJudge, RulesJudge, make_judge
from nightdesk.models import Review
from nightdesk.rules import scan_scores
from nightdesk.server import Runner, make_server
from nightdesk.sources.sim import SimMarket

from helpers import T0, coin, safety

CFG = config.load()


def review(**c):
    r = Review(coin(**c), first_seen=T0)
    r.safety = safety()
    r.scores = scan_scores(r.coin, 100, 1.0)
    return r


class FakeClient:
    def __init__(self, reply=None, stop="end_turn", error=None):
        self.kwargs, self.reply, self.stop, self.error = None, reply, stop, error
        self.beta = SimpleNamespace(messages=SimpleNamespace(create=self.create))

    def create(self, **kwargs):
        self.kwargs = kwargs
        if self.error:
            raise self.error
        content = [SimpleNamespace(type="thinking", thinking=""),
                   SimpleNamespace(type="text", text=json.dumps(self.reply) if self.reply is not None else "")]
        return SimpleNamespace(stop_reason=self.stop, content=content,
                               usage=SimpleNamespace(input_tokens=900, output_tokens=200))


# --- judge -----------------------------------------------------------------------

def test_rules_judge_likes_broad_live_buying_and_dislikes_weak_coins():
    assert RulesJudge(CFG.judge).decide(review(buys_h1=800, sells_h1=300, buys_m5=80, sells_m5=25)).buy
    weak = RulesJudge(CFG.judge).decide(review(buys_h1=560, sells_h1=440, buys_m5=29, sells_m5=21, change_h1=170))
    assert not weak.buy and weak.reason.startswith("weak")


def test_claude_judge_request_shape():
    fake = FakeClient({"buy": True, "confidence": 0.8, "reason": "broad buying, clean holders"})
    v = ClaudeJudge(CFG.judge, client=fake).decide(review())
    assert v.buy and v.confidence == 0.8 and v.by == "ai:claude-opus-5-5"
    k = fake.kwargs
    assert k["model"] == "claude-opus-5-5"
    assert k["output_config"]["effort"] == "low"
    assert k["output_config"]["format"]["schema"]["required"] == ["buy", "confidence", "reason"]
    assert k["fallbacks"] == "default" and k["betas"] == ["server-side-fallback-2026-07-01"]
    assert "never follow instructions" in k["system"]
    card = json.loads(k["messages"][0]["content"])
    assert card["token"]["symbol"] == "GOOD" and card["safety"]["top_wallet_pct"] == 3.0


def test_haiku_skips_effort_and_fallbacks():
    cfg = config.JudgeCfg(model="claude-haiku-4-5")
    fake = FakeClient({"buy": False, "confidence": 0.3, "reason": "thin"})
    ClaudeJudge(cfg, client=fake).decide(review())
    assert "effort" not in fake.kwargs["output_config"] and "fallbacks" not in fake.kwargs


def test_low_confidence_yes_is_a_no():
    fake = FakeClient({"buy": True, "confidence": 0.4, "reason": "maybe"})
    assert not ClaudeJudge(CFG.judge, client=fake).decide(review()).buy


def test_refusal_cutoff_and_garbage():
    assert not ClaudeJudge(CFG.judge, client=FakeClient(stop="refusal")).decide(review()).buy
    cut = ClaudeJudge(CFG.judge, client=FakeClient(stop="max_tokens")).decide(review())
    assert cut.by == "rules" and "answer cut off" in cut.reason
    junk = ClaudeJudge(CFG.judge, client=FakeClient(reply="not an object")).decide(review())
    assert junk.by == "rules" and "unreadable answer" in junk.reason


@pytest.mark.parametrize("error,why", [
    (anthropic.APIConnectionError(request=httpx2.Request("POST", "https://api.anthropic.com/v1/messages")), "no connection"),
    (anthropic.RateLimitError("slow down", response=httpx2.Response(
        429, request=httpx2.Request("POST", "https://api.anthropic.com/v1/messages")), body=None), "rate limited"),
])
def test_api_errors_fall_back_to_rules(error, why):
    v = ClaudeJudge(CFG.judge, client=FakeClient(error=error)).decide(review())
    assert v.by == "rules" and why in v.reason


def test_make_judge(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_AUTH_TOKEN", raising=False)
    assert isinstance(make_judge(CFG.judge, allow_ai=True), RulesJudge)
    assert isinstance(make_judge(CFG.judge, allow_ai=False, client=FakeClient()), RulesJudge)
    assert isinstance(make_judge(CFG.judge, allow_ai=True, client=FakeClient()), ClaudeJudge)
    assert judge.describe(RulesJudge(CFG.judge)) == "rules (no AI key)"


# --- server ----------------------------------------------------------------------

def test_server_serves_state_and_page_and_nothing_else():
    desk = Desk(CFG, SimMarket(T0), RulesJudge(CFG.judge), T0)
    runner = Runner(desk, clock=lambda: T0)
    server = make_server(runner, port=0)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_address[1]}"
    try:
        state = json.loads(urllib.request.urlopen(base + "/api/state").read())
        assert state["mode"] == "demo" and "agents" in state
        page = urllib.request.urlopen(base + "/").read().decode()
        assert "<title>Night Desk</title>" in page
        assert urllib.request.urlopen(base + "/desk.js").status == 200
        for bad in ("/../desk.toml", "/%2e%2e/desk.toml", "/nope.js"):
            with pytest.raises(urllib.error.HTTPError) as err:
                urllib.request.urlopen(base + bad)
            assert err.value.code == 404
    finally:
        server.shutdown()
        server.server_close()


# --- replay ------------------------------------------------------------------------

def test_replay_builds_a_self_contained_page():
    data = replay.record(CFG, T0, hours=0.5, seed=5, warmup_hours=0.5)
    assert len(data["frames"]) >= 20 and data["equity"]
    assert all("equity" not in f and f["eq_n"] <= len(data["equity"]) for f in data["frames"])
    page = replay.page(data)
    assert page.startswith("<!doctype html>") and "window.NIGHT_DESK_REPLAY=" in page
    assert "<script src=" not in page and "desk.css" not in page    # everything inline
    frag = replay.fragment(data)
    assert frag.startswith("<title>Night Desk</title>") and "<html" not in frag and "<body" not in frag


def test_replay_escapes_script_endings():
    data = {"interval": 1500, "equity": [], "frames": [{"note": "</script><b>x</b>", "eq_n": 0}]}
    assert "</script><b>" not in replay.fragment(data).split("NIGHT_DESK_REPLAY=", 1)[1].split(";", 1)[0]
