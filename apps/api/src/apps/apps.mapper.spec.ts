import { App, AppSetup, AppSnapshot, Store } from '@prisma/client';
import { NormalizedApp } from '../store-providers/types';
import {
  defaultSetup,
  setupStateOf,
  snapshotIcon,
  toAppDetail,
  toAppListItem,
  toCompetitorItem,
  toListingMarkets,
  toSnapshotData,
  toSetupState,
  toSnapshotSummary,
  withTracking,
} from './apps.mapper';

const NORMALIZED: NormalizedApp = {
  store: Store.APP_STORE,
  storeAppId: '1',
  title: 'Habit Tracker',
  description: 'Build habits.',
  raw: { icon: 'https://cdn.test/icon.png' },
  searchable: true,
};

describe('toSnapshotData', () => {
  it('stores no market for the home listing', () => {
    expect(toSnapshotData('app_1', NORMALIZED)).toMatchObject({
      country: null,
    });
  });

  it('stores the market a listing was captured from', () => {
    expect(toSnapshotData('app_1', NORMALIZED, 'de')).toMatchObject({
      country: 'de',
      title: 'Habit Tracker',
    });
  });
});

describe('snapshotIcon', () => {
  it('reads the icon from the captured payload', () => {
    expect(snapshotIcon(Store.APP_STORE, { raw: NORMALIZED.raw })).toBe(
      'https://cdn.test/icon.png',
    );
  });

  it('reads no icon from a payload without one', () => {
    expect(snapshotIcon(Store.GOOGLE_PLAY, { raw: {} })).toBeNull();
  });
});

describe('toListingMarkets', () => {
  const row = (country: string | null, capturedAt: string | null) => ({
    country,
    _max: { capturedAt: capturedAt === null ? null : new Date(capturedAt) },
  });

  it('lists the home market first even before it has a listing', () => {
    expect(
      toListingMarkets('us', [row('de', '2026-07-02T00:00:00.000Z')], []),
    ).toEqual([
      { country: 'us', home: true, capturedAt: null },
      { country: 'de', home: false, capturedAt: '2026-07-02T00:00:00.000Z' },
    ]);
  });

  it('folds the captured localizations of a market into it in table order', () => {
    expect(
      toListingMarkets(
        'pl',
        [
          row(null, '2026-07-01T00:00:00.000Z'),
          { ...row(null, '2026-07-01T00:01:00.000Z'), localization: 'pl' },
          row('be', '2026-07-02T00:00:00.000Z'),
          { ...row('be', '2026-07-02T00:01:00.000Z'), localization: 'fr' },
          { ...row('be', '2026-07-02T00:02:00.000Z'), localization: 'nl' },
          row('de', '2026-07-03T00:00:00.000Z'),
        ],
        [],
      ),
    ).toEqual([
      {
        country: 'pl',
        home: true,
        capturedAt: '2026-07-01T00:00:00.000Z',
        localizations: ['pl'],
      },
      {
        country: 'be',
        home: false,
        capturedAt: '2026-07-02T00:00:00.000Z',
        localizations: ['nl', 'fr'],
      },
      { country: 'de', home: false, capturedAt: '2026-07-03T00:00:00.000Z' },
    ]);
  });

  it('folds a shipped localization in and leaves out one the app stopped shipping', () => {
    const rows = [
      row(null, '2026-07-01T00:00:00.000Z'),
      row('ch', '2026-07-02T00:00:00.000Z'),
      { ...row('ch', '2026-07-02T00:01:00.000Z'), localization: 'fr' },
    ];

    expect(toListingMarkets('us', rows, ['fr'])[1]).toEqual({
      country: 'ch',
      home: false,
      capturedAt: '2026-07-02T00:00:00.000Z',
      localizations: ['fr'],
    });
    expect(toListingMarkets('us', rows, [])[1]).toEqual({
      country: 'ch',
      home: false,
      capturedAt: '2026-07-02T00:00:00.000Z',
    });
  });

  it('lists the other markets by code with the time of their newest listing', () => {
    expect(
      toListingMarkets(
        'us',
        [
          row('pl', '2026-07-03T00:00:00.000Z'),
          row(null, '2026-07-01T00:00:00.000Z'),
          row('de', '2026-07-02T00:00:00.000Z'),
        ],
        [],
      ),
    ).toEqual([
      { country: 'us', home: true, capturedAt: '2026-07-01T00:00:00.000Z' },
      { country: 'de', home: false, capturedAt: '2026-07-02T00:00:00.000Z' },
      { country: 'pl', home: false, capturedAt: '2026-07-03T00:00:00.000Z' },
    ]);
  });
});

describe('toSnapshotSummary', () => {
  const US_APP = { store: Store.APP_STORE, country: 'us' };
  const snapshot = (country: string | null, raw: unknown = {}) =>
    ({
      id: 's1',
      country,
      title: 'T',
      subtitle: null,
      summary: null,
      ratingAvg: null,
      ratingCount: null,
      installs: null,
      price: null,
      version: null,
      raw,
      capturedAt: new Date('2026-07-01T00:00:00.000Z'),
    }) as AppSnapshot;

  it('names the home storefront for a home snapshot', () => {
    expect(toSnapshotSummary(snapshot(null), US_APP).country).toBe('us');
  });

  it('names the market of a market snapshot', () => {
    expect(toSnapshotSummary(snapshot('de'), US_APP).country).toBe('de');
  });

  it('names the currency the store sold the price in', () => {
    expect(
      toSnapshotSummary(snapshot(null, { currency: 'EUR' }), US_APP).currency,
    ).toBe('EUR');
  });

  it('answers a null currency when the payload names none', () => {
    expect(toSnapshotSummary(snapshot(null), US_APP).currency).toBeNull();
    expect(
      toSnapshotSummary(snapshot(null, { currency: 'euro' }), US_APP).currency,
    ).toBeNull();
  });
});

describe('the listing facts of a snapshot', () => {
  const appOf = (id: string, store: Store, country = 'us'): App => ({
    id,
    workspaceId: 'ws_1',
    store,
    storeAppId: id,
    country,
    name: id,
    iconUrl: null,
    delistedAt: null,
    unlistedMarkets: [],
    isCompetitor: false,
    primaryAppId: null,
    groupId: null,
    replyGuidelines: null,
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
  });
  const snapshotOf = (
    id: string,
    raw: unknown,
    dates: { releasedAt?: Date | null; storeUpdatedAt?: Date | null } = {},
  ) =>
    ({
      id,
      country: null,
      title: id,
      subtitle: null,
      summary: null,
      description: `${id} description`,
      ratingAvg: null,
      ratingCount: null,
      installs: null,
      price: null,
      version: null,
      raw,
      releasedAt: dates.releasedAt ?? null,
      storeUpdatedAt: dates.storeUpdatedAt ?? null,
      capturedAt: new Date('2026-11-01T00:00:00.000Z'),
    }) as AppSnapshot;
  const DATES = {
    releasedAt: new Date('2015-03-12T00:00:00.000Z'),
    storeUpdatedAt: new Date('2026-11-10T08:30:00.000Z'),
  };
  const PLAY_RAW = {
    genreId: 'TRAVEL_AND_LOCAL',
    genre: 'Travel & Local',
    developerId: '5700313618786177705',
    developer: 'IHG',
    contentRating: 'Everyone',
  };
  const PLAY_FACTS = {
    genre: 'TRAVEL_AND_LOCAL',
    genreName: 'Travel & Local',
    developer: 'IHG',
    developerId: '5700313618786177705',
    contentRating: 'Everyone',
    releasedAt: '2015-03-12T00:00:00.000Z',
    storeUpdatedAt: '2026-11-10T08:30:00.000Z',
  };
  const APP_STORE_RAW = {
    primaryGenreId: '6013',
    primaryGenre: 'Health & Fitness',
    artistId: 284882218,
    developer: '  Habit Labs ',
    contentRating: '4+',
  };
  const APP_STORE_FACTS = {
    genre: '6013',
    genreName: 'Health & Fitness',
    developer: 'Habit Labs',
    developerId: '284882218',
    contentRating: '4+',
    releasedAt: '2015-03-12T00:00:00.000Z',
    storeUpdatedAt: '2026-11-10T08:30:00.000Z',
  };
  const play = appOf('play_1', Store.GOOGLE_PLAY);
  const appStore = appOf('ios_1', Store.APP_STORE);

  it('answers the Google Play facts on a competitor', () => {
    expect(
      toCompetitorItem(play, snapshotOf('s1', PLAY_RAW, DATES)).latestSnapshot,
    ).toMatchObject(PLAY_FACTS);
  });

  it('answers the App Store facts on a competitor', () => {
    expect(
      toCompetitorItem(appStore, snapshotOf('s1', APP_STORE_RAW, DATES))
        .latestSnapshot,
    ).toMatchObject(APP_STORE_FACTS);
  });

  it("answers the facts of the app's own listing on the detail", () => {
    expect(
      toAppDetail(play, snapshotOf('s1', PLAY_RAW, DATES), [], null)
        .latestSnapshot,
    ).toMatchObject(PLAY_FACTS);
  });

  it('answers the facts of a rival on the detail', () => {
    const rival = {
      ...appOf('rival_1', Store.APP_STORE),
      snapshots: [snapshotOf('s2', APP_STORE_RAW, DATES)],
    };

    const detail = toAppDetail(
      appStore,
      snapshotOf('s1', { ...APP_STORE_RAW, contentRating: '17+' }, DATES),
      [rival],
      null,
    );

    expect(detail.competitors[0]?.latestSnapshot).toMatchObject(
      APP_STORE_FACTS,
    );
    expect(detail.latestSnapshot?.contentRating).toBe('17+');
  });

  it('answers null for every fact the payload does not say', () => {
    const summary = toCompetitorItem(play, snapshotOf('s1', {})).latestSnapshot;

    expect(summary).toHaveProperty('genre', null);
    expect(summary).toMatchObject({
      genre: null,
      genreName: null,
      developer: null,
      developerId: null,
      contentRating: null,
      releasedAt: null,
      storeUpdatedAt: null,
    });
  });

  it("answers the description and release notes on the app's own listing", () => {
    const snapshot = {
      ...snapshotOf('s1', { ...PLAY_RAW, recentChanges: 'New maps' }),
      description: 'Plan trips.',
    };

    expect(toAppDetail(play, snapshot, [], null).latestSnapshot).toMatchObject({
      description: 'Plan trips.',
      releaseNotes: 'New maps',
    });
  });

  it('leaves the description and release notes off every rival', () => {
    const rival = {
      ...appOf('rival_1', Store.GOOGLE_PLAY),
      snapshots: [snapshotOf('s2', { ...PLAY_RAW, recentChanges: 'Rival' })],
    };

    const summary = toAppDetail(play, snapshotOf('s1', PLAY_RAW), [rival], null)
      .competitors[0]?.latestSnapshot;

    expect(summary).not.toHaveProperty('description');
    expect(summary).not.toHaveProperty('releaseNotes');
  });

  it('leaves the description and release notes off a competitor item', () => {
    const summary = toCompetitorItem(
      play,
      snapshotOf('s1', { ...PLAY_RAW, recentChanges: 'Rival' }),
    ).latestSnapshot;

    expect(summary).not.toHaveProperty('description');
    expect(summary).not.toHaveProperty('releaseNotes');
  });

  it('answers a null date for a column that is not a valid date', () => {
    const snapshot = snapshotOf('s1', {}, { storeUpdatedAt: new Date('nope') });

    expect(
      toAppDetail(appStore, snapshot, [], null).latestSnapshot,
    ).toHaveProperty('storeUpdatedAt', null);
  });
});

describe('withTracking', () => {
  it('marks the home market and every market with a tracked keyword', () => {
    const markets = [
      { country: 'us', home: true, capturedAt: null },
      { country: 'de', home: false, capturedAt: null },
      { country: 'fr', home: false, capturedAt: null },
    ];

    expect(
      withTracking(markets, new Set(['de'])).map((market) => market.tracked),
    ).toEqual([true, true, false]);
  });
});

describe('the setup state', () => {
  const row = (overrides: Partial<AppSetup> = {}): AppSetup => ({
    appId: 'app_1',
    workspaceId: 'ws_1',
    status: 'in_progress',
    skipped: ['countries', 'competitors'],
    countriesReviewed: true,
    selectedMarkets: ['de', 'us'],
    completedAt: null,
    createdAt: new Date('2026-10-14T08:00:00.000Z'),
    updatedAt: new Date('2026-10-14T09:00:00.000Z'),
    ...overrides,
  });

  it('answers not started with the home market for an app without a row', () => {
    expect(defaultSetup({ id: 'app_1', country: 'pl' })).toEqual({
      appId: 'app_1',
      status: 'not_started',
      skipped: [],
      countriesReviewed: false,
      selectedMarkets: ['pl'],
      completedAt: null,
      updatedAt: null,
    });
  });

  it('maps a row with its skipped steps in step order', () => {
    expect(
      toSetupState(
        row({
          status: 'completed',
          completedAt: new Date('2026-10-14T09:30:00.000Z'),
        }),
      ),
    ).toEqual({
      appId: 'app_1',
      status: 'completed',
      skipped: ['competitors', 'countries'],
      countriesReviewed: true,
      selectedMarkets: ['de', 'us'],
      completedAt: '2026-10-14T09:30:00.000Z',
      updatedAt: '2026-10-14T09:00:00.000Z',
    });
  });

  it('reads the row of an app or falls back to its default', () => {
    expect(
      setupStateOf({ id: 'app_1', country: 'us', appSetup: row() }),
    ).toEqual(toSetupState(row()));
    expect(
      setupStateOf({ id: 'app_1', country: 'us', appSetup: null }),
    ).toEqual(defaultSetup({ id: 'app_1', country: 'us' }));
  });

  it('reads an unknown status as not started and drops an unknown step', () => {
    expect(
      toSetupState(row({ status: 'paused', skipped: ['alerts', 'keywords'] })),
    ).toMatchObject({ status: 'not_started', skipped: ['keywords'] });
  });
});

describe('the delisted time', () => {
  const app = (delistedAt: Date | null): App => ({
    id: 'app_1',
    workspaceId: 'ws_1',
    store: Store.APP_STORE,
    storeAppId: '471112395',
    country: 'us',
    name: 'Gone',
    iconUrl: null,
    delistedAt,
    unlistedMarkets: [],
    isCompetitor: false,
    primaryAppId: null,
    groupId: null,
    replyGuidelines: null,
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
  });
  const delisted = app(new Date('2026-10-21T03:04:05.000Z'));

  it('answers when the store stopped listing the app on every app shape', () => {
    const expected = { delistedAt: '2026-10-21T03:04:05.000Z' };

    expect(toAppDetail(delisted, null, [], null)).toMatchObject(expected);
    expect(toCompetitorItem(delisted, null)).toMatchObject(expected);
    expect(toAppListItem(delisted, null, 0, 0)).toMatchObject(expected);
  });

  it('answers null for an app the store lists', () => {
    const listed = app(null);

    expect(toAppDetail(listed, null, [], null).delistedAt).toBeNull();
    expect(toCompetitorItem(listed, null).delistedAt).toBeNull();
    expect(toAppListItem(listed, null, 0, 0).delistedAt).toBeNull();
  });
});
