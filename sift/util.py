"""Small parsing helpers shared across providers."""

from __future__ import annotations

import base64
import html as _html
import re
from email.utils import parseaddr

_TAG_RE = re.compile(r"<[^>]+>")
_SCRIPT_STYLE_RE = re.compile(r"(?is)<(script|style)\b.*?>.*?</\1>")
_INLINE_WS_RE = re.compile(r"[ \t\r\f\v]+")


def decode_b64url(data: str) -> bytes:
    """Decode Gmail's base64url payloads, tolerating missing padding."""
    if not data:
        return b""
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def html_to_text(html_str: str) -> str:
    """Strip HTML to a readable plain-text approximation."""
    if not html_str:
        return ""
    text = _SCRIPT_STYLE_RE.sub(" ", html_str)
    text = _TAG_RE.sub(" ", text)
    text = _html.unescape(text)
    text = _INLINE_WS_RE.sub(" ", text)
    lines = (line.strip() for line in text.splitlines())
    return "\n".join(line for line in lines if line)


def parse_address(raw: str) -> tuple[str, str]:
    """Return (display_name, lowercased_email) from a raw From/To header value."""
    name, addr = parseaddr(raw or "")
    return name.strip(), addr.strip().lower()


def truncate(text: str, limit: int) -> str:
    text = (text or "").strip()
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"
