import datetime as _dt

from aria.models import EmailMessage, Provider


def make_email(
    *,
    sender="alice@example.com",
    sender_name="Alice",
    subject="Hello",
    snippet="",
    body_text="",
    headers=None,
    provider=Provider.GMAIL,
    unread=True,
    eid="1",
):
    return EmailMessage(
        provider=provider,
        id=eid,
        sender=sender,
        sender_name=sender_name,
        subject=subject,
        snippet=snippet,
        body_text=body_text,
        to=["me@example.com"],
        thread_id=None,
        date=_dt.datetime(2026, 5, 20, tzinfo=_dt.timezone.utc),
        labels=[],
        unread=unread,
        headers=headers or {},
    )
