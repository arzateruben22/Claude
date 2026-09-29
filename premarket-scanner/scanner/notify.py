"""Optional phone alerts. Set either (or both) in .env:

  NTFY_TOPIC=some-long-random-name     free, no account: install the ntfy app
                                       and subscribe to the same topic name
  DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...

With a page attached, the notification carries the watchlist web page: tap it
on your phone to open the full list. If the attachment is refused, a plain
text alert goes out instead.
"""
from __future__ import annotations

import json
import os
from typing import List, Optional

FILENAME = "watchlist.html"


def _ascii(text: str) -> str:
    """HTTP headers must be plain ASCII."""
    return text.encode("ascii", "ignore").decode()


def send(title: str, body: str, page: Optional[str] = None, summary: str = "") -> List[str]:
    """Returns the channels that succeeded. `summary` is a one-line text shown
    on the notification when the page goes along as an attachment."""
    import requests

    sent = []
    topic = os.getenv("NTFY_TOPIC")
    if topic:
        url = os.getenv("NTFY_SERVER", "https://ntfy.sh").rstrip("/") + "/" + topic
        headers = {"Title": _ascii(title), "Tags": "chart_with_upwards_trend"}
        ok = False
        if page:
            try:
                r = requests.put(url, data=page.encode("utf-8"), timeout=20,
                                 headers={**headers, "Filename": FILENAME, "Message": _ascii(summary or title)})
                ok = r.ok
            except requests.RequestException:
                ok = False
        if not ok:
            r = requests.post(url, data=body.encode("utf-8"), headers=headers, timeout=15)
            ok = r.ok
        if ok:
            sent.append("ntfy")
    hook = os.getenv("DISCORD_WEBHOOK_URL")
    if hook:
        content = f"**{title}**\n```\n{body[:1850]}\n```"
        r = None
        if page:
            try:
                r = requests.post(hook, data={"payload_json": json.dumps({"content": content})},
                                  files={"files[0]": (FILENAME, page.encode("utf-8"), "text/html")}, timeout=20)
            except requests.RequestException:
                r = None
        if r is None or not r.ok:
            r = requests.post(hook, json={"content": content}, timeout=15)
        if r.ok:
            sent.append("discord")
    return sent
