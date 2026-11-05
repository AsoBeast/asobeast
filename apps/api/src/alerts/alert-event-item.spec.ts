import type {
  GranularAlertPayload,
  ReviewNegativePayload,
  SerpEntrantPayload,
} from '@asobeast/shared';
import {
  eventMarket,
  primaryAppOf,
  REMOVED_APP,
  toAlertEventItem,
  type FeedRow,
  type LiveApp,
} from './alert-event-item';
import {
  chartEntered,
  chartLeft,
  chartMilestone,
} from './chart-events.fixture';
import {
  actionOpened,
  digest,
  metadata,
  negative,
  newReview,
} from './email-fixtures.fixture';
import {
  appDelisted,
  appUnlistedMarket,
  ratingDropped,
  reviewSpike,
} from './listing-events.fixture';
import {
  drop,
  firstRanking,
  improvement,
  milestone,
  overtake,
} from './rank-events.fixture';
import { sentenceOf } from './report/report-sentences';

const createdAt = new Date('2026-11-03T10:15:30.123Z');
const identity = {
  iconUrl: 'https://is1-ssl.mzstatic.com/icon.png',
  store: 'APP_STORE' as const,
  country: 'us',
};

const entrant: SerpEntrantPayload = {
  event: 'serp.entrant',
  occurredAt: '2026-11-03T03:10:00.000Z',
  keyword: {
    id: 'kw_e',
    text: 'habit tracker',
    store: 'GOOGLE_PLAY',
    country: 'de',
  },
  date: '2026-11-03',
  entrants: [],
};

const rowOf = (
  payload: GranularAlertPayload,
  overrides: Partial<FeedRow> = {},
): FeedRow => ({
  id: 'row_1',
  event: payload.event,
  appId: 'app' in payload ? payload.app.id : null,
  keywordId: null,
  payload: payload as unknown as FeedRow['payload'],
  createdAt,
  ...overrides,
});

const withIdentity = <T extends GranularAlertPayload>(payload: T): T =>
  'app' in payload
    ? { ...payload, app: { ...payload.app, ...identity } }
    : payload;

describe('toAlertEventItem', () => {
  it.each(
    [
      drop(),
      improvement(),
      milestone(),
      firstRanking(),
      overtake(),
      metadata,
      negative,
      actionOpened,
      chartEntered(),
      chartLeft(),
      chartMilestone({ from: null, to: 7 }),
      ratingDropped(),
      reviewSpike(),
      appDelisted(),
      appUnlistedMarket(),
    ].map((payload) => [payload.event, withIdentity(payload)] as const),
  )(
    'turns a %s row into an item with its sentence and identity',
    (_event, payload) => {
      const item = toAlertEventItem(rowOf(payload), 'home');

      expect(item).toEqual({
        id: 'row_1',
        event: payload.event,
        occurredAt: createdAt.toISOString(),
        sentence: sentenceOf(payload, false).text,
        appId: 'app' in payload ? payload.app.id : null,
        appName: 'app' in payload ? payload.app.name : null,
        iconUrl: identity.iconUrl,
        store: identity.store,
        country: eventMarket(payload),
        primaryAppId: 'home',
        payload,
      });
    },
  );

  it('answers an entrant with no app identity', () => {
    const item = toAlertEventItem(rowOf(entrant, { keywordId: 'kw_e' }), 'p');

    expect(item).toMatchObject({
      event: 'serp.entrant',
      appId: null,
      appName: null,
      iconUrl: null,
      store: null,
      country: 'de',
      primaryAppId: 'p',
      sentence: sentenceOf(entrant, false).text,
    });
  });

  it('answers a null icon and store when the payload carries no identity', () => {
    expect(toAlertEventItem(rowOf(drop()), null)).toMatchObject({
      iconUrl: null,
      store: null,
      primaryAppId: null,
    });
  });

  it.each([
    ['a new review', rowOf(newReview)],
    ['the weekly digest', rowOf(digest)],
    ['an unknown event', rowOf(drop(), { event: 'nope' })],
    ['a payload that is not an object', rowOf(drop(), { payload: 'text' })],
    ['an array payload', rowOf(drop(), { payload: [] })],
    ['a null payload', rowOf(drop(), { payload: null })],
    ['a payload of another event', rowOf(drop(), { event: 'rank.improved' })],
    [
      'a change with no changes',
      rowOf(metadata, {
        payload: { event: 'metadata.changed', app: metadata.app },
      }),
    ],
    ['an empty payload', rowOf(drop(), { payload: {} })],
  ])('skips %s', (_case, row) => {
    expect(toAlertEventItem(row, null)).toBeNull();
  });
});

describe('eventMarket', () => {
  const bare: ReviewNegativePayload = {
    ...negative,
    app: { id: 'x', name: 'Bare' },
  };

  it.each([
    ['a keyword event', drop(), 'us'],
    ['an entrant', entrant, 'de'],
    ['a chart event', chartEntered(), 'us'],
    ['a rating drop', ratingDropped({ country: 'fr' }), 'fr'],
    ['an unlisted market', appUnlistedMarket({ market: 'jp' }), 'jp'],
    ['a delisting', appDelisted({ country: 'gb' }), 'gb'],
    ['a change with an identity', withIdentity(metadata), 'us'],
    ['a review with an identity', withIdentity(negative), 'us'],
    ['a review without an identity', bare, null],
  ] as const)('answers the market of %s', (_case, payload, market) => {
    expect(eventMarket(payload)).toBe(market);
  });
});

describe('primaryAppOf', () => {
  const live = new Map<string, LiveApp>([
    ['p1', { id: 'p1', primaryAppId: null }],
    ['c1', { id: 'c1', primaryAppId: 'p1' }],
  ]);
  const trackers = new Map<string, readonly string[]>([['k1', ['p1', 'p2']]]);
  const home = (
    row: { appId: string | null; keywordId: string | null },
    preferred: string | null = null,
  ) => primaryAppOf({ row, live, trackers, preferred });

  it('answers a live primary app itself', () => {
    expect(home({ appId: 'p1', keywordId: null })).toBe('p1');
  });

  it('answers the primary app of a live competitor', () => {
    expect(home({ appId: 'c1', keywordId: null })).toBe('p1');
  });

  it('marks a row of an app that no longer exists', () => {
    expect(home({ appId: 'gone', keywordId: null })).toBe(REMOVED_APP);
  });

  it('answers the preferred tracker of an entrant', () => {
    expect(home({ appId: null, keywordId: 'k1' }, 'p2')).toBe('p2');
  });

  it('answers the first tracker when the preferred app does not track it', () => {
    expect(home({ appId: null, keywordId: 'k1' }, 'p9')).toBe('p1');
    expect(home({ appId: null, keywordId: 'k1' })).toBe('p1');
  });

  it('answers no app for an entrant nobody tracks or a row with neither', () => {
    expect(home({ appId: null, keywordId: 'k9' })).toBeNull();
    expect(home({ appId: null, keywordId: null })).toBeNull();
  });
});
