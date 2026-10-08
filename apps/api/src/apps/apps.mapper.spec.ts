import { AppSnapshot, Store } from '@prisma/client';
import { NormalizedApp } from '../store-providers/types';
import {
  snapshotIcon,
  toListingMarkets,
  toSnapshotData,
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
      toListingMarkets('us', [row('de', '2026-07-02T00:00:00.000Z')]),
    ).toEqual([
      { country: 'us', home: true, capturedAt: null },
      { country: 'de', home: false, capturedAt: '2026-07-02T00:00:00.000Z' },
    ]);
  });

  it('folds the captured localizations of a market into it in table order', () => {
    expect(
      toListingMarkets('pl', [
        row(null, '2026-07-01T00:00:00.000Z'),
        { ...row(null, '2026-07-01T00:01:00.000Z'), localization: 'pl' },
        row('be', '2026-07-02T00:00:00.000Z'),
        { ...row('be', '2026-07-02T00:01:00.000Z'), localization: 'fr' },
        { ...row('be', '2026-07-02T00:02:00.000Z'), localization: 'nl' },
        row('de', '2026-07-03T00:00:00.000Z'),
      ]),
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

  it('lists the other markets by code with the time of their newest listing', () => {
    expect(
      toListingMarkets('us', [
        row('pl', '2026-07-03T00:00:00.000Z'),
        row(null, '2026-07-01T00:00:00.000Z'),
        row('de', '2026-07-02T00:00:00.000Z'),
      ]),
    ).toEqual([
      { country: 'us', home: true, capturedAt: '2026-07-01T00:00:00.000Z' },
      { country: 'de', home: false, capturedAt: '2026-07-02T00:00:00.000Z' },
      { country: 'pl', home: false, capturedAt: '2026-07-03T00:00:00.000Z' },
    ]);
  });
});

describe('toSnapshotSummary', () => {
  const snapshot = (country: string | null) =>
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
      capturedAt: new Date('2026-07-01T00:00:00.000Z'),
    }) as AppSnapshot;

  it('names the home storefront for a home snapshot', () => {
    expect(toSnapshotSummary(snapshot(null), 'us').country).toBe('us');
  });

  it('names the market of a market snapshot', () => {
    expect(toSnapshotSummary(snapshot('de'), 'us').country).toBe('de');
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
