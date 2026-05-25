"""Orchestration: fetch from all mailboxes concurrently, classify, act."""

from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field

from .actions import apply_actions
from .classify.ai import AIClassifier
from .classify.engine import HybridClassifier
from .config import Config
from .models import ActionResult, ClassifiedEmail, EmailMessage, Provider
from .providers import build_provider

logger = logging.getLogger("sift.pipeline")


def email_key(email: EmailMessage) -> str:
    """Stable cross-mailbox identifier used for de-duplication / state."""
    return f"{email.provider.value}:{email.id}"


@dataclass
class RunOptions:
    providers: list[Provider] | None = None
    max_results: int | None = None
    unread_only: bool = False
    query: str | None = None
    use_ai: bool = False
    dry_run: bool = True
    purge: bool = False
    skip_ids: set[str] | None = None  # email_key()s already processed (watch mode)


@dataclass
class RunResult:
    classified: list[ClassifiedEmail] = field(default_factory=list)
    actions: list[ActionResult] = field(default_factory=list)
    fetch_errors: dict[str, str] = field(default_factory=dict)


def _fetch_one(provider_enum: Provider, config: Config, options: RunOptions):
    provider = build_provider(provider_enum, config)
    emails = provider.fetch(
        max_results=options.max_results or config.max_results,
        query=options.query,
        unread_only=options.unread_only,
    )
    return provider, emails


def run(config: Config, options: RunOptions) -> RunResult:
    providers = options.providers or config.providers
    if not providers:
        raise ValueError("No providers configured. Set SIFT_PROVIDERS or pass --provider.")

    result = RunResult()
    provider_clients: dict[Provider, object] = {}
    emails_by_provider: dict[Provider, list[EmailMessage]] = {}

    # Read all mailboxes at the same time.
    with ThreadPoolExecutor(max_workers=len(providers)) as pool:
        futures = {pool.submit(_fetch_one, p, config, options): p for p in providers}
        for future, provider_enum in futures.items():
            try:
                client, emails = future.result()
                provider_clients[provider_enum] = client
                emails_by_provider[provider_enum] = emails
                logger.info("Fetched %d emails from %s.", len(emails), provider_enum.value)
            except Exception as exc:
                result.fetch_errors[provider_enum.value] = str(exc)
                logger.error("Failed to fetch from %s: %s", provider_enum.value, exc)

    all_emails = [e for emails in emails_by_provider.values() for e in emails]
    if options.skip_ids:
        all_emails = [e for e in all_emails if email_key(e) not in options.skip_ids]
    if not all_emails:
        return result

    # Classify the combined stream once.
    ai_classifier = None
    if options.use_ai:
        ai_classifier = AIClassifier(
            api_key=config.ai.api_key,
            model=config.ai.model,
            effort=config.ai.effort,
            batch_size=config.ai.batch_size,
        )
    engine = HybridClassifier(
        vip_senders=config.vip_senders,
        confidence_threshold=config.confidence_threshold,
        ai_classifier=ai_classifier,
    )
    result.classified = engine.classify(all_emails)

    # Apply (or plan) actions per provider so each uses the right client.
    by_provider: dict[Provider, list[ClassifiedEmail]] = {}
    for item in result.classified:
        by_provider.setdefault(item.email.provider, []).append(item)

    for provider_enum, items in by_provider.items():
        client = provider_clients.get(provider_enum)
        if client is None:
            continue
        result.actions.extend(
            apply_actions(client, items, dry_run=options.dry_run, purge=options.purge)
        )

    return result
