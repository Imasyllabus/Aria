/**
 * Onboarding flow — identifies the user's PRIMARY STRUGGLE so the dashboard
 * can be personalized. Answers map to non-clinical tags used by the coach
 * (personalization preamble) and the resource engine.
 *
 * The selected tag is non-sensitive; any free-text elaboration the user adds
 * is stored LOCALLY only (see storage/local/schema.ts).
 */

export interface StruggleOption {
  /** Stable tag used across coach + resource engine. */
  readonly tag: string;
  /** First-person framing shown to the user. */
  readonly label: string;
  /** Resource tags to seed the dashboard with. */
  readonly seedResourceTags: readonly string[];
}

export const PRIMARY_STRUGGLE_OPTIONS: readonly StruggleOption[] = [
  {
    tag: 'anxious-when-no-reply',
    label: "I feel anxious when she doesn't text back.",
    seedResourceTags: ['anxious-attachment', 'reassurance-seeking', 'rumination'],
  },
  {
    tag: 'fear-of-abandonment',
    label: "I'm scared she'll leave or lose interest.",
    seedResourceTags: ['anxious-attachment', 'attachment-theory'],
  },
  {
    tag: 'people-pleasing',
    label: 'I lose myself trying to keep her happy.',
    seedResourceTags: ['people-pleasing', 'boundaries', 'self-worth'],
  },
  {
    tag: 'overthinking-spirals',
    label: 'I overthink every interaction and spiral.',
    seedResourceTags: ['rumination', 'cbt', 'cognitive-distortions'],
  },
  {
    tag: 'hard-to-express',
    label: "I struggle to say what I actually feel.",
    seedResourceTags: ['communication', 'emotional-literacy'],
  },
  {
    tag: 'dating-anxiety',
    label: 'Dating makes me anxious and reactive.',
    seedResourceTags: ['dating', 'anxious-attachment'],
  },
] as const;

/** The onboarding screen sequence (used by app/onboarding routes). */
export const ONBOARDING_STEPS = [
  'disclaimer', // must acknowledge "not therapy" first
  'primary-struggle', // pick the struggle that fits most
  'elaborate', // optional free text (stored locally only)
  'ready', // hand off to personalized dashboard
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export function findStruggleOption(tag: string): StruggleOption | undefined {
  return PRIMARY_STRUGGLE_OPTIONS.find((o) => o.tag === tag);
}
