"""Claude-backed classifier for the ambiguous cases the rules can't settle.

Design notes (high-volume, cost-sensitive workload):
  * Emails are sent in batches (one request classifies many) to amortize the
    fixed per-request overhead and the cached system prompt.
  * The taxonomy lives in a frozen `system` block with `cache_control` so the
    prefix is reused across requests (cache reads cost ~0.1x).
  * Structured outputs (`output_config.format`) guarantee parseable JSON.
  * Defaults to claude-opus-4-7; set SIFT_AI_MODEL=claude-haiku-4-5 for the
    cheapest run. `effort` is only sent to models that support it.
"""

from __future__ import annotations

import json
import logging

from ..models import Action, Category, Classification, EmailMessage, Importance
from ..util import truncate

logger = logging.getLogger("sift.ai")

_IMPORTANCE_VALUES = [m.value for m in Importance]
_CATEGORY_VALUES = [c.value for c in Category]
_ACTION_VALUES = [a.value for a in Action]

# Effort is GA on Opus 4.5+ and Sonnet 4.6 only; it errors on Haiku/older Sonnet.
_EFFORT_MODEL_PREFIXES = ("claude-opus-4-5", "claude-opus-4-6", "claude-opus-4-7", "claude-sonnet-4-6")

SYSTEM_PROMPT = f"""\
You are an email triage assistant. For each email you receive, decide three things.

1. importance — one of:
   - priority: urgent AND important; the user must act now (deadlines, security
     alerts, a real person needing a timely reply, money at risk).
   - important: matters to the user but is not time-critical (receipts, bills,
     account statements, meaningful personal mail).
   - needs_read: should be read at some point; normal priority (newsletters the
     user subscribed to, order/shipping updates, informational threads).
   - low: not important; safe to skip or archive (marketing, social pings,
     automated low-value notifications).
   - junk: should be deleted (spam, scams, dead/irrelevant bulk mail).

2. category — one of: {", ".join(_CATEGORY_VALUES)}.

3. action — the suggested disposition, one of:
   - flag: surface it (use for priority).
   - keep: leave in the inbox as-is.
   - archive: remove from inbox but retain (use for low-value but non-junk).
   - trash: move to trash (use for junk only).
   - none.

Rules of thumb: pair priority->flag, junk->trash, low->archive. When unsure
between two buckets, pick the SAFER one (never trash something that might
matter). Give a terse one-line reason. Respond for every email by its index.\
"""

_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "classifications": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "index": {"type": "integer"},
                    "importance": {"type": "string", "enum": _IMPORTANCE_VALUES},
                    "category": {"type": "string", "enum": _CATEGORY_VALUES},
                    "action": {"type": "string", "enum": _ACTION_VALUES},
                    "reason": {"type": "string"},
                },
                "required": ["index", "importance", "category", "action", "reason"],
            },
        }
    },
    "required": ["classifications"],
}


class AIClassifier:
    def __init__(
        self,
        api_key: str = "",
        model: str = "claude-opus-4-7",
        effort: str = "low",
        batch_size: int = 20,
        client=None,
    ):
        self.model = model
        self.effort = effort
        self.batch_size = max(1, batch_size)
        if client is not None:
            self.client = client
        else:
            try:
                import anthropic
            except ImportError as exc:  # pragma: no cover - import guard
                raise RuntimeError(
                    "The 'anthropic' package is required for AI classification. "
                    "Install it or run with --no-ai."
                ) from exc
            self.client = anthropic.Anthropic(api_key=api_key or None)

    def classify_batch(self, emails: list[EmailMessage]) -> list[Classification]:
        """Classify a list of emails, returning one Classification each, in order."""
        results: list[Classification | None] = [None] * len(emails)
        for start in range(0, len(emails), self.batch_size):
            chunk = emails[start : start + self.batch_size]
            chunk_results = self._classify_chunk(chunk)
            for offset, classification in enumerate(chunk_results):
                results[start + offset] = classification
        # Any gaps (shouldn't happen) fall back to a neutral guess.
        return [r or _fallback() for r in results]

    def _classify_chunk(self, emails: list[EmailMessage]) -> list[Classification]:
        user_payload = _render_emails(emails)
        output_config: dict = {"format": {"type": "json_schema", "schema": _SCHEMA}}
        if self.model.startswith(_EFFORT_MODEL_PREFIXES) and self.effort:
            output_config["effort"] = self.effort

        response = self.client.messages.create(
            model=self.model,
            max_tokens=4096,
            system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
            output_config=output_config,
            messages=[{"role": "user", "content": user_payload}],
        )
        text = next((b.text for b in response.content if b.type == "text"), "")
        return _parse_response(text, len(emails))


def _render_emails(emails: list[EmailMessage]) -> str:
    lines = ["Classify these emails. Return one entry per index.\n"]
    for i, email in enumerate(emails):
        lines.append(
            f"[{i}] from: {email.sender_name or email.sender} <{email.sender}>\n"
            f"    subject: {truncate(email.subject, 200)}\n"
            f"    has_unsubscribe: {bool(email.header('List-Unsubscribe'))}\n"
            f"    body: {truncate(email.body_text or email.snippet, 600)}"
        )
    return "\n".join(lines)


def _parse_response(text: str, expected: int) -> list[Classification]:
    results: list[Classification | None] = [None] * expected
    try:
        data = json.loads(text)
    except (json.JSONDecodeError, TypeError):
        logger.warning("AI classifier returned unparseable output; falling back.")
        return [_fallback() for _ in range(expected)]

    for item in data.get("classifications", []):
        idx = item.get("index")
        if not isinstance(idx, int) or not (0 <= idx < expected):
            continue
        results[idx] = Classification(
            importance=_coerce(Importance, item.get("importance"), Importance.NEEDS_READ),
            category=_coerce(Category, item.get("category"), Category.OTHER),
            action=_coerce(Action, item.get("action"), Action.KEEP),
            confidence=0.9,
            reason=str(item.get("reason", "")).strip() or "AI classification.",
            source="ai",
        )
    return [r or _fallback() for r in results]


def _coerce(enum_cls, value, default):
    try:
        return enum_cls(value)
    except (ValueError, KeyError):
        return default


def _fallback() -> Classification:
    return Classification(
        Importance.NEEDS_READ, Category.OTHER, Action.KEEP, 0.3,
        "AI fallback (no usable result).", "ai",
    )
