"""Configuration loaded from environment variables (and an optional .env file)."""

from __future__ import annotations

import os
from dataclasses import dataclass, field

from .models import Provider


def _load_dotenv() -> None:
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    load_dotenv()


def _split_csv(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass
class GmailConfig:
    credentials_file: str = "credentials.json"
    token_file: str = "gmail_token.json"
    scope: str = "modify"  # "modify" or "full"


@dataclass
class OutlookConfig:
    client_id: str = ""
    tenant_id: str = "common"
    token_cache: str = "outlook_token_cache.json"


@dataclass
class AIConfig:
    api_key: str = ""
    model: str = "claude-opus-4-7"
    effort: str = "low"
    batch_size: int = 20


@dataclass
class Config:
    providers: list[Provider] = field(default_factory=list)
    max_results: int = 50
    confidence_threshold: float = 0.6
    vip_senders: list[str] = field(default_factory=list)
    gmail: GmailConfig = field(default_factory=GmailConfig)
    outlook: OutlookConfig = field(default_factory=OutlookConfig)
    ai: AIConfig = field(default_factory=AIConfig)

    @classmethod
    def from_env(cls) -> "Config":
        _load_dotenv()

        providers: list[Provider] = []
        for name in _split_csv(os.getenv("ARIA_PROVIDERS", "gmail,outlook")):
            try:
                providers.append(Provider(name.lower()))
            except ValueError:
                raise ValueError(
                    f"Unknown provider {name!r} in ARIA_PROVIDERS (use 'gmail' and/or 'outlook')."
                )

        return cls(
            providers=providers,
            max_results=int(os.getenv("ARIA_MAX_RESULTS", "50")),
            confidence_threshold=float(os.getenv("ARIA_CONFIDENCE_THRESHOLD", "0.6")),
            vip_senders=[s.lower() for s in _split_csv(os.getenv("ARIA_VIP_SENDERS"))],
            gmail=GmailConfig(
                credentials_file=os.getenv("GMAIL_CREDENTIALS_FILE", "credentials.json"),
                token_file=os.getenv("GMAIL_TOKEN_FILE", "gmail_token.json"),
                scope=os.getenv("GMAIL_SCOPE", "modify").lower(),
            ),
            outlook=OutlookConfig(
                client_id=os.getenv("OUTLOOK_CLIENT_ID", ""),
                tenant_id=os.getenv("OUTLOOK_TENANT_ID", "common"),
                token_cache=os.getenv("OUTLOOK_TOKEN_CACHE", "outlook_token_cache.json"),
            ),
            ai=AIConfig(
                api_key=os.getenv("ANTHROPIC_API_KEY", ""),
                model=os.getenv("ARIA_AI_MODEL", "claude-opus-4-7"),
                effort=os.getenv("ARIA_AI_EFFORT", "low").lower(),
                batch_size=int(os.getenv("ARIA_AI_BATCH_SIZE", "20")),
            ),
        )
