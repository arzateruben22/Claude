"""Record a demo night and pack it, with the dashboard, into one HTML file.

The file needs no server: open it anywhere (or on a phone) and the desk plays
back. Frames drop the balance series; it's stored once and sliced per frame.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta
from typing import Callable, Optional

from .config import Config
from .desk import Desk
from .judge import RulesJudge
from .server import WEB
from .sources.sim import SimMarket



def record(cfg: Config, start: datetime, hours: float, seed: int = 7, frame_every_s: int = 90,
           warmup_hours: float = 1.0, progress: Optional[Callable[[float], None]] = None) -> dict:
    market = SimMarket(start - timedelta(hours=warmup_hours), seed=seed)
    desk = Desk(cfg, market, RulesJudge(cfg.judge), start - timedelta(hours=warmup_hours), mode="demo")
    now, end = desk.started, start + timedelta(hours=hours)
    frames, next_frame = [], start
    while now <= end:
        desk.step(now)
        if now >= next_frame:
            s = desk.state(now)
            s["eq_n"] = len(desk.equity)
            s.pop("equity")
            s["feed"], s["trades"] = s["feed"][:3], s["trades"][:12]
            s["kills"], s["verdicts"] = s["kills"][:10], s["verdicts"][:8]
            s.pop("rules")
            for node in s["web"]:               # the page draws these from id/status/symbol/mcap/pnl
                for key in ("note", "born", "updated"):
                    node.pop(key)
            frames.append(s)
            next_frame += timedelta(seconds=frame_every_s)
            if progress:
                progress((now - start) / (end - start))
        now += timedelta(seconds=5)
    return {"interval": 1500, "equity": desk.equity, "frames": frames}


def _parts(data: dict) -> tuple:
    index = (WEB / "index.html").read_text(encoding="utf-8")
    body = index.split("<!--BODY-->", 1)[1].split("<!--/BODY-->", 1)[0]
    css = (WEB / "desk.css").read_text(encoding="utf-8")
    js = (WEB / "desk.js").read_text(encoding="utf-8")
    payload = json.dumps(data, separators=(",", ":")).replace("</", "<\\/")
    fonts = next(line for line in index.splitlines() if "fonts.googleapis.com/css2" in line)
    head = (f"<title>Night Desk</title>\n<link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>\n"
            f"{fonts.strip()}\n<style>{css}</style>\n")
    boot = (
        "<script>window.NIGHT_DESK_REPLAY=" + payload + ";"
        "window.NIGHT_DESK_REPLAY.frames.forEach(function(f){"
        "f.equity=window.NIGHT_DESK_REPLAY.equity.slice(0,f.eq_n);});</script>\n"
        f"<script>{js}</script>\n"
    )
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
