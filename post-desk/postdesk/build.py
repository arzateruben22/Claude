"""Assembles a desk: the demo one (make-believe X) or the live one (your account)."""
from __future__ import annotations

import copy
from datetime import datetime
from pathlib import Path
from typing import Optional

from .budget import Budget
from .config import Config
from .desk import Desk
from .feeds import DemoFeeds, Feeds
from .review import make_reviewer
from .store import Store
from .writer import ManualWriter, make_writer

DEMO_CURATED = {"informative": ("opsgarden", "builderbecca"),   # make-believe accounts in the demo's timeline
                "comedy": ("liftlaughs", "ravecore")}


def demo_desk(cfg: Config, start: datetime, folder: Optional[Path], seed: int = 7, allow_ai: bool = False,
              store: Optional[Store] = None, demo_reviewer: bool = True) -> Desk:
    from .xsim import DemoX

    if store is None:
        folder.mkdir(parents=True, exist_ok=True)
        (folder / "desk.db").unlink(missing_ok=True)          # every demo starts from nothing
        (folder / "lessons.md").unlink(missing_ok=True)
        store = Store(folder / "desk.db")
    cfg = copy.deepcopy(cfg)
    if not cfg.topics.curated_reposts:                         # so the demo shows reposts too
        cfg.topics.curated_reposts = list(DEMO_CURATED[cfg.writer.style])
    budget = Budget(cfg.budget, store, cfg.tz, cfg.writer.ai_daily_usd)
    x = DemoX(start, budget, cfg.tz, seed=seed, handle=cfg.account.handle, style=cfg.writer.style)
    writer = make_writer(cfg, budget, demo=True, allow_ai=allow_ai)
    reviewer = make_reviewer(cfg, budget, allow_ai=allow_ai)
    return Desk(cfg, x, writer, DemoFeeds(seed, cfg.writer.style), store, budget, start, mode="demo", folder=folder,
                reviewer=reviewer, demo_reviewer=demo_reviewer, seed=seed)


def live_desk(cfg: Config, now: datetime, folder: Path) -> Desk:
    from .xapi import XClient

    store = Store(folder / "desk.db")
    budget = Budget(cfg.budget, store, cfg.tz, cfg.writer.ai_daily_usd)
    x = XClient(budget)                                        # raises AuthError until you run `auth`
    return Desk(cfg, x, make_writer(cfg, budget, demo=False), Feeds(cfg.topics.rss), store, budget, now,
                mode="live", folder=folder, reviewer=make_reviewer(cfg, budget))


def offline_desk(cfg: Config, now: datetime, folder: Path, writer=None) -> Desk:
    """For the command line's queue/approve/reject/add: no X connection, nothing posts."""
    store = Store(folder / "desk.db")
    budget = Budget(cfg.budget, store, cfg.tz, cfg.writer.ai_daily_usd)
    return Desk(cfg, None, writer or ManualWriter(), None, store, budget, now, mode=folder.name, folder=folder)
