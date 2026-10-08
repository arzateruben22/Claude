"""SQLite storage: drafts, post metrics, follower counts, scout signals and the spending ledger.

One file per mode (output/live/desk.db, output/demo/desk.db). The desk's thread and the
dashboard's request threads share it, so every method takes the lock.
"""
from __future__ import annotations

import json
import sqlite3
import threading
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Iterable, List, Optional

from .models import Check, Draft, Metric, Signal

SCHEMA = """
CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY, created TEXT, kind TEXT, text TEXT, format TEXT, topic TEXT, source_url TEXT,
  target_id TEXT, target_author TEXT, target_text TEXT, status TEXT, checks TEXT, by TEXT, why TEXT,
  posted_id TEXT, posted_at TEXT, error TEXT, decided_by TEXT);
CREATE INDEX IF NOT EXISTS drafts_status ON drafts(status);
CREATE TABLE IF NOT EXISTS metrics (
  post_id TEXT PRIMARY KEY, updated TEXT, impressions INT, likes INT, reposts INT, replies INT,
  quotes INT, bookmarks INT, profile_clicks INT);
CREATE TABLE IF NOT EXISTS followers (at TEXT, count INT);
CREATE TABLE IF NOT EXISTS signals (
  id TEXT PRIMARY KEY, seen TEXT, source TEXT, text TEXT, url TEXT, author TEXT, created TEXT,
  likes INT, reposts INT, replies INT, score REAL, used INT DEFAULT 0, author_id TEXT);
CREATE TABLE IF NOT EXISTS ledger (at TEXT, kind TEXT, units INT, usd REAL, what TEXT);
CREATE TABLE IF NOT EXISTS income (at TEXT, usd REAL, source TEXT, note TEXT);
CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT);
"""


def _ts(dt: Optional[datetime]) -> Optional[str]:
    return dt.isoformat() if dt else None


def _dt(s: Optional[str]) -> Optional[datetime]:
    return datetime.fromisoformat(s) if s else None


class Store:
    def __init__(self, path: Path | str):
        if str(path) != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(str(path), check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.lock = threading.RLock()
        with self.lock:
            self.db.executescript(SCHEMA)
            self.db.commit()

    # -- drafts ---------------------------------------------------------------------
    def save_draft(self, d: Draft) -> None:
        row = (d.id, _ts(d.created), d.kind, d.text, d.format, d.topic, d.source_url, d.target_id, d.target_author,
               d.target_text, d.status, json.dumps([c.to_dict() for c in d.checks]), d.by, d.why, d.posted_id,
               _ts(d.posted_at), d.error, d.decided_by)
        with self.lock:
            self.db.execute("INSERT OR REPLACE INTO drafts VALUES (" + ",".join("?" * len(row)) + ")", row)
            self.db.commit()

    @staticmethod
    def _draft(r: sqlite3.Row) -> Draft:
        return Draft(id=r["id"], created=_dt(r["created"]), kind=r["kind"], text=r["text"], format=r["format"],
                     topic=r["topic"], source_url=r["source_url"], target_id=r["target_id"],
                     target_author=r["target_author"], target_text=r["target_text"], status=r["status"],
                     checks=[Check(**c) for c in json.loads(r["checks"] or "[]")], by=r["by"], why=r["why"],
                     posted_id=r["posted_id"], posted_at=_dt(r["posted_at"]), error=r["error"],
                     decided_by=r["decided_by"])

    def draft(self, draft_id: str) -> Optional[Draft]:
        with self.lock:
            r = self.db.execute("SELECT * FROM drafts WHERE id = ?", (draft_id,)).fetchone()
        return self._draft(r) if r else None

    def drafts(self, statuses: Iterable[str] = (), limit: int = 500, newest_first: bool = False,
               since: Optional[datetime] = None) -> List[Draft]:
        statuses = list(statuses)
        where, args = ["created >= ?"], [(since or datetime.min).isoformat()]
        if statuses:
            where.append("status IN (" + ",".join("?" * len(statuses)) + ")")
            args += statuses
        q = "SELECT * FROM drafts WHERE " + " AND ".join(where)
        q += " ORDER BY " + ("COALESCE(posted_at, created) DESC" if newest_first else "created ASC") + " LIMIT ?"
        with self.lock:
            return [self._draft(r) for r in self.db.execute(q, (*args, limit))]

    def posted_since(self, since: datetime) -> List[Draft]:
        with self.lock:
            rows = self.db.execute("SELECT * FROM drafts WHERE status = 'posted' AND posted_at >= ? ORDER BY posted_at",
                                   (since.isoformat(),)).fetchall()
        return [self._draft(r) for r in rows]

    # -- metrics and followers ---------------------------------------------------------
    def save_metric(self, m: Metric) -> None:
        with self.lock:
            self.db.execute("INSERT OR REPLACE INTO metrics VALUES (?,?,?,?,?,?,?,?,?)",
                            (m.post_id, _ts(m.updated), m.impressions, m.likes, m.reposts, m.replies, m.quotes,
                             m.bookmarks, m.profile_clicks))
            self.db.commit()

    def metrics(self) -> Dict[str, Metric]:
        with self.lock:
            rows = self.db.execute("SELECT * FROM metrics").fetchall()
        return {r["post_id"]: Metric(r["post_id"], _dt(r["updated"]), r["impressions"], r["likes"], r["reposts"],
                                     r["replies"], r["quotes"], r["bookmarks"], r["profile_clicks"]) for r in rows}

    def add_followers(self, at: datetime, count: int) -> None:
        with self.lock:
            self.db.execute("INSERT INTO followers VALUES (?, ?)", (at.isoformat(), count))
            self.db.commit()

    def followers(self, since: Optional[datetime] = None) -> List[tuple]:
        with self.lock:
            rows = self.db.execute("SELECT at, count FROM followers WHERE at >= ? ORDER BY at",
                                   ((since or datetime.min).isoformat(),)).fetchall()
        return [(_dt(r["at"]), r["count"]) for r in rows]

    # -- signals -------------------------------------------------------------------------
    def save_signal(self, s: Signal, seen: datetime) -> bool:
        """True if it's new."""
        with self.lock:
            old = self.db.execute("SELECT used FROM signals WHERE id = ?", (s.id,)).fetchone()
            self.db.execute("INSERT OR REPLACE INTO signals VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                            (s.id, seen.isoformat(), s.source, s.text, s.url, s.author, _ts(s.created), s.likes,
                             s.reposts, s.replies, s.score, old["used"] if old else 0, s.author_id))
            self.db.commit()
        return old is None

    def signals(self, since: datetime, limit: int = 30, unused_only: bool = False, source: str = "") -> List[Signal]:
        q = "SELECT * FROM signals WHERE seen >= ?" + (" AND used = 0" if unused_only else "") + \
            (" AND source = ?" if source else "") + " ORDER BY score DESC LIMIT ?"
        args = (since.isoformat(), source, limit) if source else (since.isoformat(), limit)
        with self.lock:
            rows = self.db.execute(q, args).fetchall()
        return [Signal(r["id"], r["source"], r["text"], r["url"], r["author"], _dt(r["created"]), r["likes"],
                       r["reposts"], r["replies"], r["score"], r["author_id"] or "") for r in rows]

    def is_used(self, signal_id: str) -> bool:
        with self.lock:
            r = self.db.execute("SELECT used FROM signals WHERE id = ?", (signal_id,)).fetchone()
        return bool(r and r["used"])

    def mark_signal_used(self, signal_id: str) -> None:
        with self.lock:
            self.db.execute("UPDATE signals SET used = 1 WHERE id = ?", (signal_id,))
            self.db.commit()

    # -- money out ---------------------------------------------------------------------------
    def spend(self, at: datetime, kind: str, units: int, usd: float, what: str = "") -> None:
        with self.lock:
            self.db.execute("INSERT INTO ledger VALUES (?,?,?,?,?)", (at.isoformat(), kind, units, usd, what))
            self.db.commit()

    def spent(self, since: datetime, kinds: Iterable[str] = ()) -> float:
        kinds = list(kinds)
        q = "SELECT COALESCE(SUM(usd), 0) FROM ledger WHERE at >= ?"
        if kinds:
            q += " AND kind IN (" + ",".join("?" * len(kinds)) + ")"
        with self.lock:
            return float(self.db.execute(q, (since.isoformat(), *kinds)).fetchone()[0])

    def ledger(self, since: datetime) -> List[tuple]:
        with self.lock:
            rows = self.db.execute("SELECT * FROM ledger WHERE at >= ? ORDER BY at", (since.isoformat(),)).fetchall()
        return [(_dt(r["at"]), r["kind"], r["units"], float(r["usd"]), r["what"]) for r in rows]

    def spend_by_kind(self, since: datetime) -> Dict[str, float]:
        with self.lock:
            rows = self.db.execute("SELECT kind, SUM(usd) FROM ledger WHERE at >= ? GROUP BY kind",
                                   (since.isoformat(),)).fetchall()
        return {r[0]: float(r[1]) for r in rows}

    # -- money in (you log it: X payouts, sponsors, affiliates, products) ----------------------------
    def add_income(self, at: datetime, usd: float, source: str, note: str = "") -> None:
        with self.lock:
            self.db.execute("INSERT INTO income VALUES (?,?,?,?)", (at.isoformat(), usd, source, note))
            self.db.commit()

    def income(self, since: Optional[datetime] = None) -> List[tuple]:
        with self.lock:
            rows = self.db.execute("SELECT * FROM income WHERE at >= ? ORDER BY at",
                                   ((since or datetime.min).isoformat(),)).fetchall()
        return [(_dt(r["at"]), float(r["usd"]), r["source"], r["note"]) for r in rows]

    # -- small values ----------------------------------------------------------------------------
    def get(self, key: str, default=None):
        with self.lock:
            r = self.db.execute("SELECT value FROM kv WHERE key = ?", (key,)).fetchone()
        return json.loads(r["value"]) if r else default

    def put(self, key: str, value) -> None:
        with self.lock:
            self.db.execute("INSERT OR REPLACE INTO kv VALUES (?, ?)", (key, json.dumps(value, default=str)))
            self.db.commit()

    def close(self) -> None:
        with self.lock:
            self.db.close()


def since_days(now: datetime, days: float) -> datetime:
    return now - timedelta(days=days)
