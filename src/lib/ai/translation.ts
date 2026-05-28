/**
 * "Men's Translation" tool — rewrites a user's draft message to a partner into
 * a "secure attachment" version.
 *
 * Like the coach, crisis detection runs first and the request goes through the
 * stateless proxy. The translation prompt is injected server-side.
 */
import { detectCrisis, type CrisisDetectionResult } from '../safety/crisisDetection';
import { parseTranslationResponse, type TranslationResponse } from './schema';

export const TRANSLATION_SYSTEM_PROMPT = `You rewrite a man's draft message to his partner into a "secure attachment" version. Keep his voice and intent. Remove protest behavior (guilt-tripping, testing, withdrawal, accusation, demand for reassurance). Make it direct, honest about the underlying need, non-blaming, and emotionally regulated. Do NOT diagnose either person. Do NOT add facts he didn't say.

Respond ONLY with JSON: { "rewrite": string, "note": string } where "note" is one line on what shifted and why.`;

export type TranslateResult =
  | { kind: 'crisis'; detection: CrisisDetectionResult }
  | { kind: 'translation'; response: TranslationResponse };

export interface TranslateDeps {
  callProxy: (draft: string) => Promise<string>;
}

/** Translate a draft message, with crisis detection guarding the input. */
export async function translateMessage(
  draft: string,
  deps: TranslateDeps,
): Promise<TranslateResult> {
  const detection = detectCrisis(draft);
  if (detection.isCrisis) {
    return { kind: 'crisis', detection };
  }

  const raw = await deps.callProxy(draft);
  return { kind: 'translation', response: parseTranslationResponse(raw) };
}
