from aria.classify.engine import HybridClassifier
from aria.models import Action, Category, Classification, Importance

from .conftest import make_email


class FakeAI:
    """Stand-in AI classifier that records what it was asked to classify."""

    def __init__(self):
        self.seen = []

    def classify_batch(self, emails):
        self.seen = list(emails)
        return [
            Classification(Importance.IMPORTANT, Category.WORK, Action.KEEP, 0.9, "ai says so", "ai")
            for _ in emails
        ]


def test_rules_only_does_not_call_ai():
    engine = HybridClassifier(ai_classifier=None)
    out = engine.classify([make_email(subject="50% off sale",
                                      headers={"List-Unsubscribe": "<x>"})])
    assert all(c.classification.source == "rules" for c in out)


def test_only_low_confidence_escalated():
    fake = FakeAI()
    engine = HybridClassifier(ai_classifier=fake, confidence_threshold=0.6)

    confident = make_email(sender="deals@x.com", subject="50% off flash sale",
                           body_text="shop now unsubscribe", headers={"List-Unsubscribe": "<x>"},
                           eid="confident")
    ambiguous = make_email(sender="bob@unknown.net", subject="hi", body_text="thoughts?",
                           eid="ambiguous")

    out = engine.classify([confident, ambiguous])
    seen_ids = {e.id for e in fake.seen}

    assert "ambiguous" in seen_ids
    assert "confident" not in seen_ids
    result_by_id = {c.email.id: c.classification for c in out}
    assert result_by_id["ambiguous"].source == "ai"
    assert result_by_id["confident"].source == "rules"


def test_ai_failure_falls_back_to_rules():
    class BoomAI:
        def classify_batch(self, emails):
            raise RuntimeError("network down")

    engine = HybridClassifier(ai_classifier=BoomAI(), confidence_threshold=0.6)
    out = engine.classify([make_email(sender="x@y.net", subject="hi")])
    assert out[0].classification.source == "rules"
