import { Store } from '@prisma/client';
import { MARKET_SEED_LIMIT } from '@asobeast/shared';
import { seedCandidates, seedSources } from './listing-seed';
import { ListingText } from './listing-texts';

const NATIVE: ListingText = {
  title: 'Quiz Geograficzny',
  subtitle: 'Mapa Świata',
  summary: null,
  languages: ['pl'],
};

const DEFAULT: ListingText = {
  title: 'GeoGuess Map Quiz',
  subtitle: 'Geography Trivia',
  summary: null,
  languages: ['en'],
};

describe('seedSources', () => {
  it.each([
    [Store.APP_STORE, ['TITLE', 'SUBTITLE']],
    [Store.GOOGLE_PLAY, ['TITLE', 'DESCRIPTION']],
  ])('seeds a %s listing from %j', (store, sources) => {
    expect(seedSources(store)).toEqual(sources);
  });
});

describe('seedCandidates', () => {
  it('takes phrases of the native localization and the default in turn', () => {
    const candidates = seedCandidates(Store.APP_STORE, [NATIVE, DEFAULT]);
    const texts = candidates.map((candidate) => candidate.text);

    expect(texts[0]).toBe('quiz geograficzny');
    expect(texts[1]).toBe('geoguess map quiz');
    expect(texts).toContain('mapa świata');
    expect(new Set(texts).size).toBe(texts.length);
    expect(texts.length).toBeLessThanOrEqual(MARKET_SEED_LIMIT);
    expect(
      candidates.every((candidate) =>
        ['TITLE', 'SUBTITLE'].includes(candidate.source),
      ),
    ).toBe(true);
  });

  it('seeds nothing from no listing', () => {
    expect(seedCandidates(Store.APP_STORE, [])).toEqual([]);
  });
});
