"""Gmail provider via the Gmail API (google-api-python-client)."""

from __future__ import annotations

import os
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

from ..config import GmailConfig
from ..models import EmailMessage, Provider
from ..util import decode_b64url, html_to_text, parse_address
from .base import EmailProvider

_SCOPES = {
    "modify": ["https://www.googleapis.com/auth/gmail.modify"],
    "full": ["https://mail.google.com/"],
}
_CATEGORY_LABEL_PREFIX = "Sift/"


class GmailProvider(EmailProvider):
    name = Provider.GMAIL

    def __init__(self, config: GmailConfig):
        self.config = config
        self._service = None
        self._label_cache: dict[str, str] = {}  # label name -> id

    # --- auth / service -------------------------------------------------

    @property
    def service(self):
        if self._service is None:
            self._service = self._build_service()
        return self._service

    def _build_service(self):
        from google.auth.transport.requests import Request
        from google.oauth2.credentials import Credentials
        from google_auth_oauthlib.flow import InstalledAppFlow
        from googleapiclient.discovery import build

        scopes = _SCOPES.get(self.config.scope, _SCOPES["modify"])
        creds = None
        if os.path.exists(self.config.token_file):
            creds = Credentials.from_authorized_user_file(self.config.token_file, scopes)
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                if not os.path.exists(self.config.credentials_file):
                    raise FileNotFoundError(
                        f"Gmail OAuth client file not found: {self.config.credentials_file}. "
                        "Download a Desktop OAuth client from Google Cloud Console."
                    )
                flow = InstalledAppFlow.from_client_secrets_file(
                    self.config.credentials_file, scopes
                )
                creds = flow.run_local_server(port=0)
            with open(self.config.token_file, "w", encoding="utf-8") as fh:
                fh.write(creds.to_json())
        return build("gmail", "v1", credentials=creds, cache_discovery=False)

    def whoami(self) -> str:
        profile = self.service.users().getProfile(userId="me").execute()
        total = profile.get("messagesTotal", "?")
        return f"{profile.get('emailAddress')} ({total} messages total)"

    # --- fetch ----------------------------------------------------------

    def fetch(
        self, max_results: int = 50, query: str | None = None, unread_only: bool = False
    ) -> list[EmailMessage]:
        q_parts = ["in:inbox"]
        if unread_only:
            q_parts.append("is:unread")
        if query:
            q_parts.append(query)
        q = " ".join(q_parts)

        listing = (
            self.service.users()
            .messages()
            .list(userId="me", q=q, maxResults=max_results)
            .execute()
        )
        ids = [m["id"] for m in listing.get("messages", [])]
        return [self._get_message(mid) for mid in ids]

    def _get_message(self, message_id: str) -> EmailMessage:
        raw = (
            self.service.users()
            .messages()
            .get(userId="me", id=message_id, format="full")
            .execute()
        )
        payload = raw.get("payload", {})
        headers = {h["name"]: h["value"] for h in payload.get("headers", [])}
        sender_name, sender = parse_address(headers.get("From", ""))
        to = [parse_address(addr)[1] for addr in headers.get("To", "").split(",") if addr.strip()]

        date = None
        if headers.get("Date"):
            try:
                date = parsedate_to_datetime(headers["Date"])
            except (TypeError, ValueError):
                date = None
        if date is None and raw.get("internalDate"):
            date = datetime.fromtimestamp(int(raw["internalDate"]) / 1000, tz=timezone.utc)

        labels = raw.get("labelIds", [])
        return EmailMessage(
            provider=Provider.GMAIL,
            id=message_id,
            thread_id=raw.get("threadId"),
            sender=sender,
            sender_name=sender_name,
            to=to,
            subject=headers.get("Subject", ""),
            snippet=raw.get("snippet", ""),
            body_text=_extract_body(payload),
            date=date,
            labels=labels,
            unread="UNREAD" in labels,
            headers=headers,
        )

    # --- mutations ------------------------------------------------------

    def _ensure_label(self, name: str) -> str:
        if name in self._label_cache:
            return self._label_cache[name]
        existing = self.service.users().labels().list(userId="me").execute()
        for label in existing.get("labels", []):
            self._label_cache[label["name"]] = label["id"]
        if name not in self._label_cache:
            created = (
                self.service.users()
                .labels()
                .create(
                    userId="me",
                    body={
                        "name": name,
                        "labelListVisibility": "labelShow",
                        "messageListVisibility": "show",
                    },
                )
                .execute()
            )
            self._label_cache[name] = created["id"]
        return self._label_cache[name]

    def _modify(self, email: EmailMessage, add=None, remove=None) -> None:
        self.service.users().messages().modify(
            userId="me",
            id=email.id,
            body={"addLabelIds": add or [], "removeLabelIds": remove or []},
        ).execute()

    def apply_category_label(self, email: EmailMessage, category_label: str) -> None:
        label_id = self._ensure_label(f"{_CATEGORY_LABEL_PREFIX}{category_label}")
        self._modify(email, add=[label_id])

    def flag(self, email: EmailMessage) -> None:
        self._modify(email, add=["STARRED"])

    def archive(self, email: EmailMessage) -> None:
        self._modify(email, remove=["INBOX"])

    def move_to_trash(self, email: EmailMessage) -> None:
        self.service.users().messages().trash(userId="me", id=email.id).execute()

    def delete(self, email: EmailMessage) -> None:
        # Requires the "full" (https://mail.google.com/) scope.
        self.service.users().messages().delete(userId="me", id=email.id).execute()


def _extract_body(payload: dict) -> str:
    """Walk the MIME tree, preferring text/plain, falling back to stripped HTML."""
    plain = _find_part(payload, "text/plain")
    if plain:
        return plain
    html = _find_part(payload, "text/html")
    return html_to_text(html) if html else ""


def _find_part(part: dict, mime_type: str) -> str:
    if part.get("mimeType") == mime_type:
        data = part.get("body", {}).get("data")
        if data:
            return decode_b64url(data).decode("utf-8", errors="replace")
    for sub in part.get("parts", []) or []:
        found = _find_part(sub, mime_type)
        if found:
            return found
    return ""
