"""Outlook / Microsoft 365 provider via Microsoft Graph (msal + requests)."""

from __future__ import annotations

import json
import os
from datetime import datetime

from ..config import OutlookConfig
from ..models import EmailMessage, Provider
from ..util import html_to_text, parse_address
from .base import EmailProvider

_GRAPH = "https://graph.microsoft.com/v1.0"
_SCOPES = ["Mail.ReadWrite"]
_CATEGORY_PREFIX = "Aria: "
_SELECT = (
    "id,conversationId,subject,from,toRecipients,bodyPreview,body,"
    "receivedDateTime,isRead,categories,internetMessageHeaders"
)


class OutlookProvider(EmailProvider):
    name = Provider.OUTLOOK

    def __init__(self, config: OutlookConfig):
        if not config.client_id:
            raise ValueError("OUTLOOK_CLIENT_ID is required for the Outlook provider.")
        self.config = config
        self._token: str | None = None

    # --- auth -----------------------------------------------------------

    def _access_token(self) -> str:
        if self._token:
            return self._token
        import msal

        cache = msal.SerializableTokenCache()
        if os.path.exists(self.config.token_cache):
            with open(self.config.token_cache, encoding="utf-8") as fh:
                cache.deserialize(fh.read())

        app = msal.PublicClientApplication(
            self.config.client_id,
            authority=f"https://login.microsoftonline.com/{self.config.tenant_id}",
            token_cache=cache,
        )
        result = None
        accounts = app.get_accounts()
        if accounts:
            result = app.acquire_token_silent(_SCOPES, account=accounts[0])
        if not result:
            flow = app.initiate_device_flow(scopes=_SCOPES)
            if "user_code" not in flow:
                raise RuntimeError(f"Failed to start device flow: {flow.get('error_description')}")
            print(flow["message"], flush=True)  # user must visit URL + enter code
            result = app.acquire_token_by_device_flow(flow)

        if "access_token" not in result:
            raise RuntimeError(
                f"Outlook auth failed: {result.get('error_description', result)}"
            )
        if cache.has_state_changed:
            with open(self.config.token_cache, "w", encoding="utf-8") as fh:
                fh.write(cache.serialize())
        self._token = result["access_token"]
        return self._token

    def _session(self):
        import requests

        sess = requests.Session()
        sess.headers.update({"Authorization": f"Bearer {self._access_token()}"})
        return sess

    # --- fetch ----------------------------------------------------------

    def fetch(
        self, max_results: int = 50, query: str | None = None, unread_only: bool = False
    ) -> list[EmailMessage]:
        params = {
            "$top": str(max_results),
            "$select": _SELECT,
            "$orderby": "receivedDateTime desc",
        }
        if unread_only:
            params["$filter"] = "isRead eq false"
        if query:
            params["$search"] = f'"{query}"'

        sess = self._session()
        resp = sess.get(f"{_GRAPH}/me/mailFolders/inbox/messages", params=params, timeout=30)
        resp.raise_for_status()
        return [_to_email(item) for item in resp.json().get("value", [])]

    # --- mutations ------------------------------------------------------

    def _patch(self, email: EmailMessage, body: dict) -> None:
        sess = self._session()
        resp = sess.patch(f"{_GRAPH}/me/messages/{email.id}", data=json.dumps(body),
                          headers={"Content-Type": "application/json"}, timeout=30)
        resp.raise_for_status()

    def apply_category_label(self, email: EmailMessage, category_label: str) -> None:
        tag = f"{_CATEGORY_PREFIX}{category_label}"
        # email.labels carries the message's existing Outlook categories.
        categories = [c for c in email.labels if not c.startswith(_CATEGORY_PREFIX)]
        categories.append(tag)
        self._patch(email, {"categories": categories})

    def flag(self, email: EmailMessage) -> None:
        self._patch(email, {"flag": {"flagStatus": "flagged"}})

    def archive(self, email: EmailMessage) -> None:
        sess = self._session()
        resp = sess.post(f"{_GRAPH}/me/messages/{email.id}/move",
                        data=json.dumps({"destinationId": "archive"}),
                        headers={"Content-Type": "application/json"}, timeout=30)
        resp.raise_for_status()

    def move_to_trash(self, email: EmailMessage) -> None:
        # Graph DELETE moves the item to Deleted Items (recoverable).
        sess = self._session()
        resp = sess.delete(f"{_GRAPH}/me/messages/{email.id}", timeout=30)
        resp.raise_for_status()

    def delete(self, email: EmailMessage) -> None:
        # permanentDelete hard-deletes; falls back to a normal delete if unavailable.
        sess = self._session()
        resp = sess.post(f"{_GRAPH}/me/messages/{email.id}/permanentDelete", timeout=30)
        if resp.status_code == 404:
            sess.delete(f"{_GRAPH}/me/messages/{email.id}", timeout=30).raise_for_status()
            return
        resp.raise_for_status()


def _to_email(item: dict) -> EmailMessage:
    from_field = (item.get("from") or {}).get("emailAddress", {})
    sender = (from_field.get("address") or "").lower()
    sender_name = from_field.get("name", "")
    to = [
        (r.get("emailAddress", {}).get("address") or "").lower()
        for r in item.get("toRecipients", [])
    ]
    headers = {
        h["name"]: h["value"] for h in item.get("internetMessageHeaders", []) or []
    }
    date = None
    if item.get("receivedDateTime"):
        try:
            date = datetime.fromisoformat(item["receivedDateTime"].replace("Z", "+00:00"))
        except ValueError:
            date = None

    body = item.get("body", {}) or {}
    if body.get("contentType", "").lower() == "html":
        body_text = html_to_text(body.get("content", ""))
    else:
        body_text = body.get("content", "") or item.get("bodyPreview", "")

    email = EmailMessage(
        provider=Provider.OUTLOOK,
        id=item["id"],
        thread_id=item.get("conversationId"),
        sender=sender,
        sender_name=sender_name,
        to=to,
        subject=item.get("subject", ""),
        snippet=item.get("bodyPreview", ""),
        body_text=body_text,
        date=date,
        labels=item.get("categories", []),
        unread=not item.get("isRead", True),
        headers=headers,
    )
    return email
