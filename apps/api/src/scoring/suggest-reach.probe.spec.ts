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

  it('reports a short keyword only offered for its full text as listed', async () => {
    const lookup = lookupFrom({ quiz: ['quizlet', 'quiz'] });
    await expect(probeSuggestReach('quiz', lookup)).resolves.toEqual({
      reach: { status: 'listed', position: 2 },
      requests: 4,
    });
    expect(lookup).toHaveBeenCalledTimes(4);
  });

  it('scores an eight and a nine character keyword alike when only the full text is offered', async () => {
    const eight = await probeSuggestReach(
      'location',
      lookupFrom({ location: ['location'] }),
    );
    const nine = await probeSuggestReach(
      'locations',
      lookupFrom({ locations: ['locations'] }),
    );
    expect(eight.reach).toEqual({ status: 'listed', position: 1 });
    expect(nine.reach).toEqual({ status: 'listed', position: 1 });
  });

  it('never splits a character outside the basic plane', async () => {
    const lookup = lookupFrom({ '𠮷野家': ['𠮷野家'], '𠮷': ['𠮷野家'] });
    await expect(probeSuggestReach('𠮷野家', lookup)).resolves.toEqual({
      reach: { status: 'hit', prefixLength: 1, position: 1 },
      requests: 2,
    });
    expect(lookup).toHaveBeenCalledWith('𠮷');
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
      reach: { status: 'listed', position: 1 },
      requests: 1,
    });
  });

  describe('prefix matching for a store that never echoes the term', () => {
    const playLists = {
      game: ['games', 'gamestop', 'game changers app'],
      g: ['grindr', 'gemini'],
      ga: ['games', 'gacha life'],
    };

    it('counts a completion that extends the keyword', async () => {
      const lookup = lookupFrom(playLists);
      await expect(
        probeSuggestReach('game', lookup, 'prefix'),
      ).resolves.toEqual({
        reach: { status: 'hit', prefixLength: 2, position: 1 },
        requests: 3,
      });
    });

    it.each([
      ['cat', ['catholic bible', 'cats'], 2],
      ['game', ['gamestop', 'games offline'], 2],
      ['photo', ['photoshop', 'photo editor'], 2],
      ['guess the location', ['guess the locations game'], 1],
    ])(
      'matches %s only on a word or plural boundary',
      async (keyword, list, position) => {
        const { reach } = await probeSuggestReach(
          keyword,
          lookupFrom({ [keyword]: list }),
          'prefix',
        );
        expect(reach).toMatchObject({ position });
      },
    );

    it('rejects a completion that only shares the first letters', async () => {
      await expect(
        probeSuggestReach(
          'pho',
          lookupFrom({ pho: ['photo editor'] }),
          'prefix',
        ),
      ).resolves.toEqual({ reach: { status: 'absent' }, requests: 1 });
    });

    it('still finds nothing for a phrase no completion extends', async () => {
      const lookup = lookupFrom({ 'videos put': ['videos put together'] });
      await expect(
        probeSuggestReach('videos puzzle', lookup, 'prefix'),
      ).resolves.toEqual({ reach: { status: 'absent' }, requests: 1 });
    });

    it('keeps exact matching by default', async () => {
      await expect(
        probeSuggestReach('game', lookupFrom(playLists)),
      ).resolves.toEqual({ reach: { status: 'absent' }, requests: 1 });
    });
  });
});
