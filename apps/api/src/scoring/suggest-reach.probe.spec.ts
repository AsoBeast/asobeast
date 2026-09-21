import { probeSuggestReach } from './suggest-reach.probe';

const lookupFrom = (lists: Record<string, string[]>) =>
  jest.fn((term: string) =>
    Promise.resolve((lists[term] ?? []).map((item) => ({ term: item }))),
  );

describe('probeSuggestReach', () => {
  it('spends one request on a keyword the store never suggests', async () => {
    const lookup = lookupFrom({});
    await expect(probeSuggestReach('videos put', lookup)).resolves.toEqual({
      reach: { status: 'absent' },
      requests: 1,
    });
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(lookup).toHaveBeenCalledWith('videos put');
  });

  it('stops at the shortest prefix that offers the keyword', async () => {
    const lookup = lookupFrom({
      trivia: ['trivia', 'trivia crack'],
      t: ['tiktok'],
      tr: ['translate'],
      tri: ['trivago', 'trivia'],
    });
    await expect(probeSuggestReach('trivia', lookup)).resolves.toEqual({
      reach: { status: 'hit', prefixLength: 3, position: 2 },
      requests: 4,
    });
    expect(lookup).not.toHaveBeenCalledWith('triv');
  });

  it('reuses the full term list when the keyword is shorter than the cap', async () => {
    const lookup = lookupFrom({ quiz: ['quizlet', 'quiz'] });
    await expect(probeSuggestReach('quiz', lookup)).resolves.toEqual({
      reach: { status: 'hit', prefixLength: 4, position: 2 },
      requests: 4,
    });
  });

  it('reports a keyword that is only offered for its full text as listed', async () => {
    const lookup = lookupFrom({ 'guess the location': ['guess the location'] });
    await expect(
      probeSuggestReach('guess the location', lookup),
    ).resolves.toEqual({
      reach: { status: 'listed', position: 1 },
      requests: 9,
    });
  });

  it('compares on the search key', async () => {
    const lookup = lookupFrom({ 'géo quiz': ['Geo Quiz'], g: ['GEO  QUIZ'] });
    const { reach } = await probeSuggestReach('géo quiz', lookup);
    expect(reach).toEqual({ status: 'hit', prefixLength: 1, position: 1 });
  });

  it('gives up as unavailable when a lookup throws', async () => {
    const lookup = jest.fn().mockRejectedValue(new Error('hints down'));
    await expect(probeSuggestReach('trivia', lookup)).resolves.toEqual({
      reach: { status: 'unavailable' },
      requests: 1,
    });
  });

  it('handles a one character keyword', async () => {
    const lookup = lookupFrom({ x: ['x'] });
    await expect(probeSuggestReach('x', lookup)).resolves.toEqual({
      reach: { status: 'hit', prefixLength: 1, position: 1 },
      requests: 1,
    });
  });
});
