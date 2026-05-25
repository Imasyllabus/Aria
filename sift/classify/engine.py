"""Hybrid classifier: rules first, Claude for the low-confidence remainder."""

from __future__ import annotations

import logging
from collections.abc import Iterable

from ..models import ClassifiedEmail, EmailMessage
from .ai import AIClassifier
from .rules import classify_rules

logger = logging.getLogger("sift.engine")


class HybridClassifier:
    def __init__(
        self,
        vip_senders: Iterable[str] = (),
        confidence_threshold: float = 0.6,
        ai_classifier: AIClassifier | None = None,
    ):
        self.vip_senders = list(vip_senders)
        self.confidence_threshold = confidence_threshold
        self.ai = ai_classifier

    def classify(self, emails: list[EmailMessage]) -> list[ClassifiedEmail]:
        results = [
            ClassifiedEmail(email, classify_rules(email, self.vip_senders))
            for email in emails
        ]
        if self.ai is None:
            return results

        ambiguous = [
            i for i, r in enumerate(results)
            if r.classification.confidence < self.confidence_threshold
        ]
        if not ambiguous:
            return results

        logger.info("Escalating %d/%d emails to the AI classifier.", len(ambiguous), len(emails))
        try:
            ai_results = self.ai.classify_batch([emails[i] for i in ambiguous])
        except Exception as exc:  # network/API failure — keep the rules verdicts
            logger.warning("AI classification failed (%s); keeping rule-based results.", exc)
            return results

        for local_i, global_i in enumerate(ambiguous):
            if local_i < len(ai_results):
                results[global_i] = ClassifiedEmail(emails[global_i], ai_results[local_i])
        return results
