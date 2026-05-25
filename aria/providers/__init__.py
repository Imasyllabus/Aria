"""Mailbox providers. Heavy SDK imports are deferred to each provider module."""

from .base import EmailProvider

__all__ = ["EmailProvider", "build_provider"]


def build_provider(provider, config):
    """Instantiate a provider from a Provider enum + Config."""
    from ..models import Provider

    if provider == Provider.GMAIL:
        from .gmail import GmailProvider

        return GmailProvider(config.gmail)
    if provider == Provider.OUTLOOK:
        from .outlook import OutlookProvider

        return OutlookProvider(config.outlook)
    raise ValueError(f"Unsupported provider: {provider}")
