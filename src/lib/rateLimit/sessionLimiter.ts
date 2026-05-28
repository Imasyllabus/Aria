/**
 * Wellness rate limiting.
 *
 * Goal: protect a user who may be spiraling — if they've been processing
 * intensely for a long stretch, gently suggest a break. This is a WELLNESS
 * feature first (and a cost control second). Crisis handling is never
 * rate-limited; this only applies to ordinary coaching turns.
 *
 * Pure function of an activity window → decision, so it's fully testable.
 */

export interface SessionActivity {
  /** Timestamps (ms epoch) of recent coaching turns, oldest → newest. */
  readonly turnTimestamps: readonly number[];
  /** When the current continuous session started (ms epoch). */
  readonly sessionStartedAt: number;
}

export interface RateLimitConfig {
  /** Suggest a break after this many minutes of continuous session. */
  readonly softBreakAfterMinutes: number;
  /** Suggest a break after this many turns in the rolling window. */
  readonly softBreakAfterTurns: number;
  /** Rolling window for the turn count, in minutes. */
  readonly windowMinutes: number;
  /** Hard stop (pause coaching) after this many minutes of continuous session. */
  readonly hardStopAfterMinutes: number;
}

export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  softBreakAfterMinutes: 45,
  softBreakAfterTurns: 30,
  windowMinutes: 30,
  hardStopAfterMinutes: 90,
};

export interface RateLimitDecision {
  /** Show the gentle break suggestion. */
  readonly shouldSuggestBreak: boolean;
  /** Pause coaching entirely until the user takes a break. */
  readonly hardStop: boolean;
  /** Why the decision was made (for copy + QA). */
  readonly reason: 'ok' | 'duration' | 'turn-volume' | 'hard-stop';
  /** User-facing copy when a break is suggested. */
  readonly message?: string;
}

export const BREAK_SUGGESTION =
  "It looks like you've been processing a lot today. Why not take a 10-minute walk and come back? I'll be here.";

export const HARD_STOP_MESSAGE =
  "You've put in real work today. Let's pause here for now — rest is part of the process. Come back when you've had some space.";

/**
 * Decide whether to nudge the user toward a break.
 */
export function evaluateRateLimit(
  activity: SessionActivity,
  now: number = Date.now(),
  config: RateLimitConfig = DEFAULT_RATE_LIMIT_CONFIG,
): RateLimitDecision {
  const sessionMinutes = (now - activity.sessionStartedAt) / 60_000;

  if (sessionMinutes >= config.hardStopAfterMinutes) {
    return {
      shouldSuggestBreak: true,
      hardStop: true,
      reason: 'hard-stop',
      message: HARD_STOP_MESSAGE,
    };
  }

  const windowStart = now - config.windowMinutes * 60_000;
  const turnsInWindow = activity.turnTimestamps.filter((t) => t >= windowStart).length;

  if (sessionMinutes >= config.softBreakAfterMinutes) {
    return {
      shouldSuggestBreak: true,
      hardStop: false,
      reason: 'duration',
      message: BREAK_SUGGESTION,
    };
  }

  if (turnsInWindow >= config.softBreakAfterTurns) {
    return {
      shouldSuggestBreak: true,
      hardStop: false,
      reason: 'turn-volume',
      message: BREAK_SUGGESTION,
    };
  }

  return { shouldSuggestBreak: false, hardStop: false, reason: 'ok' };
}
