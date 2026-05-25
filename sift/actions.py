"""Turn classifications into mailbox operations, with safe-by-default execution.

Modes:
  * dry_run=True (default): nothing is changed; operations are only described.
  * dry_run=False: apply labels, flag priority, archive low-value, and move
    junk to Trash (recoverable).
  * purge=True (requires not dry_run): hard-delete junk instead of trashing.
"""

from __future__ import annotations

import logging

from .models import Action, ActionResult, ClassifiedEmail
from .providers.base import EmailProvider

logger = logging.getLogger("sift.actions")


def apply_actions(
    provider: EmailProvider,
    classified: list[ClassifiedEmail],
    dry_run: bool = True,
    purge: bool = False,
) -> list[ActionResult]:
    results: list[ActionResult] = []
    for item in classified:
        results.append(_apply_one(provider, item, dry_run=dry_run, purge=purge))
    return results


def _apply_one(
    provider: EmailProvider, item: ClassifiedEmail, *, dry_run: bool, purge: bool
) -> ActionResult:
    email = item.email
    cls = item.classification
    category_label = cls.category.value.title()
    planned: list[str] = [f"label:{category_label}"]

    action = cls.action
    if action == Action.FLAG:
        planned.append("flag")
    elif action == Action.ARCHIVE:
        planned.append("archive")
    elif action == Action.TRASH:
        planned.append("delete" if purge else "trash")

    if dry_run:
        return ActionResult(email, cls, planned, applied=False)

    try:
        provider.apply_category_label(email, category_label)
        if action == Action.FLAG:
            provider.flag(email)
        elif action == Action.ARCHIVE:
            provider.archive(email)
        elif action == Action.TRASH:
            if purge:
                provider.delete(email)
            else:
                provider.move_to_trash(email)
        return ActionResult(email, cls, planned, applied=True)
    except Exception as exc:  # provider/API error on a single message
        logger.warning("Action failed for %s (%s): %s", email.id, email.subject, exc)
        return ActionResult(email, cls, planned, applied=False, error=str(exc))
