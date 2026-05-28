import {
  recommendResources,
  deriveTagsFromText,
} from '../src/lib/resources/recommendationEngine';

describe('resource recommendation engine', () => {
  it('derives tags from conversation text', () => {
    const tags = deriveTagsFromText("She didn't reply to my text and I keep overthinking it");
    expect(tags).toEqual(expect.arrayContaining(['anxious-attachment', 'rumination']));
  });

  it('recommends Attached for anxious-attachment context', () => {
    const recs = recommendResources({ coachTags: ['anxious-attachment'] });
    expect(recs[0]?.resource.id).toBe('attached');
  });

  it('recommends No More Mr. Nice Guy for people-pleasing', () => {
    const recs = recommendResources({ contextText: 'I am such a nice guy and people-pleaser' });
    const ids = recs.map((r) => r.resource.id);
    expect(ids).toContain('no-more-mr-nice-guy');
  });

  it('weights coach tags above keyword-derived tags', () => {
    const recs = recommendResources({
      coachTags: ['cbt'],
      contextText: 'dating dating dating',
    });
    // cbt (weight 2) should outrank dating (weight 1)
    expect(recs[0]?.resource.tags).toContain('cbt');
  });

  it('returns nothing when there is no signal', () => {
    expect(recommendResources({ contextText: 'hello there' })).toEqual([]);
    expect(recommendResources({})).toEqual([]);
  });

  it('respects the limit', () => {
    const recs = recommendResources({
      coachTags: ['anxious-attachment', 'cbt', 'rumination', 'people-pleasing'],
      limit: 2,
    });
    expect(recs.length).toBeLessThanOrEqual(2);
  });
});
