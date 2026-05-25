"""Core domain types: a provider-agnostic email and its classification."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum


class Provider(str, Enum):
    GMAIL = "gmail"
    OUTLOOK = "outlook"


class Importance(str, Enum):
    """The triage bucket an email lands in."""

    PRIORITY = "priority"      # urgent AND important — act now
    IMPORTANT = "important"    # important, not time-critical
    NEEDS_READ = "needs_read"  # should be read, normal priority
    LOW = "low"                # not important — skippable
    JUNK = "junk"              # delete candidate


class Category(str, Enum):
    """The topical folder an email is sorted into."""

    WORK = "work"
    PERSONAL = "personal"
    FINANCE = "finance"
    TRAVEL = "travel"
    SHOPPING = "shopping"
    NEWSLETTER = "newsletter"
    PROMOTION = "promotion"
    SOCIAL = "social"
    NOTIFICATION = "notification"
    SPAM = "spam"
    OTHER = "other"


class Action(str, Enum):
    """The suggested disposition for an email."""

    FLAG = "flag"        # star / flag — surface it
    KEEP = "keep"        # leave in inbox as-is
    ARCHIVE = "archive"  # remove from inbox, retain
    TRASH = "trash"      # move to trash (recoverable)
    NONE = "none"


@dataclass
class EmailMessage:
    provider: Provider
    id: str
    sender: str            # lowercased email address
    sender_name: str
    subject: str
    snippet: str
    body_text: str
    to: list[str] = field(default_factory=list)
    thread_id: str | None = None
    date: datetime | None = None
    labels: list[str] = field(default_factory=list)
    unread: bool = False
    headers: dict[str, str] = field(default_factory=dict)

    @property
    def sender_domain(self) -> str:
        addr = self.sender or ""
        if "@" in addr:
            return addr.rsplit("@", 1)[1].strip().strip(">").lower()
        return ""

    def header(self, name: str) -> str | None:
        target = name.lower()
        for key, value in self.headers.items():
            if key.lower() == target:
                return value
        return None


@dataclass
class Classification:
    importance: Importance
    category: Category
    action: Action
    confidence: float       # 0.0 - 1.0
    reason: str
    source: str = "rules"   # "rules" or "ai"


@dataclass
class ClassifiedEmail:
    email: EmailMessage
    classification: Classification


@dataclass
class ActionResult:
    email: EmailMessage
    classification: Classification
    operations: list[str]   # human-readable operations performed or planned
    applied: bool           # True if executed against the provider
    error: str | None = None
