/**
 * Coach client — the device-side entry point for an AI coaching turn.
 *
 * CRITICAL ORDERING (do not reorder):
 *   1. Run deterministic, offline crisis detection on the user input.
 *   2. If crisis: return a crisis result and DO NOT call the network/AI.
 *   3. Otherwise check the wellness rate limiter.
 *   4. Only then call the stateless Edge Function proxy (which holds the API
 *      key and injects the system prompt server-side).
 *
 * The client never talks to Anthropic directly and never sees the API key.
 */
import { detectCrisis, type CrisisDetectionResult } from '../safety/crisisDetection';
import { type CoachResponse, parseCoachResponse } from './schema';
import { type RateLimitDecision } from '../rateLimit/sessionLimiter';

export type CoachTurnResult =
  | { kind: 'crisis'; detection: CrisisDetectionResult }
  | { kind: 'rate-limited'; decision: RateLimitDecision }
  | { kind: 'reply'; response: CoachResponse };

export interface CoachTurnInput {
  /** The user's raw message. */
  message: string;
  /** Prior turns to provide as context (role/content pairs). */
  history?: { role: 'user' | 'assistant'; content: string }[];
  /** Non-sensitive personalization tag from onboarding. */
  primaryStruggleTag?: string;
}

export interface CoachClientDeps {
  /** Decide whether the user should be nudged to take a break. */
  checkRateLimit: () => RateLimitDecision;
  /** Posts to the Edge Function proxy; returns the raw model text. */
  callProxy: (payload: ProxyPayload) => Promise<string>;
}

export interface ProxyPayload {
  message: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  primaryStruggleTag?: string;
}

/**
 * Run one coaching turn through all guardrails. Pure orchestration — network
 * and rate-limit storage are injected so this is fully testable.
 */
export async function runCoachTurn(
  input: CoachTurnInput,
  deps: CoachClientDeps,
): Promise<CoachTurnResult> {
  // 1 + 2: crisis check happens first and short-circuits everything.
  const detection = detectCrisis(input.message);
  if (detection.isCrisis) {
    return { kind: 'crisis', detection };
  }

  // 3: wellness rate limiting (crisis is never rate-limited — already handled).
  const decision = deps.checkRateLimit();
  if (decision.shouldSuggestBreak && decision.hardStop) {
    return { kind: 'rate-limited', decision };
  }

  // 4: call the stateless proxy and validate the response shape.
  const raw = await deps.callProxy({
    message: input.message,
    history: input.history ?? [],
    primaryStruggleTag: input.primaryStruggleTag,
  });

  const response = parseCoachResponse(raw);

  // Belt-and-suspenders: if the model itself flagged crisis, honor it.
  if (response.deferToCrisis) {
    return { kind: 'crisis', detection: { isCrisis: true, categories: [], matchedPhrases: [] } };
  }

  return { kind: 'reply', response };
}
