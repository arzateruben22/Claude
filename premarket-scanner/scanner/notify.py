"""Optional phone alerts. Set either (or both) in .env:

  NTFY_TOPIC=some-long-random-name     free, no account: install the ntfy app
                                       and subscribe to the same topic name
  DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
"""
from __future__ import annotations

import os
from typing import List


def send(title: str, body: str) -> List[str]:
    """Returns the channels that were attempted-and-succeeded."""
    import requests

    sent = []
    topic = os.getenv("NTFY_TOPIC")
    if topic:
        server = os.getenv("NTFY_SERVER", "https://ntfy.sh").rstrip("/")
        r = requests.post(f"{server}/{topic}", data=body.encode("utf-8"),
                          headers={"Title": title.encode("ascii", "ignore").decode(), "Tags": "chart_with_upwards_trend"},
                          timeout=15)
        if r.ok:
            sent.append("ntfy")
    hook = os.getenv("DISCORD_WEBHOOK_URL")
    if hook:
        r = requests.post(hook, json={"content": f"**{title}**\n```\n{body[:1850]}\n```"}, timeout=15)
        if r.ok:
            sent.append("discord")
    return sent
