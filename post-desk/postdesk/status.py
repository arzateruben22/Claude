"""STATUS: a small summary of the desk, saved next to its database for the home screen on port 8790.

The paper book's home screen shows both apps side by side: the trading desks and this one. It can't ask the
dashboard (that would need its token), so the running desk saves this file every half minute instead: whether
it's on air, the drafts waiting for you, today's posts, the next slot and the follower count. Read-only, no
secrets, nothing the dashboard doesn't already show you.
"""
from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

EVERY = 30.0             # seconds between saves
PREVIEW = 2              # drafts waiting for you, shown on the home screen
PREVIEW_CHARS = 140


def summary(state: dict, port: int, stopped: bool = False) -> dict:
    st, nxt = state.get("stats", {}), state.get("next")
    waiting = [q for q in state.get("queue", []) if q.get("status") == "queued"]
    return {
        "v": 1, "updated": datetime.now(timezone.utc).isoformat(), "stopped": stopped,
        "mode": state.get("mode", "live"), "handle": state.get("handle", ""), "pill": state.get("pill", ""),
        "approval": state.get("approval", "review"), "port": port,
        "waiting": st.get("waiting", 0), "ready": st.get("ready", 0),
        "posts_today": st.get("posts_today", 0), "slots_today": st.get("slots_today", 0),
        "next_at": nxt["at"] if nxt else "", "followers": st.get("followers", 0),
        "followers_7d": st.get("followers_7d", 0), "views_7d": st.get("views_7d", 0),
        "writer_error": state.get("writer_error", "") or "",
        "preview": [{"format": q.get("format", ""), "text": (q.get("text") or "")[:PREVIEW_CHARS]}
                    for q in waiting[:PREVIEW]],
    }


class StatusFile:
    """Saves the summary at most every EVERY seconds (and once more when the desk stops)."""

    def __init__(self, path: Optional[Path], port: int = 8788):
        self.path, self.port, self.last = path, port, 0.0

    def maybe_write(self, state: dict, force: bool = False, stopped: bool = False) -> bool:
        if not self.path or (not force and time.monotonic() - self.last < EVERY):
            return False
        self.last = time.monotonic()
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            tmp = self.path.with_suffix(".json.tmp")
            tmp.write_text(json.dumps(summary(state, self.port, stopped)), encoding="utf-8")
            tmp.replace(self.path)
        except OSError:                    # a full disk mustn't stop the desk; the home screen says "not running"
            return False
        return True
