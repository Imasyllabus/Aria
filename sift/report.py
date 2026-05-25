"""Human-readable and JSON rendering of a classification run."""

from __future__ import annotations

import json
from collections import Counter, defaultdict
from datetime import datetime

from .models import Importance
from .pipeline import RunResult
from .util import truncate

_IMPORTANCE_ORDER = [
    Importance.PRIORITY,
    Importance.IMPORTANT,
    Importance.NEEDS_READ,
    Importance.LOW,
    Importance.JUNK,
]
_IMPORTANCE_TITLE = {
    Importance.PRIORITY: "PRIORITY — act now",
    Importance.IMPORTANT: "IMPORTANT",
    Importance.NEEDS_READ: "NEEDS READING",
    Importance.LOW: "NOT IMPORTANT",
    Importance.JUNK: "TO DELETE",
}


def render_text(result: RunResult, *, dry_run: bool, purge: bool) -> str:
    lines: list[str] = []
    total = len(result.classified)

    if result.fetch_errors:
        lines.append("Fetch errors:")
        for provider, err in result.fetch_errors.items():
            lines.append(f"  ! {provider}: {err}")
        lines.append("")

    if total == 0:
        lines.append("No emails fetched.")
        return "\n".join(lines)

    buckets = defaultdict(list)
    for item in result.classified:
        buckets[item.classification.importance].append(item)

    # Summary counts.
    counts = Counter(i.classification.importance for i in result.classified)
    cat_counts = Counter(i.classification.category.value for i in result.classified)
    ai_count = sum(1 for i in result.classified if i.classification.source == "ai")
    lines.append(f"Triaged {total} emails ({ai_count} via AI):")
    for imp in _IMPORTANCE_ORDER:
        if counts.get(imp):
            lines.append(f"  {_IMPORTANCE_TITLE[imp]:<22} {counts[imp]}")
    lines.append("  categories: " + ", ".join(f"{k}={v}" for k, v in cat_counts.most_common()))
    lines.append("")

    # Per-bucket detail.
    for imp in _IMPORTANCE_ORDER:
        items = buckets.get(imp)
        if not items:
            continue
        lines.append(f"== {_IMPORTANCE_TITLE[imp]} ({len(items)}) ==")
        items.sort(key=_sort_key, reverse=True)
        for it in items:
            e = it.email
            c = it.classification
            src = "*" if c.source == "ai" else " "
            lines.append(
                f" {src}[{e.provider.value}/{c.category.value}] "
                f"{truncate(e.sender_name or e.sender, 28):<28} | {truncate(e.subject, 60)}"
            )
            lines.append(f"      -> {c.action.value} ({c.confidence:.2f}) {c.reason}")
        lines.append("")

    # Action summary.
    if result.actions:
        applied = sum(1 for a in result.actions if a.applied)
        errored = [a for a in result.actions if a.error]
        mode = "DRY RUN — nothing changed" if dry_run else (
            "APPLIED (purge: permanent delete)" if purge else "APPLIED (junk -> Trash)"
        )
        lines.append(f"Actions [{mode}]: {applied}/{len(result.actions)} executed.")
        if errored:
            lines.append(f"  {len(errored)} action error(s):")
            for a in errored[:10]:
                lines.append(f"    ! {a.email.provider.value}: {truncate(a.email.subject, 50)} — {a.error}")
        if dry_run:
            lines.append("  Re-run with --apply to make changes (junk goes to Trash, recoverable).")

    return "\n".join(lines)


def render_json(result: RunResult) -> str:
    payload = {
        "fetch_errors": result.fetch_errors,
        "emails": [
            {
                "provider": it.email.provider.value,
                "id": it.email.id,
                "from": it.email.sender,
                "from_name": it.email.sender_name,
                "subject": it.email.subject,
                "date": it.email.date.isoformat() if it.email.date else None,
                "importance": it.classification.importance.value,
                "category": it.classification.category.value,
                "action": it.classification.action.value,
                "confidence": round(it.classification.confidence, 3),
                "reason": it.classification.reason,
                "source": it.classification.source,
            }
            for it in result.classified
        ],
        "actions": [
            {
                "provider": a.email.provider.value,
                "id": a.email.id,
                "operations": a.operations,
                "applied": a.applied,
                "error": a.error,
            }
            for a in result.actions
        ],
    }
    return json.dumps(payload, indent=2)


def _sort_key(item):
    """Newest-first sort key that tolerates naive/aware/missing dates."""
    date = item.email.date
    if not isinstance(date, datetime):
        return 0.0
    try:
        return date.timestamp()
    except (OverflowError, OSError, ValueError):
        return 0.0
