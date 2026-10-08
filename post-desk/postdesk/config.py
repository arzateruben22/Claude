"""Loads desk.toml into typed settings, and .env into the environment."""
from __future__ import annotations

import os
import re
from dataclasses import dataclass, field, fields
from pathlib import Path
from typing import List
from zoneinfo import ZoneInfo

try:
    import tomllib
except ModuleNotFoundError:  # Python 3.10
    import tomli as tomllib  # type: ignore[no-redef]

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "output"
SECRETS = ROOT / ".secrets"
EFFORTS = ("low", "medium", "high", "xhigh", "max")


@dataclass
class AccountCfg:
    handle: str = "yourhandle"
    niche: str = "AI tools"
    audience: str = "builders"
    voice: str = "plain and confident"
    language: str = "en"
    premium: bool = True
    timezone: str = "America/Los_Angeles"
    notes: List[str] = field(default_factory=list)   # true facts the writer may use: your projects, results


@dataclass
class TopicsCfg:
    include: List[str] = field(default_factory=list)
    avoid: List[str] = field(default_factory=list)
    keywords: List[str] = field(default_factory=list)
    watch_accounts: List[str] = field(default_factory=list)
    curated_reposts: List[str] = field(default_factory=list)
    rss: List[str] = field(default_factory=list)


@dataclass
class ScheduleCfg:
    posts_per_day: int = 8
    active_hours: str = "07:00-23:00"
    min_gap_minutes: int = 60
    jitter_minutes: int = 10
    max_quotes_per_day: int = 2
    max_reposts_per_day: int = 2
    explore_share: float = 0.2


@dataclass
class ApprovalCfg:
    mode: str = "review"
    auto_curated_reposts: bool = False
    expire_hours: float = 24
    min_queue: int = 6


@dataclass
class WriterCfg:
    use_ai: bool = True
    model: str = "claude-opus-5-5"
    effort: str = "medium"
    drafts_per_batch: int = 6
    formats: List[str] = field(default_factory=lambda: ["take", "list", "how_to", "question", "story", "data"])
    max_chars: int = 280
    hashtags_max: int = 1
    links: str = "never"
    ai_daily_usd: float = 0.50


@dataclass
class ScoutCfg:
    every_minutes: int = 240
    max_results: int = 20
    min_likes: int = 50
    lookback_hours: float = 12
    quote_ideas: int = 2


@dataclass
class BudgetCfg:
    daily_usd: float = 1.00
    monthly_usd: float = 25.00
    reads_share: float = 0.6
    post: float = 0.015
    post_with_link: float = 0.20
    read_post: float = 0.005
    read_user: float = 0.010
    owned_read: float = 0.001


@dataclass
class MoneyCfg:
    min_verified_followers: int = 500
    min_impressions_90d: int = 500_000
    verified_followers: int = 0
    affiliate_domains: List[str] = field(default_factory=list)
    disclosure: str = "#ad"


@dataclass
class ReviewCfg:
    use_ai: bool = True
    model: str = "claude-opus-5-5"
    effort: str = "high"
    lookback_days: float = 7


@dataclass
class Config:
    account: AccountCfg = field(default_factory=AccountCfg)
    topics: TopicsCfg = field(default_factory=TopicsCfg)
    schedule: ScheduleCfg = field(default_factory=ScheduleCfg)
    approval: ApprovalCfg = field(default_factory=ApprovalCfg)
    writer: WriterCfg = field(default_factory=WriterCfg)
    scout: ScoutCfg = field(default_factory=ScoutCfg)
    budget: BudgetCfg = field(default_factory=BudgetCfg)
    money: MoneyCfg = field(default_factory=MoneyCfg)
    review: ReviewCfg = field(default_factory=ReviewCfg)

    @property
    def tz(self) -> ZoneInfo:
        return ZoneInfo(self.account.timezone)


def parse_hours(text: str):
    """'07:00-23:00' -> (420, 1380) minutes after midnight."""
    m = re.fullmatch(r"\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\s*", text)
    if not m:
        raise ValueError(f"active_hours must look like 07:00-23:00, got {text!r}")
    a = int(m.group(1)) * 60 + int(m.group(2))
    b = int(m.group(3)) * 60 + int(m.group(4))
    if not 0 <= a < b <= 24 * 60:
        raise ValueError("active_hours must start before it ends, inside one day")
    return a, b


def load(path: Path | None = None) -> Config:
    path = path or ROOT / "desk.toml"
    with open(path, "rb") as fh:
        raw = tomllib.load(fh)
    cfg = Config()
    for section in fields(Config):
        values = raw.pop(section.name, {})
        target = getattr(cfg, section.name)
        unknown = sorted(set(values) - {f.name for f in fields(target)})
        if unknown:
            raise ValueError(f"Unknown setting(s) in [{section.name}] of {path.name}: {', '.join(unknown)}")
        for key, value in values.items():
            setattr(target, key, value)
    if raw:
        raise ValueError(f"Unknown section(s) in {path.name}: {', '.join(sorted(raw))}")
    validate(cfg)
    return cfg


def validate(cfg: Config) -> None:
    if cfg.approval.mode not in ("review", "auto_originals"):
        raise ValueError("[approval] mode must be review or auto_originals")
    if cfg.writer.links not in ("never", "allowed"):
        raise ValueError("[writer] links must be never or allowed")
    for name in ("writer", "review"):
        if getattr(cfg, name).effort not in EFFORTS:
            raise ValueError(f"[{name}] effort must be one of {', '.join(EFFORTS)}")
    a, b = parse_hours(cfg.schedule.active_hours)
    s = cfg.schedule
    if s.posts_per_day < 0 or s.posts_per_day > 48:
        raise ValueError("[schedule] posts_per_day must be between 0 and 48")
    if s.posts_per_day and (b - a) / s.posts_per_day < s.min_gap_minutes:
        raise ValueError(f"[schedule] {s.posts_per_day} posts don't fit in {s.active_hours} "
                         f"with {s.min_gap_minutes} minutes between them")
    ZoneInfo(cfg.account.timezone)   # raises on a typo
    cfg.account.handle = cfg.account.handle.lstrip("@")
    cfg.topics.curated_reposts = [h.lstrip("@").lower() for h in cfg.topics.curated_reposts]
    cfg.topics.watch_accounts = [h.lstrip("@") for h in cfg.topics.watch_accounts]


def load_env(path: Path | None = None) -> None:
    """KEY=value lines from .env; real environment variables win."""
    path = path or ROOT / ".env"
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        value = value.strip()
        if value[:1] in ("'", '"') and value[:1] in value[1:]:
            value = value[1 : value.index(value[0], 1)]
        else:
            value = value.split(" #", 1)[0].strip()
        os.environ.setdefault(key.strip(), value)
