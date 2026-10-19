import { Store } from '@prisma/client';
import type {
  KeywordBreakdownApp,
  KeywordBreakdownListing,
  MetadataField,
} from '@asobeast/shared';
import {
  judgeField,
  judgeListing,
  keywordWords,
} from './keyword-breakdown-fields';
import {
  insightFor,
  ranksAbove,
  recentChange,
  standingOf,
  withInsights,
} from './keyword-breakdown-insights';

const MARKET = 'us';

const app = (
  overrides: Partial<KeywordBreakdownApp> = {},
): KeywordBreakdownApp => ({
  appId: 'rival',
  name: 'Rival',
  iconUrl: null,
  isYou: false,
  ranking: { position: 10, depth: 200, date: '2026-10-18' },
  listingCountry: MARKET,
  capturedAt: '2026-10-17T03:00:00.000Z',
  listings: [],
  unread: [],
  placement: 'none',
  rating: { average: 4.5, count: 100, country: MARKET },
  insight: null,
  ...overrides,
});

const you = (overrides: Partial<KeywordBreakdownApp> = {}) =>
  app({ appId: 'you', name: 'You', isYou: true, ...overrides });

const at = (position: number | null) => ({
  ranking: { position, depth: 200, date: '2026-10-18' },
});

const listingOf = (
  keyword: string,
  surfaces: Array<[MetadataField, string]>,
  localization = 'en-US',
): KeywordBreakdownListing =>
  judgeListing(
    localization,
    'default',
    surfaces.map(([field, value]) =>
      judgeField({ field, value }, keyword, keywordWords(keyword), true),
    ),
  );

const ratedBy = (count: number | null, country = MARKET) => ({
  rating: { average: 4.5, count, country },
});

const insight = (
  theirs: Partial<KeywordBreakdownApp>,
  yours: Partial<KeywordBreakdownApp> = {},
  store: Store = Store.APP_STORE,
  words: string[] = ['habit', 'tracker'],
) => insightFor(app(theirs), you(yours), { store, market: MARKET, words });

describe('ranksAbove', () => {
  it('a competitor at 3 ranks above you at 10', () => {
    expect(ranksAbove(app(at(3)), you(at(10)))).toBe(true);
  });

  it('a competitor at 10 does not rank above you at 10', () => {
    expect(ranksAbove(app(at(10)), you(at(10)))).toBe(false);
  });

  it('a found competitor ranks above you when you are not found', () => {
    expect(ranksAbove(app(at(150)), you(at(null)))).toBe(true);
  });

  it('a competitor not found never ranks above', () => {
    expect(ranksAbove(app(at(null)), you(at(10)))).toBe(false);
    expect(ranksAbove(app(at(null)), you(at(null)))).toBe(false);
  });

  it('nothing ranks above you before you are checked', () => {
    expect(ranksAbove(app(at(3)), you({ ranking: null }))).toBe(false);
  });

  it('a competitor never checked never ranks above', () => {
    expect(ranksAbove(app({ ranking: null }), you(at(10)))).toBe(false);
  });
});

describe('insightFor', () => {
  it('placement', () => {
    expect(insight({ placement: 'title' }, { placement: 'subtitle' })).toEqual({
      rule: 'placement',
      theirs: 'title',
      yours: 'subtitle',
    });
  });

  it('placement does not fire on equal strength', () => {
    expect(
      insight({ placement: 'subtitle' }, { placement: 'subtitle' }).rule,
    ).toBe('similar');
    expect(
      insight(
        { placement: 'shortDescription' },
        { placement: 'subtitle' },
        Store.GOOGLE_PLAY,
      ).rule,
    ).toBe('similar');
  });

  it('spelling', () => {
    const keyword = 'visites guidees';
    expect(
      insight(
        {
          placement: 'partial',
          listings: [listingOf(keyword, [['title', 'Visites guidees']])],
        },
        {
          placement: 'partial',
          listings: [listingOf(keyword, [['title', 'Guidées']])],
        },
        Store.APP_STORE,
        keywordWords(keyword),
      ),
    ).toEqual({ rule: 'spelling', words: ['guidees'] });
  });

  it('ratings at the boundary', () => {
    expect(insight(ratedBy(300), ratedBy(100))).toEqual({
      rule: 'ratings',
      theirs: 300,
      yours: 100,
    });
    expect(insight(ratedBy(299), ratedBy(100)).rule).not.toBe('ratings');
  });

  it('ratings needs a gap of at least 100', () => {
    expect(insight(ratedBy(100), ratedBy(10)).rule).not.toBe('ratings');
    expect(insight(ratedBy(110), ratedBy(10)).rule).toBe('ratings');
  });

  it('ratings counts you as one when you have none', () => {
    expect(insight(ratedBy(100), ratedBy(0))).toEqual({
      rule: 'ratings',
      theirs: 100,
      yours: 0,
    });
  });

  it('ratings never compares two markets', () => {
    expect(insight(ratedBy(5000, 'gb'), ratedBy(10)).rule).not.toBe('ratings');
    expect(insight(ratedBy(5000), ratedBy(10, 'gb')).rule).not.toBe('ratings');
  });

  it('ratings needs both counts', () => {
    expect(insight(ratedBy(null), ratedBy(10)).rule).not.toBe('ratings');
    expect(insight(ratedBy(5000), ratedBy(null)).rule).not.toBe('ratings');
    expect(insight({ rating: null }, ratedBy(10)).rule).not.toBe('ratings');
  });

  it('unread', () => {
    expect(
      insight(
        { placement: 'partial', unread: ['es-MX'] },
        { placement: 'partial' },
      ),
    ).toEqual({
      rule: 'unread',
      localizations: ['es-MX'],
    });
  });

  it('hidden on the App Store', () => {
    expect(insight({ placement: 'none' })).toEqual({ rule: 'hidden' });
  });

  it('never hidden on Google Play', () => {
    expect(insight({ placement: 'none' }, {}, Store.GOOGLE_PLAY)).toEqual({
      rule: 'similar',
    });
  });

  it('similar', () => {
    expect(
      insight(
        { placement: 'split', ...ratedBy(120) },
        { placement: 'split', ...ratedBy(100) },
      ),
    ).toEqual({ rule: 'similar' });
  });

  it('rules apply in order', () => {
    expect(
      insight(
        { placement: 'title', ...ratedBy(5000) },
        { placement: 'subtitle', ...ratedBy(10) },
      ).rule,
    ).toBe('placement');
  });
});

describe('withInsights', () => {
  it('notes only competitors above you', () => {
    const apps = withInsights(
      [
        you(at(10)),
        app({ appId: 'below', ...at(15) }),
        app({ appId: 'above', ...at(3) }),
      ],
      { store: Store.APP_STORE, market: MARKET, words: ['habit'] },
    );
    expect(apps.find((each) => each.appId === 'you')?.insight).toBeNull();
    expect(apps.find((each) => each.appId === 'below')?.insight).toBeNull();
    expect(apps.find((each) => each.appId === 'above')?.insight).toEqual({
      rule: 'hidden',
    });
  });

  it('notes nobody before you are checked', () => {
    const apps = withInsights([you({ ranking: null }), app(at(3))], {
      store: Store.APP_STORE,
      market: MARKET,
      words: ['habit'],
    });
    expect(apps.every((each) => each.insight === null)).toBe(true);
  });

  it('answers the apps unchanged without your app', () => {
    const apps = [app(at(3))];
    expect(
      withInsights(apps, {
        store: Store.APP_STORE,
        market: MARKET,
        words: ['habit'],
      }),
    ).toEqual(apps);
  });
});

describe('standingOf', () => {
  const words = ['habit', 'tracker'];

  it('counts competitors above you', () => {
    expect(
      standingOf(
        [
          you(at(10)),
          app({ appId: 'a', ...at(3) }),
          app({ appId: 'b', ...at(4) }),
          app({ appId: 'c', ...at(30) }),
        ],
        words,
        null,
      ),
    ).toMatchObject({ above: 2, competitors: 3, checked: true });
  });

  it('lists the words none of your listings holds', () => {
    const standing = standingOf(
      [you({ listings: [listingOf('habit tracker', [['title', 'Habit']])] })],
      words,
      null,
    );
    expect(standing.missingWords).toEqual(['tracker']);
    expect(standing.foldedWords).toEqual([]);
  });

  it('lists the words you hold only with accents ignored', () => {
    expect(
      standingOf(
        [
          you({
            listings: [listingOf('visites guidees', [['title', 'Guidées']])],
          }),
        ],
        ['visites', 'guidees'],
        null,
      ),
    ).toMatchObject({ missingWords: ['visites'], foldedWords: ['guidees'] });
  });

  it('unchecked', () => {
    expect(
      standingOf([you({ ranking: null }), app(at(3))], words, null),
    ).toMatchObject({ checked: false, above: 0, competitors: 1 });
  });

  it('carries the recent change', () => {
    const change = { date: '2026-10-12', source: 'listing' as const };
    expect(standingOf([you()], words, change).recentChange).toEqual(change);
  });
});

describe('recentChange', () => {
  const now = new Date('2026-10-18T12:00:00Z');

  it('answers the newer of the two', () => {
    expect(
      recentChange(
        {
          listing: new Date('2026-10-10T00:00:00Z'),
          keywordField: new Date('2026-10-12T00:00:00Z'),
        },
        now,
      ),
    ).toEqual({ date: '2026-10-12', source: 'keywordField' });
    expect(
      recentChange(
        {
          listing: new Date('2026-10-14T00:00:00Z'),
          keywordField: new Date('2026-10-12T00:00:00Z'),
        },
        now,
      ),
    ).toEqual({ date: '2026-10-14', source: 'listing' });
  });

  it('keeps a change 28 days old', () => {
    expect(
      recentChange(
        { listing: new Date('2026-09-20T13:00:00Z'), keywordField: null },
        now,
      ),
    ).toEqual({ date: '2026-09-20', source: 'listing' });
    expect(
      recentChange(
        { listing: new Date('2026-09-20T11:00:00Z'), keywordField: null },
        now,
      ),
    ).toBeNull();
  });

  it('answers null with neither', () => {
    expect(recentChange({ listing: null, keywordField: null }, now)).toBeNull();
  });

  it('formats the UTC day', () => {
    expect(
      recentChange(
        { listing: new Date('2026-10-17T23:30:00-05:00'), keywordField: null },
        now,
      )?.date,
    ).toBe('2026-10-18');
  });
});
