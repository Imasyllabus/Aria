import { detectCrisis, normalizeForDetection } from '../src/lib/safety/crisisDetection';

describe('crisis detection (high-recall guardrail)', () => {
  const crisisInputs: { text: string; category: string }[] = [
    { text: 'I want to kill myself', category: 'suicide' },
    { text: "I don't want to be alive anymore", category: 'suicide' },
    { text: 'everyone would be better off without me', category: 'suicide' },
    { text: 'I have no reason to live', category: 'suicide' },
    { text: 'thinking about ending it all tonight', category: 'suicide' },
    { text: 'kms', category: 'suicide' },
    { text: 'I keep cutting myself when it gets bad', category: 'self-harm' },
    { text: 'I want to hurt myself', category: 'self-harm' },
    { text: 'I might overdose', category: 'self-harm' },
    { text: 'I want to hurt someone', category: 'harm-to-others' },
    { text: "he's hitting me and I'm scared", category: 'abuse-danger' },
  ];

  it.each(crisisInputs)('flags crisis: "$text"', ({ text, category }) => {
    const result = detectCrisis(text);
    expect(result.isCrisis).toBe(true);
    expect(result.categories).toContain(category);
  });

  it('catches simple leetspeak obfuscation', () => {
    expect(detectCrisis('i want to k1ll myself').isCrisis).toBe(true);
  });

  it('does not flag clearly benign relationship venting', () => {
    expect(detectCrisis("She didn't text back and I feel anxious").isCrisis).toBe(false);
    expect(detectCrisis('I feel really down about the breakup').isCrisis).toBe(false);
    expect(detectCrisis('This deadline is killing me').isCrisis).toBe(false);
    expect(detectCrisis('I killed it at work today').isCrisis).toBe(false);
  });

  it('returns not-crisis for empty input', () => {
    expect(detectCrisis('').isCrisis).toBe(false);
    expect(detectCrisis('   ').isCrisis).toBe(false);
  });

  it('normalizes punctuation and case', () => {
    expect(normalizeForDetection('I WANT to DIE!!!')).toBe('i want to die');
  });

  it('exposes matched phrases for QA transparency', () => {
    const r = detectCrisis('I want to kill myself');
    expect(r.matchedPhrases.length).toBeGreaterThan(0);
  });
});
