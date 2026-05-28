/**
 * Resource catalog — books, articles, and exercises Aria can recommend.
 *
 * This is non-sensitive reference data. In production it can be served from
 * Supabase (`resources` table) and cached locally; the shape here is the
 * contract. Tags drive the logic-based recommendation engine.
 */

export type ResourceType = 'book' | 'article' | 'exercise';

export interface Resource {
  readonly id: string;
  readonly title: string;
  readonly author?: string;
  readonly type: ResourceType;
  readonly blurb: string;
  /** Topic tags used by the recommendation engine. */
  readonly tags: readonly string[];
}

export const RESOURCE_CATALOG: readonly Resource[] = [
  {
    id: 'attached',
    title: 'Attached',
    author: 'Amir Levine & Rachel Heller',
    type: 'book',
    blurb:
      'The popular primer on attachment styles — anxious, avoidant, secure — and how they shape relationships.',
    tags: ['anxious-attachment', 'attachment-theory', 'relationships', 'secure-attachment'],
  },
  {
    id: 'no-more-mr-nice-guy',
    title: 'No More Mr. Nice Guy',
    author: 'Dr. Robert Glover',
    type: 'book',
    blurb:
      'On people-pleasing, covert contracts, and reclaiming honesty and self-respect in relationships.',
    tags: ['people-pleasing', 'self-worth', 'boundaries', 'masculinity'],
  },
  {
    id: 'how-to-not-die-alone',
    title: 'How to Not Die Alone',
    author: 'Logan Ury',
    type: 'book',
    blurb: 'Behavioral-science-based dating habits, including anxious dating patterns.',
    tags: ['dating', 'anxious-attachment', 'relationships'],
  },
  {
    id: 'feeling-good',
    title: 'Feeling Good',
    author: 'David D. Burns',
    type: 'book',
    blurb: 'A classic introduction to CBT thought-record techniques for reframing distortions.',
    tags: ['cbt', 'rumination', 'cognitive-distortions', 'self-worth'],
  },
  {
    id: 'thought-record',
    title: 'CBT Thought Record',
    type: 'exercise',
    blurb: 'Separate the situation, the automatic thought, the feeling, and a balanced reframe.',
    tags: ['cbt', 'rumination', 'anxiety', 'cognitive-distortions'],
  },
  {
    id: 'urge-surf-text',
    title: 'Urge-Surfing the "Why Hasn\'t She Texted" Spiral',
    type: 'exercise',
    blurb: 'A short grounding practice for riding out reassurance-seeking urges without acting on them.',
    tags: ['anxious-attachment', 'reassurance-seeking', 'anxiety', 'communication'],
  },
] as const;
