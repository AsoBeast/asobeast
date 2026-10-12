import {
  KeywordBreakdownApp,
  KeywordBreakdownField,
  MetadataField,
} from '@asobeast/shared';
import {
  accentTermsOf,
  placementOf,
  withInsights,
} from './keyword-breakdown.insights';

const TERMS = ['travel', 'map'];

const field = (
  name: MetadataField,
  terms: string[],
  phrase = false,
): KeywordBreakdownField => ({
  field: name,
  value: terms.join(' ') || 'other',
  phrase,
  terms,
  looseTerms: [],
});

const app = (over: Partial<KeywordBreakdownApp> = {}): KeywordBreakdownApp => {
  const base: KeywordBreakdownApp = {
    appId: 'rival',
    name: 'Rival',
    iconUrl: null,
    isYou: false,
    position: 2,
    listingCountry: 'us',
    fields: [field('title', []), field('subtitle', [])],
    matchedTerms: 0,
    localizations: [],
    unreadLocalizations: [],
    placement: 'none',
    accentTerms: [],
    insight: null,
    ratingAvg: 4.5,
    ratingCount: 1000,
    ...over,
  };
  return {
    ...base,
    placement: placementOf(base, TERMS.length),
    accentTerms: accentTermsOf(base, TERMS.length),
  };
};

const you = (over: Partial<KeywordBreakdownApp> = {}) =>
  app({ appId: 'you', name: 'You', isYou: true, position: 40, ...over });

const insightOf = (rival: KeywordBreakdownApp, mine = you()) =>
  withInsights([mine, rival], TERMS, null).apps[1].insight;

describe('placementOf', () => {
  it.each([
    [[field('title', TERMS, true)], 'title'],
    [[field('title', ['travel']), field('subtitle', TERMS, true)], 'subtitle'],
    [[field('shortDescription', TERMS, true)], 'shortDescription'],
    [[field('title', []), field('keywordField', TERMS, true)], 'keywordField'],
    [[field('title', ['travel']), field('subtitle', ['map'])], 'split'],
    [[field('title', ['travel']), field('subtitle', [])], 'partial'],
    [[field('title', []), field('subtitle', [])], 'none'],
  ])('reads the strongest place the keyword sits', (fields, expected) => {
    expect(placementOf({ fields, localizations: [] }, 2)).toBe(expected);
  });

  it('takes the best language version and never joins two of them', () => {
    const localization = (terms: string[], phrase = false) => ({
      localization: 'es-MX',
      sourceCountry: 'mx',
      fields: [field('title', terms, phrase)],
      matchedTerms: terms.length,
    });

    expect(
      placementOf(
        {
          fields: [field('title', ['travel'])],
          localizations: [localization(TERMS, true)],
        },
        2,
      ),
    ).toBe('title');
    expect(
      placementOf(
        {
          fields: [field('title', ['travel'])],
          localizations: [localization(['map'])],
        },
        2,
      ),
    ).toBe('partial');
  });
});

describe('withInsights', () => {
  it('explains a competitor above you by its stronger placement', () => {
    expect(
      insightOf(
        app({ fields: [field('title', TERMS, true)] }),
        you({ fields: [field('subtitle', TERMS, true)] }),
      ),
    ).toEqual({ rule: 'placement', theirs: 'title', yours: 'subtitle' });
  });

  it('counts a word spelled without its accent as placed, and lists it', () => {
    const loose = { ...field('title', TERMS, true), looseTerms: ['map'] };
    const mine = you({ fields: [loose] });

    expect(mine.placement).toBe('title');
    expect(mine.accentTerms).toEqual(['map']);
    expect(withInsights([mine], TERMS, null).standing?.accentTerms).toEqual([
      'map',
    ]);
  });

  it('does not list a word another field of the same listing spells exactly', () => {
    const loose = { ...field('title', TERMS, true), looseTerms: ['map'] };

    expect(
      you({ fields: [loose, field('subtitle', ['map'])] }).accentTerms,
    ).toEqual([]);
  });

  it('points out a competitor that spells the accents you drop', () => {
    const loose = { ...field('title', TERMS, true), looseTerms: ['map'] };

    expect(
      insightOf(
        app({ fields: [field('title', TERMS, true)] }),
        you({ fields: [loose] }),
      ),
    ).toEqual({ rule: 'accent', terms: ['map'] });
  });

  it('falls back to the ratings gap when placement does not explain it', () => {
    expect(
      insightOf(
        app({ fields: [field('subtitle', TERMS, true)], ratingCount: 48000 }),
        you({ fields: [field('subtitle', TERMS, true)], ratingCount: 1200 }),
      ),
    ).toEqual({ rule: 'ratings', theirs: 48000, yours: 1200 });
  });

  it('does not call a small ratings lead a gap', () => {
    expect(
      insightOf(
        app({ fields: [field('subtitle', TERMS, true)], ratingCount: 2000 }),
        you({ fields: [field('subtitle', TERMS, true)], ratingCount: 1200 }),
      ),
    ).toEqual({ rule: 'similar' });
  });

  it('points at the hidden fields of a competitor that shows no match', () => {
    expect(
      insightOf(
        app({ ratingCount: 900 }),
        you({ fields: [field('subtitle', TERMS, true)], ratingCount: 1200 }),
      ),
    ).toEqual({ rule: 'hidden' });
  });

  it('names the missing match before the ratings of a competitor that shows none', () => {
    expect(
      insightOf(app({ ratingCount: 90000 }), you({ ratingCount: 500 })),
    ).toEqual({
      rule: 'hidden',
    });
  });

  it('says so when language versions could not be checked', () => {
    expect(
      insightOf(
        app({ ratingCount: 900, unreadLocalizations: ['ko', 'vi'] }),
        you({ fields: [field('subtitle', TERMS, true)], ratingCount: 1200 }),
      ),
    ).toEqual({ rule: 'unchecked', localizations: 2 });
  });

  it('explains only the competitors that rank above you', () => {
    const { apps } = withInsights(
      [
        you({ position: 10 }),
        app({ appId: 'below', position: 30 }),
        app({ appId: 'unranked', position: null }),
        app({ appId: 'above', position: 3 }),
      ],
      TERMS,
      null,
    );

    expect(apps.map((entry) => entry.insight !== null)).toEqual([
      false,
      false,
      false,
      true,
    ]);
  });

  it('treats every ranked competitor as above you when you do not rank', () => {
    const { standing } = withInsights(
      [you({ position: null }), app({ position: 80 }), app({ position: null })],
      TERMS,
      null,
    );

    expect(standing).toMatchObject({ above: 1, competitors: 2 });
  });

  it('sums up your standing and the words you are missing', () => {
    const { standing } = withInsights(
      [
        you({ fields: [field('title', ['travel'])] }),
        app({ fields: [field('title', TERMS, true)] }),
        app({ appId: 'other', fields: [field('title', ['travel'])] }),
      ],
      TERMS,
      9,
    );

    expect(standing).toEqual({
      above: 2,
      competitors: 2,
      aboveWithStrongerPlacement: 1,
      missingTerms: ['map'],
      accentTerms: [],
      changedDaysAgo: 9,
    });
  });

  it('forgets a listing change that has had time to settle', () => {
    expect(
      withInsights([you()], TERMS, 40).standing?.changedDaysAgo,
    ).toBeNull();
  });

  it('has no standing without your own app', () => {
    expect(withInsights([app()], TERMS, null).standing).toBeNull();
  });
});
