import {
  evaluateRateLimit,
  DEFAULT_RATE_LIMIT_CONFIG,
  type SessionActivity,
} from '../src/lib/rateLimit/sessionLimiter';

const MIN = 60_000;

describe('wellness rate limiter', () => {
  it('says ok for a short, light session', () => {
    const now = 1_000_000_000_000;
    const activity: SessionActivity = {
      sessionStartedAt: now - 5 * MIN,
      turnTimestamps: [now - 2 * MIN, now - 1 * MIN],
    };
    const d = evaluateRateLimit(activity, now);
    expect(d.shouldSuggestBreak).toBe(false);
    expect(d.reason).toBe('ok');
  });

  it('suggests a break after a long continuous session', () => {
    const now = 1_000_000_000_000;
    const activity: SessionActivity = {
      sessionStartedAt: now - 50 * MIN,
      turnTimestamps: [now - 1 * MIN],
    };
    const d = evaluateRateLimit(activity, now);
    expect(d.shouldSuggestBreak).toBe(true);
    expect(d.hardStop).toBe(false);
    expect(d.reason).toBe('duration');
    expect(d.message).toMatch(/10-minute walk/);
  });

  it('suggests a break after high turn volume in the window', () => {
    const now = 1_000_000_000_000;
    const turnTimestamps = Array.from(
      { length: DEFAULT_RATE_LIMIT_CONFIG.softBreakAfterTurns },
      (_, i) => now - i * 30_000, // many turns in the last ~15 min
    );
    const activity: SessionActivity = { sessionStartedAt: now - 20 * MIN, turnTimestamps };
    const d = evaluateRateLimit(activity, now);
    expect(d.shouldSuggestBreak).toBe(true);
    expect(d.reason).toBe('turn-volume');
  });

  it('hard-stops after a very long session', () => {
    const now = 1_000_000_000_000;
    const activity: SessionActivity = {
      sessionStartedAt: now - 100 * MIN,
      turnTimestamps: [now - 1 * MIN],
    };
    const d = evaluateRateLimit(activity, now);
    expect(d.hardStop).toBe(true);
    expect(d.reason).toBe('hard-stop');
  });
});
