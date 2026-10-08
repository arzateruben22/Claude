"""Record a stretch of the demo and pack it, with the dashboard, into one HTML file.

The file needs no server: open it anywhere (or on a phone) and the desk plays back. Slow-
moving parts of each frame are stored only when they change; the page carries them forward.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta
from typing import Callable, Optional

from .build import demo_desk
from .config import Config
from .server import WEB
from .store import Store

CARRY = ("growth", "money", "kit", "formats", "hours", "lessons", "posted", "scout", "wheel")


def record(cfg: Config, end: datetime, days: float = 2, warmup_days: float = 12, seed: int = 7,
           frame_minutes: int = 12, progress: Optional[Callable[[float], None]] = None) -> dict:
    start = end - timedelta(days=warmup_days + days)
    desk = demo_desk(cfg, start, None, seed=seed, store=Store(":memory:"))
    rec_from = end - timedelta(days=days)
    frames, last, t, nxt = [], {}, start, rec_from
    while t <= end:
        desk.step(t)
        if t >= nxt:
            s = desk.state(t)
            s["queue"], s["log"] = s["queue"][:8], s["log"][:16]
            for k in CARRY:
                blob = json.dumps(s[k], sort_keys=True)
                if last.get(k) == blob:
                    del s[k]
                else:
                    last[k] = blob
            frames.append(s)
            nxt += timedelta(minutes=frame_minutes)
        if progress:
            progress((t - start) / (end - start))
        t += timedelta(minutes=2)
    return {"interval": 650, "carry": list(CARRY), "frames": frames}


def _parts(data: dict) -> tuple:
    index = (WEB / "index.html").read_text(encoding="utf-8")
    body = index.split("<!--BODY-->", 1)[1].split("<!--/BODY-->", 1)[0]
    css = (WEB / "desk.css").read_text(encoding="utf-8")
    js = (WEB / "desk.js").read_text(encoding="utf-8")
    payload = json.dumps(data, separators=(",", ":")).replace("</", "<\\/")
    fonts = next(line for line in index.splitlines() if "fonts.googleapis.com/css2" in line)
    icon = next(line for line in index.splitlines() if 'rel="icon"' in line)
    head = ("<title>Post Desk</title>\n<meta name=\"color-scheme\" content=\"dark\">\n"
            "<link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>\n"
            f"{icon.strip()}\n{fonts.strip()}\n<style>{css}</style>\n")
    boot = f"<script>window.POST_DESK_REPLAY={payload};</script>\n<script>{js}</script>\n"
    return head, body, boot


def fragment(data: dict) -> str:
    """Head bits + body + scripts, for hosts that add their own html/head/body."""
    head, body, boot = _parts(data)
    return head + body + boot


def page(data: dict) -> str:
    head, body, boot = _parts(data)
    return ("<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n"
            "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\n"
            f"{head}</head>\n<body>\n{body}{boot}</body>\n</html>\n")
