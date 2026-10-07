"""Runs the desk in a background thread and serves the dashboard.

  GET /            the dashboard
  GET /api/state   the desk's latest state as JSON (the page polls this)
"""
from __future__ import annotations

import json
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
            now = self.clock()
            try:
                self.desk.step(now)
                snapshot = json.dumps(self.desk.state(now))
            except Exception as exc:  # keep the page alive and say what broke
                self.error = f"{type(exc).__name__}: {exc}"
                self.desk.notes.append(f"desk error: {self.error}")
                snapshot = json.dumps(self.desk.state(now))
            with self.lock:
                self.latest = snapshot
            self.stopped.wait(self.tick)

    def stop(self) -> None:
        self.stopped.set()
        self.desk.save()


def make_server(runner: Runner, host: str = "127.0.0.1", port: int = 8787) -> ThreadingHTTPServer:
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):  # noqa: N802 (http.server naming)
            path = self.path.split("?", 1)[0]
            if path == "/api/state":
                with runner.lock:
                    body = runner.latest.encode()
                return self._send(200, "application/json", body)
            name = "index.html" if path in ("/", "/index.html") else path.lstrip("/")
            file = (WEB / name).resolve()
            if file.parent != WEB or not file.is_file():   # only files in web/, nothing else
                return self._send(404, "text/plain; charset=utf-8", b"not found")
            return self._send(200, TYPES.get(file.suffix, "application/octet-stream"), file.read_bytes())

        def _send(self, code: int, ctype: str, body: bytes) -> None:
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *args) -> None:  # keep the terminal quiet
            pass

    return ThreadingHTTPServer((host, port), Handler)
