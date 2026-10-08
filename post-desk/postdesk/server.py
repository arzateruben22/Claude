"""Runs the desk in a background thread and serves the dashboard on your own computer.

  GET  /             the dashboard
  GET  /api/state    the desk's latest state as JSON (the page polls this)
  POST /api/action   approve, reject, edit, add, post now, pause... (needs the page's token)

It listens on 127.0.0.1 only. Actions need a random token that's written into the page when
it's served, and requests must name this machine as their host, so another website open in
your browser can't press the buttons for you.
"""
from __future__ import annotations

import hmac
import json
import secrets
import threading
import time
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Callable

from .desk import Desk

WEB = Path(__file__).resolve().parent / "web"
TYPES = {".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
         ".js": "text/javascript; charset=utf-8"}
ACTIONS = {"approve", "reject", "edit", "add", "post_now", "pause", "resume", "write", "scout"}
MAX_BODY = 64_000


class SimClock:
    """Demo time: runs `speed` times faster than the wall clock."""

    def __init__(self, start: datetime, speed: float):
        self.start, self.speed, self.t0 = start, speed, time.monotonic()

    def __call__(self) -> datetime:
        return self.start + timedelta(seconds=(time.monotonic() - self.t0) * self.speed)


def wall_clock() -> datetime:
    return datetime.now(timezone.utc)


class Runner(threading.Thread):
    """Steps the desk forever and keeps a ready-to-serve JSON snapshot."""

    def __init__(self, desk: Desk, clock: Callable[[], datetime], tick: float = 0.5):
        super().__init__(daemon=True)
        self.desk, self.clock, self.tick = desk, clock, tick
        self.lock = threading.Lock()
        self.latest = json.dumps(desk.state(clock()))
        self.stopped = threading.Event()
        self.error = ""

    def run(self) -> None:
        while not self.stopped.is_set():
            self.refresh(step=True)
            self.stopped.wait(self.tick)

    def refresh(self, step: bool = False) -> None:
        now = self.clock()
        try:
            if step:
                self.desk.step(now)
            snapshot = json.dumps(self.desk.state(now))
        except Exception as exc:          # keep the page alive and say what broke
            self.error = f"{type(exc).__name__}: {exc}"
            self.desk.say(now, "error", f"Desk error: {self.error}", key="crash")
            snapshot = json.dumps(self.desk.state(now))
        with self.lock:
            self.latest = snapshot

    def act(self, action: str, draft_id: str = "", text: str = "", fmt: str = "") -> tuple:
        ok, msg = self.desk.act(self.clock(), action, draft_id, text, fmt)
        self.refresh()
        return ok, msg

    def stop(self) -> None:
        self.stopped.set()


def make_server(runner: Runner, host: str = "127.0.0.1", port: int = 8788, token: str = "") -> ThreadingHTTPServer:
    token = token or secrets.token_urlsafe(24)

    class Handler(BaseHTTPRequestHandler):
        def _host_ok(self) -> bool:
            h = (self.headers.get("Host") or "").rsplit(":", 1)[0].strip("[]")
            return h in ("127.0.0.1", "localhost", "::1", host)

        def do_GET(self):  # noqa: N802 (http.server naming)
            if not self._host_ok():
                return self._send(403, "text/plain; charset=utf-8", b"wrong host")
            path = self.path.split("?", 1)[0]
            if path == "/api/state":
                with runner.lock:
                    body = runner.latest.encode()
                return self._send(200, "application/json", body)
            name = "index.html" if path in ("/", "/index.html") else path.lstrip("/")
            file = (WEB / name).resolve()
            if file.parent != WEB or not file.is_file():   # only files in web/, nothing else
                return self._send(404, "text/plain; charset=utf-8", b"not found")
            body = file.read_bytes()
            if file.name == "index.html":
                body = body.replace(b'<meta name="desk-token" content="">',
                                    f'<meta name="desk-token" content="{token}">'.encode())
            return self._send(200, TYPES.get(file.suffix, "application/octet-stream"), body)

        def do_POST(self):  # noqa: N802
            if self.path.split("?", 1)[0] != "/api/action":
                return self._json(404, {"ok": False, "message": "not found"})
            if not self._host_ok() or not hmac.compare_digest(self.headers.get("X-Desk-Token", ""), token):
                return self._json(403, {"ok": False, "message": "Reload the page (the desk restarted)."})
            try:
                n = int(self.headers.get("Content-Length", "0"))
                if n > MAX_BODY:
                    raise ValueError("too big")
                data = json.loads(self.rfile.read(n) or b"{}")
                if not isinstance(data, dict):
                    raise ValueError("not an object")
            except ValueError:
                return self._json(400, {"ok": False, "message": "Bad request."})
            action = str(data.get("action", ""))
            if action not in ACTIONS:
                return self._json(400, {"ok": False, "message": f"Unknown action: {action[:40]}"})
            ok, msg = runner.act(action, str(data.get("id", ""))[:40], str(data.get("text", ""))[:30000],
                                 str(data.get("format", ""))[:40])
            return self._json(200 if ok else 409, {"ok": ok, "message": msg})

        def _json(self, code: int, payload: dict) -> None:
            self._send(code, "application/json", json.dumps(payload).encode())

        def _send(self, code: int, ctype: str, body: bytes) -> None:
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Referrer-Policy", "no-referrer")
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *args) -> None:  # keep the terminal quiet
            pass

    server = ThreadingHTTPServer((host, port), Handler)
    server.token = token  # type: ignore[attr-defined]
    return server
