/**
 * Crisis detection — the hard-coded "Crisis Mode" guardrail.
 *
 * NON-NEGOTIABLE: this runs locally and deterministically on EVERY user input
 * BEFORE any AI/network call. On a positive match the caller MUST:
 *   1. suppress the AI response for that input, and
 *   2. route the user to the Crisis screen showing national hotlines.
 *
 * Design philosophy: tuned for HIGH RECALL. A false positive (showing help
 * when it wasn't strictly needed) is acceptable; a false negative (missing a
 * person in crisis) is not. We accept that this will sometimes over-trigger.
 *
 * This module is pure, dependency-free, and fully unit-tested.
 */

export type CrisisCategory = 'self-harm' | 'suicide' | 'harm-to-others' | 'abuse-danger';

export interface CrisisDetectionResult {
  /** True if the input should trigger Crisis Mode. */
  readonly isCrisis: boolean;
  /** Categories that matched (for routing copy / analytics counts only). */
  readonly categories: readonly CrisisCategory[];
  /** The phrases that matched, for transparency in tests/QA (never logged remotely). */
  readonly matchedPhrases: readonly string[];
}

/**
 * Phrase patterns grouped by category. Patterns are matched against a
 * normalized (lowercased, punctuation-stripped, de-leetspeaked) version of the
 * input. We use word-boundary-aware regexes to reduce obvious false positives
 * (e.g. "kill it at work") while staying high-recall.
 */
const CRISIS_PATTERNS: Readonly<Record<CrisisCategory, readonly RegExp[]>> = {
  suicide: [
    /\bkill (myself|me)\b/,
    /\b(killing|killed) myself\b/,
    /\bend(ing)? (my|this) life\b/,
    /\bend(ing)? it all\b/,
    /\b(take|taking|took) my (own )?life\b/,
    /\bi want to die\b/,
    /\bi wanna die\b/,
    /\bi don'?t want to (be alive|live|exist)\b/,
    /\bi don'?t want to wake up\b/,
    /\bdon'?t want to be here anymore\b/,
    /\bbetter off (dead|without me)\b/,
    /\bno reason to live\b/,
    /\bnothing to live for\b/,
    /\bcan'?t go on\b/,
    /\bsuicid(e|al)\b/,
    /\bkms\b/,
    /\bkys\b/,
  ],
  'self-harm': [
    /\b(cut|cutting|hurt|hurting|harm|harming) myself\b/,
    /\bself[\s-]?harm\b/,
    /\bself[\s-]?injur(e|y|ing)\b/,
    /\bi (want|wanna) to? (cut|hurt|harm) myself\b/,
    /\bburn(ing)? myself\b/,
    /\boverdose\b/,
    /\bod'?ing\b/,
  ],
  'harm-to-others': [
    /\bkill (him|her|them|someone|everyone|you all)\b/,
    /\bhurt (him|her|them|someone)\b/,
    /\bi(\s|')?(m|am)? going to hurt\b/,
    /\bwant to hurt (someone|people|him|her|them)\b/,
    /\bshoot (up|everyone|them)\b/,
  ],
  'abuse-danger': [
    /\bbeing abused\b/,
    /\bhe('?s| is) (hitting|beating|hurting) me\b/,
    /\bshe('?s| is) (hitting|beating|hurting) me\b/,
    /\bthey('?re| are) (hitting|beating|hurting) me\b/,
    /\bin danger\b/,
    /\bafraid for my life\b/,
    /\bgoing to hurt me\b/,
  ],
};

/**
 * Normalize text for matching: lowercase, collapse common leetspeak, strip
 * punctuation that fragments words, and collapse whitespace.
 */
export function normalizeForDetection(input: string): string {
  return input
    .toLowerCase()
    .replace(/[0@]/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/\$/g, 's')
    .replace(/[^a-z'\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Scan a user input for crisis signals. Deterministic and offline.
 */
export function detectCrisis(input: string): CrisisDetectionResult {
  if (!input || !input.trim()) {
    return { isCrisis: false, categories: [], matchedPhrases: [] };
  }

  const normalized = normalizeForDetection(input);
  const categories: CrisisCategory[] = [];
  const matchedPhrases: string[] = [];

  for (const [category, patterns] of Object.entries(CRISIS_PATTERNS) as [
    CrisisCategory,
    readonly RegExp[],
  ][]) {
    for (const pattern of patterns) {
      const match = normalized.match(pattern);
      if (match) {
        if (!categories.includes(category)) categories.push(category);
        matchedPhrases.push(match[0]);
      }
    }
  }

  return {
    isCrisis: categories.length > 0,
    categories,
    matchedPhrases,
  };
}
