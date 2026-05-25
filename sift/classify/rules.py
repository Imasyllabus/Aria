"""Deterministic, dependency-free classifier.

Produces a Classification with a confidence score. The hybrid engine escalates
low-confidence results to the AI classifier, so the goal here is to be cheap,
fast, and *honest* about uncertainty rather than to be right about every edge.
"""

from __future__ import annotations

from collections.abc import Iterable

from ..models import Action, Category, Classification, EmailMessage, Importance

# --- Signal vocabularies -------------------------------------------------

URGENT_KEYWORDS = (
    "urgent", "asap", "action required", "action needed", "immediately",
    "deadline", "due today", "due tomorrow", "past due", "final notice",
    "time sensitive", "responde", "response needed", "please respond",
    "security alert", "password reset", "verify your", "suspicious sign",
    "expires today", "expiring", "overdue",
)

FINANCE_KEYWORDS = (
    "invoice", "receipt", "payment", "statement", "billing", "bill is ready",
    "transaction", "balance", "refund", "payroll", "direct deposit", "tax",
    "wire transfer", "your order total", "purchase confirmation",
)
FINANCE_DOMAIN_PARTS = (
    "bank", "chase", "wellsfargo", "paypal", "stripe", "intuit", "quickbooks",
    "amex", "americanexpress", "capitalone", "citi", "venmo", "wise.com",
    "fidelity", "schwab", "vanguard", "irs.gov",
)

TRAVEL_KEYWORDS = (
    "itinerary", "boarding pass", "flight", "reservation", "booking confirmation",
    "check-in", "hotel", "rental car", "your trip", "departure", "gate",
)

SHOPPING_KEYWORDS = (
    "your order", "order confirmation", "has shipped", "out for delivery",
    "tracking number", "delivered", "your package", "return label",
)

PROMO_SUBJECT_KEYWORDS = (
    "% off", "sale", "deal", "discount", "save big", "coupon", "promo",
    "limited time", "buy one", "free shipping", "clearance", "flash sale",
    "don't miss", "last chance", "exclusive offer", "new arrivals",
)
PROMO_BODY_KEYWORDS = (
    "shop now", "view in browser", "manage your preferences", "unsubscribe",
    "special offer", "act now",
)

SOCIAL_DOMAIN_PARTS = (
    "facebook", "facebookmail", "twitter", "x.com", "instagram", "linkedin",
    "pinterest", "tiktok", "reddit", "snapchat", "discord", "meetup",
)

SPAM_KEYWORDS = (
    "you won", "you have won", "claim your prize", "congratulations you",
    "nigerian prince", "wire me", "gift card", "crypto giveaway",
    "act now to claim", "viagra", "weight loss miracle", "hot singles",
    "you are a winner", "verify your account or it will be closed",
)

NOREPLY_MARKERS = (
    "no-reply", "noreply", "no_reply", "donotreply", "do-not-reply",
    "notifications@", "notification@", "mailer@", "mailer-daemon",
    "bounce", "automated@", "alerts@", "updates@",
)


def _any(text: str, needles: Iterable[str]) -> bool:
    return any(n in text for n in needles)


def _has_unsubscribe(email: EmailMessage, text: str) -> bool:
    if email.header("List-Unsubscribe"):
        return True
    return "unsubscribe" in text


def _is_automated(sender: str) -> bool:
    return _any(sender, NOREPLY_MARKERS)


def _detect_category(
    *, subject: str, text: str, domain: str, has_unsub: bool, automated: bool, spammy: bool
) -> tuple[Category, bool]:
    """Return (category, is_confident)."""
    if spammy:
        return Category.SPAM, True
    if _any(domain, SOCIAL_DOMAIN_PARTS):
        return Category.SOCIAL, True
    if _any(domain, FINANCE_DOMAIN_PARTS) or _any(text, FINANCE_KEYWORDS):
        return Category.FINANCE, True
    if _any(text, TRAVEL_KEYWORDS):
        return Category.TRAVEL, True
    if _any(text, SHOPPING_KEYWORDS):
        return Category.SHOPPING, True
    if _any(subject, PROMO_SUBJECT_KEYWORDS) or _any(text, PROMO_BODY_KEYWORDS):
        return Category.PROMOTION, True
    if has_unsub:
        return Category.NEWSLETTER, True
    if automated:
        return Category.NOTIFICATION, False
    return Category.OTHER, False


def classify_rules(email: EmailMessage, vip_senders: Iterable[str] = ()) -> Classification:
    subject = (email.subject or "").lower()
    snippet = (email.snippet or "").lower()
    body = (email.body_text or "").lower()
    text = f"{subject}\n{snippet}\n{body}"
    sender = (email.sender or "").lower()
    domain = email.sender_domain

    vip_set = {v.lower() for v in vip_senders}
    is_vip = bool(vip_set) and (sender in vip_set or domain in vip_set)
    is_reply = subject.startswith("re:") or subject.startswith("fwd:") or subject.startswith("fw:")
    automated = _is_automated(sender)
    has_unsub = _has_unsubscribe(email, text)
    urgent = _any(text, URGENT_KEYWORDS)
    spammy = _any(text, SPAM_KEYWORDS)

    category, cat_confident = _detect_category(
        subject=subject, text=text, domain=domain,
        has_unsub=has_unsub, automated=automated, spammy=spammy,
    )

    # --- Decision tree (most specific / highest-confidence first) ---

    if spammy:
        return Classification(Importance.JUNK, Category.SPAM, Action.TRASH, 0.85,
                              "Matches spam/scam language.", "rules")

    if is_vip:
        return Classification(Importance.PRIORITY, category if cat_confident else Category.WORK,
                              Action.FLAG, 0.9, "From a VIP sender.", "rules")

    if urgent and not automated:
        return Classification(Importance.PRIORITY, category if cat_confident else Category.WORK,
                              Action.FLAG, 0.78, "Urgent language from a human sender.", "rules")

    if category == Category.FINANCE:
        # A finance message that is also a marketing blast is just promo.
        if _any(subject, PROMO_SUBJECT_KEYWORDS):
            return Classification(Importance.LOW, Category.PROMOTION, Action.ARCHIVE, 0.7,
                                  "Financial brand marketing.", "rules")
        return Classification(Importance.IMPORTANT, Category.FINANCE, Action.KEEP, 0.72,
                              "Financial / billing message.", "rules")

    if category == Category.SOCIAL:
        return Classification(Importance.LOW, Category.SOCIAL, Action.ARCHIVE, 0.72,
                              "Social network notification.", "rules")

    if category in (Category.TRAVEL, Category.SHOPPING):
        return Classification(Importance.NEEDS_READ, category, Action.KEEP, 0.68,
                              f"{category.value.title()} update.", "rules")

    if category == Category.PROMOTION:
        return Classification(Importance.LOW, Category.PROMOTION, Action.ARCHIVE, 0.75,
                              "Marketing / promotional email.", "rules")

    if category == Category.NEWSLETTER:
        return Classification(Importance.NEEDS_READ, Category.NEWSLETTER, Action.KEEP, 0.55,
                              "Subscribed newsletter (has unsubscribe).", "rules")

    if category == Category.NOTIFICATION:
        return Classification(Importance.LOW, Category.NOTIFICATION, Action.ARCHIVE, 0.5,
                              "Automated notification.", "rules")

    # Looks like a genuine person writing to you.
    if is_reply and not automated:
        return Classification(Importance.IMPORTANT, Category.PERSONAL, Action.KEEP, 0.6,
                              "Reply/forward in a human thread.", "rules")
    if not automated and not has_unsub:
        return Classification(Importance.NEEDS_READ, Category.PERSONAL, Action.KEEP, 0.5,
                              "Direct message from a person.", "rules")

    # Genuinely unsure — let the AI pass decide.
    return Classification(Importance.NEEDS_READ, Category.OTHER, Action.KEEP, 0.3,
                          "No strong signal; needs review.", "rules")
