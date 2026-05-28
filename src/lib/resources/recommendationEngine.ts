/**
 * Resource Recommendation Engine — logic-based (not AI-generated) so it can't
 * hallucinate titles. It scores catalog items against signals derived from
 * chat context: explicit tags emitted by the coach plus a lightweight keyword
 * map over the conversation text.
 *
 * Pure and fully unit-tested.
 */
import { RESOURCE_CATALOG, type Resource } from './catalog';

/** Keyword → tag map for deriving topics from free text context. */
const KEYWORD_TAGS: Readonly<Record<string, readonly string[]>> = {
  text: ['reassurance-seeking', 'anxious-attachment'],
  texting: ['reassurance-seeking', 'anxious-attachment'],
  reply: ['reassurance-seeking', 'anxious-attachment'],
  ignored: ['anxious-attachment'],
  needy: ['anxious-attachment', 'reassurance-seeking'],
  clingy: ['anxious-attachment'],
  overthink: ['rumination', 'cognitive-distortions'],
  overthinking: ['rumination', 'cognitive-distortions'],
  spiral: ['rumination', 'anxiety'],
  anxious: ['anxious-attachment', 'anxiety'],
  anxiety: ['anxiety', 'cbt'],
  'people pleas': ['people-pleasing', 'boundaries'],
  'nice guy': ['people-pleasing', 'masculinity'],
  boundaries: ['boundaries'],
  dating: ['dating'],
  worthless: ['self-worth', 'cognitive-distortions'],
};

export interface RecommendationInput {
  /** Tags emitted by the coach (highest-confidence signal). */
  coachTags?: readonly string[];
  /** Raw conversation text to scan for keyword signals. */
  contextText?: string;
  /** Max number of recommendations to return. */
  limit?: number;
}

export interface ScoredResource {
  readonly resource: Resource;
  readonly score: number;
  readonly matchedTags: readonly string[];
}

/** Derive topic tags from free text using the keyword map. */
export function deriveTagsFromText(text: string): string[] {
  const lower = text.toLowerCase();
  const tags = new Set<string>();
  for (const [keyword, mapped] of Object.entries(KEYWORD_TAGS)) {
    if (lower.includes(keyword)) {
      for (const t of mapped) tags.add(t);
    }
  }
  return [...tags];
}

/**
 * Recommend resources for the given context. Coach-emitted tags are weighted
 * higher than keyword-derived tags. Returns highest-scoring items first.
 */
export function recommendResources(input: RecommendationInput): ScoredResource[] {
  const limit = input.limit ?? 3;

  // Build weighted signal: coach tags weight 2, derived tags weight 1.
  const weights = new Map<string, number>();
  for (const t of input.coachTags ?? []) {
    weights.set(t, (weights.get(t) ?? 0) + 2);
  }
  for (const t of deriveTagsFromText(input.contextText ?? '')) {
    weights.set(t, (weights.get(t) ?? 0) + 1);
  }

  if (weights.size === 0) return [];

  const scored: ScoredResource[] = RESOURCE_CATALOG.map((resource) => {
    const matchedTags: string[] = [];
    let score = 0;
    for (const tag of resource.tags) {
      const w = weights.get(tag);
      if (w) {
        score += w;
        matchedTags.push(tag);
      }
    }
    return { resource, score, matchedTags };
  }).filter((s) => s.score > 0);

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}
