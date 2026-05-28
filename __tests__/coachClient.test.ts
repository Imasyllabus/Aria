import { runCoachTurn } from '../src/lib/ai/coachClient';
import { translateMessage } from '../src/lib/ai/translation';

describe('coach turn orchestration (guardrail ordering)', () => {
  it('short-circuits to crisis WITHOUT calling the AI', async () => {
    const callProxy = jest.fn();
    const checkRateLimit = jest.fn(() => ({
      shouldSuggestBreak: false,
      hardStop: false,
      reason: 'ok' as const,
    }));

    const result = await runCoachTurn(
      { message: 'I want to kill myself' },
      { callProxy, checkRateLimit },
    );

    expect(result.kind).toBe('crisis');
    expect(callProxy).not.toHaveBeenCalled();
    expect(checkRateLimit).not.toHaveBeenCalled(); // crisis is first, before rate limit
  });

  it('returns a parsed reply for a normal turn', async () => {
    const callProxy = jest.fn(async () =>
      JSON.stringify({ reply: 'I hear you. What story are you telling yourself?' }),
    );
    const checkRateLimit = jest.fn(() => ({
      shouldSuggestBreak: false,
      hardStop: false,
      reason: 'ok' as const,
    }));

    const result = await runCoachTurn(
      { message: "She didn't text back" },
      { callProxy, checkRateLimit },
    );

    expect(result.kind).toBe('reply');
    if (result.kind === 'reply') {
      expect(result.response.reply).toMatch(/story/);
    }
    expect(callProxy).toHaveBeenCalledTimes(1);
  });

  it('honors a hard-stop rate limit before calling the AI', async () => {
    const callProxy = jest.fn();
    const checkRateLimit = jest.fn(() => ({
      shouldSuggestBreak: true,
      hardStop: true,
      reason: 'hard-stop' as const,
      message: 'pause',
    }));

    const result = await runCoachTurn(
      { message: 'normal message' },
      { callProxy, checkRateLimit },
    );

    expect(result.kind).toBe('rate-limited');
    expect(callProxy).not.toHaveBeenCalled();
  });

  it('defers to crisis if the model flags it', async () => {
    const callProxy = jest.fn(async () =>
      JSON.stringify({ reply: '...', deferToCrisis: true }),
    );
    const checkRateLimit = jest.fn(() => ({
      shouldSuggestBreak: false,
      hardStop: false,
      reason: 'ok' as const,
    }));

    const result = await runCoachTurn(
      { message: 'ambiguous' },
      { callProxy, checkRateLimit },
    );
    expect(result.kind).toBe('crisis');
  });
});

describe("Men's Translation tool", () => {
  it('guards the input with crisis detection', async () => {
    const callProxy = jest.fn();
    const result = await translateMessage('I want to hurt myself', { callProxy });
    expect(result.kind).toBe('crisis');
    expect(callProxy).not.toHaveBeenCalled();
  });

  it('returns a parsed rewrite for a normal draft', async () => {
    const callProxy = jest.fn(async () =>
      JSON.stringify({ rewrite: 'I felt anxious when I didn’t hear back.', note: 'Owns the feeling.' }),
    );
    const result = await translateMessage('Why do you always ignore me??', { callProxy });
    expect(result.kind).toBe('translation');
    if (result.kind === 'translation') {
      expect(result.response.rewrite).toMatch(/anxious/);
    }
  });
});
