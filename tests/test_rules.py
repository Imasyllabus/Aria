from aria.classify.rules import classify_rules
from aria.models import Action, Category, Importance

from .conftest import make_email


def test_spam_is_junk_and_trashed():
    e = make_email(subject="Congratulations you have won a gift card",
                   body_text="Claim your prize now, you are a winner!")
    c = classify_rules(e)
    assert c.importance == Importance.JUNK
    assert c.category == Category.SPAM
    assert c.action == Action.TRASH


def test_vip_sender_is_priority():
    e = make_email(sender="boss@company.com", subject="quick question")
    c = classify_rules(e, vip_senders=["boss@company.com"])
    assert c.importance == Importance.PRIORITY
    assert c.action == Action.FLAG
    assert c.confidence >= 0.85


def test_vip_by_domain():
    e = make_email(sender="someone@important-client.com", subject="contract")
    c = classify_rules(e, vip_senders=["important-client.com"])
    assert c.importance == Importance.PRIORITY


def test_urgent_human_is_priority():
    e = make_email(sender="jane@partner.org", subject="ACTION REQUIRED: deadline today")
    c = classify_rules(e)
    assert c.importance == Importance.PRIORITY


def test_urgent_but_automated_is_not_priority():
    e = make_email(sender="no-reply@service.com", subject="action required",
                   headers={"List-Unsubscribe": "<mailto:u@x.com>"})
    c = classify_rules(e)
    assert c.importance != Importance.PRIORITY


def test_finance_is_important_and_kept():
    e = make_email(sender="statements@chasebank.com", subject="Your statement is ready",
                   body_text="Your account balance and payment due date.")
    c = classify_rules(e)
    assert c.category == Category.FINANCE
    assert c.importance == Importance.IMPORTANT
    assert c.action == Action.KEEP


def test_promotion_is_low_and_archived():
    e = make_email(sender="deals@shop.com", subject="50% off Flash Sale - last chance!",
                   body_text="Shop now. Unsubscribe here.",
                   headers={"List-Unsubscribe": "<mailto:u@shop.com>"})
    c = classify_rules(e)
    assert c.category == Category.PROMOTION
    assert c.importance == Importance.LOW
    assert c.action == Action.ARCHIVE


def test_social_notification_is_low():
    e = make_email(sender="notify@facebookmail.com", subject="You have 3 new notifications")
    c = classify_rules(e)
    assert c.category == Category.SOCIAL
    assert c.importance == Importance.LOW


def test_newsletter_needs_read():
    e = make_email(sender="news@digest.com", subject="This week's digest",
                   headers={"List-Unsubscribe": "<mailto:u@digest.com>"})
    c = classify_rules(e)
    assert c.category == Category.NEWSLETTER
    assert c.importance == Importance.NEEDS_READ


def test_shipping_update_categorized_shopping():
    e = make_email(sender="auto@store.com", subject="Your order has shipped",
                   body_text="Tracking number 1Z999. Out for delivery soon.")
    c = classify_rules(e)
    assert c.category == Category.SHOPPING
    assert c.importance == Importance.NEEDS_READ


def test_unknown_human_low_confidence_for_escalation():
    e = make_email(sender="random@unknown.net", subject="hi there", body_text="checking in")
    c = classify_rules(e)
    # Confidence is intentionally low so the hybrid engine escalates to AI.
    assert c.confidence < 0.6
