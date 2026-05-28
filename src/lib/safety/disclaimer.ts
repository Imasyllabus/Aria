/**
 * Disclaimer-first guardrail.
 *
 * Every session must be governed by a "this is not therapy" disclaimer that
 * the user acknowledges before coaching begins. Acknowledgement is stored
 * locally (it is not sensitive content, but it stays on device for simplicity).
 */

export const DISCLAIMER_VERSION = '2026-05-01';

export const DISCLAIMER_TEXT = `Aria is a wellness and coaching app — not therapy, counseling, or medical care.

The Coach is an AI mentor for reflection and skill-building around attachment, emotions, and relationships. It does not diagnose, treat, or provide medical advice, and it is not a substitute for a licensed professional.

If you're in crisis or thinking about harming yourself or someone else, Aria will show you emergency resources — please reach out to them or call your local emergency number right away.

By continuing, you acknowledge that you understand this.`;

/** A soft reminder appended after emotionally heavy exchanges. */
export const SOFT_REMINDER_TEXT =
  'A gentle reminder: Aria is a coaching tool, not therapy. Reaching out to a professional is a sign of strength.';

export interface DisclaimerAcknowledgement {
  readonly version: string;
  readonly acknowledgedAt: string; // ISO timestamp
}

/**
 * Whether a stored acknowledgement satisfies the current disclaimer version.
 * If the disclaimer text/version changes, users must re-acknowledge.
 */
export function isDisclaimerAcknowledged(
  ack: DisclaimerAcknowledgement | null | undefined,
): boolean {
  return !!ack && ack.version === DISCLAIMER_VERSION;
}

/** Build a fresh acknowledgement record for the current version. */
export function buildAcknowledgement(now: Date = new Date()): DisclaimerAcknowledgement {
  return { version: DISCLAIMER_VERSION, acknowledgedAt: now.toISOString() };
}
