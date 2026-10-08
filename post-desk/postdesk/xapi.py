"""The X API, through the official v2 endpoints only (no browser automation, no scraping).

  XClient   your real account, OAuth 2.0 user context (python -m postdesk auth)
  Every call is priced and written to the ledger, and refused once the budget is spent.

The desk only ever: posts, quote-posts, reposts, searches recent posts, and reads its own
posts' numbers and follower count. It never likes, follows, replies to or mentions anyone:
X's automation rules forbid automating those, so that code doesn't exist here.
"""
from __future__ import annotations

import base64
import hashlib
import json
import os
import secrets
import time as _time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Optional
from urllib.parse import urlencode

from .budget import Budget
from .config import SECRETS
from .guard import URL
from .models import Metric, Signal

API = "https://api.x.com/2"
AUTHORIZE = "https://x.com/i/oauth2/authorize"
TOKEN = "https://api.x.com/2/oauth2/token"
SCOPES = "tweet.read tweet.write users.read offline.access"
TOKENS = SECRETS / "x_tokens.json"


class XError(RuntimeError):
    pass


class RateLimited(XError):
    def __init__(self, msg: str, reset: Optional[datetime] = None):
        super().__init__(msg)
        self.reset = reset


class AuthError(XError):
    pass


class Offline(XError):
    """Couldn't reach X at all (no internet, DNS, timeout). Nothing was sent; try again later."""


def parse_time(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def velocity(likes: int, reposts: int, replies: int, quotes: int, created: Optional[datetime], now: datetime) -> float:
    """Weighted engagement per hour since posting: how fast a post is catching on."""
    hours = max(0.25, (now - created).total_seconds() / 3600) if created else 6.0
    return (likes + 2 * reposts + 1.5 * replies + 2 * quotes) / hours


# -- OAuth 2.0 with PKCE ----------------------------------------------------------------------

def pkce_pair():
    verifier = base64.urlsafe_b64encode(secrets.token_bytes(48)).rstrip(b"=").decode()
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    return verifier, challenge


def authorize_url(client_id: str, redirect_uri: str, state: str, challenge: str) -> str:
    return AUTHORIZE + "?" + urlencode({
        "response_type": "code", "client_id": client_id, "redirect_uri": redirect_uri, "scope": SCOPES,
        "state": state, "code_challenge": challenge, "code_challenge_method": "S256"})


def _token_request(http, data: dict, client_id: str, client_secret: str = "") -> dict:
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    if client_secret:     # confidential client: id and secret go in a Basic header
        headers["Authorization"] = "Basic " + base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
    else:
        data = {**data, "client_id": client_id}
    resp = http.request("POST", TOKEN, headers=headers, data=data, timeout=20)
    if resp.status_code != 200:
        raise AuthError(f"X refused the token request ({resp.status_code}): {resp.text[:200]}")
    tok = resp.json()
    tok["expires_at"] = (datetime.now(timezone.utc) + timedelta(seconds=int(tok.get("expires_in", 7200)) - 60)).isoformat()
    return tok


def exchange_code(http, client_id: str, client_secret: str, code: str, verifier: str, redirect_uri: str) -> dict:
    return _token_request(http, {"grant_type": "authorization_code", "code": code, "redirect_uri": redirect_uri,
                                 "code_verifier": verifier}, client_id, client_secret)


def refresh_tokens(http, client_id: str, client_secret: str, refresh_token: str) -> dict:
    return _token_request(http, {"grant_type": "refresh_token", "refresh_token": refresh_token}, client_id, client_secret)


def save_tokens(tok: dict, path: Path = TOKENS) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(tok))
    os.chmod(tmp, 0o600)
    tmp.replace(path)


def load_tokens(path: Path = TOKENS) -> Optional[dict]:
    return json.loads(path.read_text()) if path.exists() else None


# -- the client ------------------------------------------------------------------------------------

class XClient:
    name = "live"

    def __init__(self, budget: Budget, http=None, client_id: str = "", client_secret: str = "",
                 tokens_path: Path = TOKENS):
        if http is None:
            import requests

            http = requests.Session()
        self.http, self.budget = http, budget
        self.client_id = client_id or os.getenv("X_CLIENT_ID", "")
        self.client_secret = client_secret or os.getenv("X_CLIENT_SECRET", "")
        self.tokens_path = tokens_path
        self.tokens = load_tokens(tokens_path)
        self.user_id: Optional[str] = None
        if not self.tokens:
            raise AuthError("Not connected to X yet. Run: python -m postdesk auth")

    def _bearer(self) -> str:
        if datetime.fromisoformat(self.tokens["expires_at"]) <= datetime.now(timezone.utc):
            self._refresh()
        return self.tokens["access_token"]

    def _refresh(self) -> None:
        if not self.tokens.get("refresh_token"):
            raise AuthError("X sign-in expired. Run: python -m postdesk auth")
        new = refresh_tokens(self.http, self.client_id, self.client_secret, self.tokens["refresh_token"])
        new.setdefault("refresh_token", self.tokens["refresh_token"])
        self.tokens = new
        save_tokens(new, self.tokens_path)

    def _call(self, method: str, path: str, params: Optional[dict] = None, body: Optional[dict] = None,
              retry: bool = True) -> dict:
        try:
            resp = self.http.request(method, API + path, params=params, json=body, timeout=20,
                                     headers={"Authorization": f"Bearer {self._bearer()}"})
        except OSError as exc:            # requests' connection errors are OSErrors too
            raise Offline(f"can't reach X ({type(exc).__name__})") from exc
        if resp.status_code == 401 and retry:
            self._refresh()
            return self._call(method, path, params, body, retry=False)
        if resp.status_code == 429:
            reset = resp.headers.get("x-rate-limit-reset")
            when = datetime.fromtimestamp(int(reset), timezone.utc) if reset else None
            raise RateLimited("X rate limit hit" + (f"; resets {when:%H:%M} UTC" if when else ""), when)
        if resp.status_code in (402, 403):
            raise XError(f"X refused ({resp.status_code}): {resp.text[:200]}. Check credits and app permissions "
                         "in the developer console.")
        if resp.status_code >= 400:
            raise XError(f"X error {resp.status_code}: {resp.text[:200]}")
        return resp.json() if resp.content else {}

    # -- what the desk does --------------------------------------------------------------
    def me(self, now: datetime) -> dict:
        self.budget.require(now, "owned_read")
        data = self._call("GET", "/users/me", {"user.fields": "public_metrics,verified"})["data"]
        self.budget.charge(now, "owned_read", 1, "followers")
        self.user_id = data["id"]
        return {"id": data["id"], "username": data["username"],
                "followers": data.get("public_metrics", {}).get("followers_count", 0),
                "verified": bool(data.get("verified"))}

    def post(self, now: datetime, text: str, quote_of: str = "", fmt: str = "") -> str:
        kind = "post_with_link" if URL.search(text) else "post"
        self.budget.require(now, kind)
        body = {"text": text}
        if quote_of:
            body["quote_tweet_id"] = quote_of
        data = self._call("POST", "/tweets", body=body)["data"]
        self.budget.charge(now, kind, 1, f"post {data['id']}")
        return data["id"]

    def repost(self, now: datetime, post_id: str) -> None:
        self.budget.require(now, "post")
        uid = self.user_id or self.me(now)["id"]
        self._call("POST", f"/users/{uid}/retweets", body={"tweet_id": post_id})
        self.budget.charge(now, "post", 1, f"repost {post_id}")

    def search(self, now: datetime, query: str, max_results: int, since: datetime, authors: bool = False) -> List[Signal]:
        max_results = max(10, min(100, max_results))
        self.budget.require(now, "read_post", max_results)
        params = {"query": query, "max_results": max_results, "start_time": since.strftime("%Y-%m-%dT%H:%M:%SZ"),
                  "sort_order": "relevancy", "tweet.fields": "created_at,public_metrics,author_id,lang"}
        if authors:
            params.update({"expansions": "author_id", "user.fields": "username"})
        data = self._call("GET", "/tweets/search/recent", params)
        posts, users = data.get("data", []), {u["id"]: u["username"] for u in data.get("includes", {}).get("users", [])}
        self.budget.charge(now, "read_post", len(posts), f"search: {query[:60]}")
        if users:
            self.budget.charge(now, "read_user", len(users), "authors")
        out = []
        for p in posts:
            m, created = p.get("public_metrics", {}), parse_time(p.get("created_at"))
            out.append(Signal(id=p["id"], source="x", text=p.get("text", ""), url=f"https://x.com/i/status/{p['id']}",
                              author=users.get(p.get("author_id"), ""), author_id=p.get("author_id", ""),
                              created=created, likes=m.get("like_count", 0),
                              reposts=m.get("retweet_count", 0), replies=m.get("reply_count", 0),
                              score=velocity(m.get("like_count", 0), m.get("retweet_count", 0),
                                             m.get("reply_count", 0), m.get("quote_count", 0), created, now)))
        return out

    def authors(self, now: datetime, user_ids: List[str]) -> Dict[str, str]:
        if not user_ids:
            return {}
        self.budget.require(now, "read_user", len(user_ids))
        data = self._call("GET", "/users", {"ids": ",".join(user_ids[:100]), "user.fields": "username"})
        users = data.get("data", [])
        self.budget.charge(now, "read_user", len(users), "authors")
        return {u["id"]: u["username"] for u in users}

    def my_metrics(self, now: datetime, post_ids: List[str]) -> List[Metric]:
        out: List[Metric] = []
        for i in range(0, len(post_ids), 100):
            batch = post_ids[i:i + 100]
            self.budget.require(now, "owned_read", len(batch))
            data = self._call("GET", "/tweets", {"ids": ",".join(batch), "tweet.fields": "public_metrics"})
            posts = data.get("data", [])
            self.budget.charge(now, "owned_read", len(posts), "your post numbers")
            for p in posts:
                m = p.get("public_metrics", {})
                out.append(Metric(p["id"], now, m.get("impression_count", 0), m.get("like_count", 0),
                                  m.get("retweet_count", 0), m.get("reply_count", 0), m.get("quote_count", 0),
                                  m.get("bookmark_count", 0)))
        return out

    def advance(self, now: datetime) -> None:   # the demo's world moves on its own; the real one already does
        pass


def wait_for_code(port: int, state: str, timeout: float = 300) -> str:
    """A one-shot local web server that catches X's redirect after you approve the app."""
    from http.server import BaseHTTPRequestHandler, HTTPServer
    from urllib.parse import parse_qs, urlparse

    got: Dict[str, str] = {}

    class Catch(BaseHTTPRequestHandler):
        def do_GET(self):  # noqa: N802
            q = parse_qs(urlparse(self.path).query)
            if q.get("state", [""])[0] != state:
                body, code = b"State didn't match. Close this tab and run the auth command again.", 400
            elif "code" in q:
                got["code"], body, code = q["code"][0], b"Connected. You can close this tab.", 200
            else:
                body, code = ("X said: " + q.get("error", ["no code"])[0]).encode(), 400
            self.send_response(code)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *a):
            pass

    server = HTTPServer(("127.0.0.1", port), Catch)
    server.timeout = 2
    end = _time.monotonic() + timeout
    while "code" not in got and _time.monotonic() < end:
        server.handle_request()
    server.server_close()
    if "code" not in got:
        raise AuthError("No answer from X within 5 minutes.")
    return got["code"]
