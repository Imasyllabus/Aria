"""Abstract mailbox provider interface."""

from __future__ import annotations

from abc import ABC, abstractmethod

from ..models import EmailMessage, Provider


class EmailProvider(ABC):
    name: Provider

    @abstractmethod
    def fetch(
        self, max_results: int = 50, query: str | None = None, unread_only: bool = False
    ) -> list[EmailMessage]:
        """Return recent messages from the mailbox."""

    @abstractmethod
    def apply_category_label(self, email: EmailMessage, category_label: str) -> None:
        """Tag the message with a category (Gmail label / Outlook category)."""

    @abstractmethod
    def flag(self, email: EmailMessage) -> None:
        """Star / flag the message."""

    @abstractmethod
    def archive(self, email: EmailMessage) -> None:
        """Remove the message from the inbox without deleting it."""

    @abstractmethod
    def move_to_trash(self, email: EmailMessage) -> None:
        """Move the message to Trash / Deleted Items (recoverable)."""

    @abstractmethod
    def delete(self, email: EmailMessage) -> None:
        """Permanently delete the message (NOT recoverable)."""
