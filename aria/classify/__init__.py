"""Email classification: deterministic rules + optional Claude AI escalation."""

from .engine import HybridClassifier
from .rules import classify_rules

__all__ = ["HybridClassifier", "classify_rules"]
