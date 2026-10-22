"""Talking to Lumevina's Supabase project: PostgREST for rows, Storage for
images, with the service-role key from the worker's own environment. The
worker has no public endpoint; it only reaches out to Supabase.

The jobs use the small Store interface below, so the tests can run them
against an in-memory store.
"""

from __future__ import annotations

import os
from typing import Any, Protocol
from urllib.parse import quote

import requests

BUCKET = "skin-images"


class Store(Protocol):
    def claim(self, worker: str) -> dict | None: ...
    def finish(self, job_id: int, error: str | None = None) -> None: ...
    def get(self, table: str, **eq) -> dict | None: ...
    def rows(self, table: str, **eq) -> list[dict]: ...
    def insert(self, table: str, row: dict) -> dict: ...
    def update(self, table: str, patch: dict, **eq) -> None: ...
    def enqueue(self, capture_id: str, kind: str, reference_capture_id: str | None = None, params: dict | None = None) -> None: ...
    def download(self, path: str) -> bytes: ...
    def upload(self, path: str, data: bytes, content_type: str) -> None: ...


class SupabaseStore:
    def __init__(self, url: str | None = None, key: str | None = None, timeout: int = 60):
        self.url = (url or os.environ["SUPABASE_URL"]).rstrip("/")
        key = key or os.environ["SUPABASE_SERVICE_ROLE_KEY"]
        self.s = requests.Session()
        self.s.headers.update({"apikey": key, "Authorization": f"Bearer {key}"})
        self.timeout = timeout

    def _rest(self, method: str, path: str, **kw) -> Any:
        r = self.s.request(method, f"{self.url}/rest/v1/{path}", timeout=self.timeout, **kw)
        if r.status_code >= 400:
            raise RuntimeError(f"{method} {path}: {r.status_code} {r.text[:300]}")
        return r.json() if r.content else None

    @staticmethod
    def _eq(eq: dict) -> dict:
        return {k: ("is.null" if v is None else f"eq.{v}") for k, v in eq.items()}

    def claim(self, worker):
        rows = self._rest("POST", "rpc/claim_analysis_job", json={"p_worker": worker})
        return rows[0] if rows else None

    def finish(self, job_id, error=None):
        from datetime import datetime, timezone
        patch = {"status": "failed" if error else "done", "finished_at": datetime.now(timezone.utc).isoformat(), "error": (error or None) and error[:2000]}
        self._rest("PATCH", f"analysis_jobs?id=eq.{job_id}", json=patch)

    def get(self, table, **eq):
        rows = self._rest("GET", table, params={**self._eq(eq), "limit": 1})
        return rows[0] if rows else None

    def rows(self, table, **eq):
        return self._rest("GET", table, params=self._eq(eq))

    def insert(self, table, row):
        return self._rest("POST", table, json=row, headers={"Prefer": "return=representation"})[0]

    def update(self, table, patch, **eq):
        self._rest("PATCH", table, params=self._eq(eq), json=patch)

    def enqueue(self, capture_id, kind, reference_capture_id=None, params=None):
        r = self.s.post(f"{self.url}/rest/v1/analysis_jobs", json={"capture_id": capture_id, "kind": kind, "reference_capture_id": reference_capture_id, "params": params}, timeout=self.timeout)
        if r.status_code >= 400 and "duplicate" not in r.text:
            raise RuntimeError(f"enqueue: {r.status_code} {r.text[:200]}")

    def download(self, path):
        r = self.s.get(f"{self.url}/storage/v1/object/authenticated/{BUCKET}/{quote(path)}", timeout=self.timeout)
        if r.status_code >= 400:
            raise RuntimeError(f"download {path}: {r.status_code}")
        return r.content

    def upload(self, path, data, content_type):
        r = self.s.post(f"{self.url}/storage/v1/object/{BUCKET}/{quote(path)}", data=data,
                        headers={"Content-Type": content_type, "x-upsert": "true"}, timeout=self.timeout)
        if r.status_code >= 400:
            raise RuntimeError(f"upload {path}: {r.status_code} {r.text[:200]}")
