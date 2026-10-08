"""Shared fakes: settings, a pretend HTTP layer for X, a pretend Claude client."""
from __future__ import annotations

import copy
import json
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

from postdesk import config
from postdesk.budget import Budget
from postdesk.store import Store

T0 = datetime(2026, 10, 5, 7, 0, tzinfo=timezone.utc)      # midnight in Los Angeles
_BASE = config.load(Path(__file__).with_name("desk.test.toml"))   # not your desk.toml: tests stay put when you edit it


def cfg(**changes):
    """The repo's desk.toml with changes like approval__mode="auto_originals"."""
    c = copy.deepcopy(_BASE)
    for key, value in changes.items():
        section, name = key.split("__")
        setattr(getattr(c, section), name, value)
    config.validate(c)
    return c


def budget(c=None, store=None):
    c = c or cfg()
    store = store or Store(":memory:")
    return Budget(c.budget, store, c.tz, c.writer.ai_daily_usd), store


class Resp:
    def __init__(self, status=200, body=None, headers=None):
        self.status_code = status
        self._body = body if body is not None else {}
        self.headers = headers or {}
        self.content = json.dumps(self._body).encode() if body is not None else b""
        self.text = json.dumps(self._body)

    def json(self):
        return self._body


class FakeHTTP:
    """Answers X API calls from a list of canned responses, and records every request."""

    def __init__(self, *responses):
        self.responses = list(responses)
        self.calls = []

    def request(self, method, url, **kw):
        self.calls.append(SimpleNamespace(method=method, url=url, **kw))
        if not self.responses:
            raise AssertionError(f"unexpected call: {method} {url}")
        r = self.responses.pop(0)
        return r(method, url, kw) if callable(r) else r


class FakeClaude:
    """Stands in for anthropic.Anthropic(): returns the given dicts as structured output."""

    def __init__(self, *answers, stop="end_turn", fail=None):
        self.answers = list(answers)
        self.stop, self.fail = stop, fail
        self.calls = []
        self.beta = SimpleNamespace(messages=SimpleNamespace(create=self._create))

    def _create(self, **kw):
        self.calls.append(kw)
        if self.fail:
            raise self.fail
        data = self.answers.pop(0) if self.answers else {}
        return SimpleNamespace(stop_reason=self.stop, content=[SimpleNamespace(type="text", text=json.dumps(data))],
                               usage=SimpleNamespace(input_tokens=2000, output_tokens=1000))
