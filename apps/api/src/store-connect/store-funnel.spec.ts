import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { pivotDetailedReport } from './discovery-report';
import {
  completeThrough,
  funnelPages,
  funnelScope,
  measureStoreFunnel,
  type FunnelDayRow,
  type PageDayRow,
} from './store-funnel';

const TODAY = new Date('2026-10-16T12:00:00.000Z');

const row = (
  date: string,
  overrides: Partial<FunnelDayRow> = {},
): FunnelDayRow => ({
  date,
  country: 'us',
  sourceType: 'search',
  pageType: 'productPage',
  impressions: 0,
  uniqueImpressions: 0,
  pageViews: 0,
  uniquePageViews: 0,
  gets: 0,
  uniqueGets: 0,
  ...overrides,
});

const daysBack = (days: number): string =>
  new Date(Date.UTC(2026, 9, 16 - days)).toISOString().slice(0, 10);

const everyDay = (
  count: number,
  overrides: Partial<FunnelDayRow> = {},
): FunnelDayRow[] =>
  Array.from({ length: count }, (_, index) => row(daysBack(index), overrides));

describe('completeThrough', () => {
  it('is three days before today', () => {
    expect(completeThrough(TODAY)).toBe('2026-10-13');
  });
});

describe('funnelScope', () => {
  it('reads country rows for a market and traffic rows for all markets on google play', () => {
    expect(funnelScope('GOOGLE_PLAY', 'de')).toEqual({ country: 'de' });
    expect(funnelScope('GOOGLE_PLAY')).toEqual({ territory: 'all' });
  });

  it('reads every row of the app store for all markets', () => {
    expect(funnelScope('APP_STORE')).toEqual({});
    expect(funnelScope('APP_STORE', 'us')).toEqual({ country: 'us' });
  });
});

describe('measureStoreFunnel points', () => {
  it('sums every page type into impressions and gets, and product pages into page views', () => {
    const { points } = measureStoreFunnel({
      rows: [
        row('2026-10-10', {
          pageType: 'noPage',
          impressions: 100,
          uniqueImpressions: 80,
          gets: 2,
        }),
        row('2026-10-10', {
          pageType: 'productPage',
          impressions: 10,
          uniqueImpressions: 10,
          pageViews: 30,
          gets: 8,
        }),
        row('2026-10-10', { pageType: 'storeSheet', pageViews: 50, gets: 5 }),
      ],
      days: 10,
      today: TODAY,
      store: 'APP_STORE',
      firstDate: '2026-10-10',
    });
    const point = points.find((each) => each.date === '2026-10-10');

    expect(point?.total).toEqual({
      impressions: 110,
      uniqueImpressions: 90,
      pageViews: 30,
      gets: 15,
      conversion: 0.1667,
    });
  });

  it('splits the search series from the total by source type', () => {
    const { points } = measureStoreFunnel({
      rows: [
        row('2026-10-10', {
          sourceType: 'search',
          impressions: 60,
          uniqueImpressions: 60,
          gets: 6,
        }),
        row('2026-10-10', {
          sourceType: 'browse',
          impressions: 40,
          uniqueImpressions: 40,
          gets: 4,
        }),
      ],
      days: 10,
      today: TODAY,
      store: 'APP_STORE',
      firstDate: '2026-10-10',
    });
    const point = points.find((each) => each.date === '2026-10-10');

    expect(point?.total.impressions).toBe(100);
    expect(point?.search).toMatchObject({
      impressions: 60,
      gets: 6,
      conversion: 0.1,
    });
  });

  it('answers a point for every day of the range, zero filled, oldest first', () => {
    const { points } = measureStoreFunnel({
      rows: [row(daysBack(1), { gets: 1 }), row(daysBack(3), { gets: 2 })],
      days: 5,
      today: TODAY,
      store: 'APP_STORE',
      firstDate: daysBack(3),
    });

    expect(points.map((point) => point.date)).toEqual([
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
      '2026-10-16',
    ]);
    expect(points.map((point) => point.total.gets)).toEqual([0, 2, 0, 1, 0]);
  });

  it('marks the last three days incomplete', () => {
    const { points, completeThrough: through } = measureStoreFunnel({
      rows: [],
      days: 5,
      today: TODAY,
      store: 'APP_STORE',
      firstDate: null,
    });

    expect(through).toBe('2026-10-13');
    expect(points.map((point) => point.complete)).toEqual([
      true,
      true,
      false,
      false,
      false,
    ]);
  });

  it('answers a null conversion without unique impressions', () => {
    const { points } = measureStoreFunnel({
      rows: [row(daysBack(4), { gets: 3 })],
      days: 5,
      today: TODAY,
      store: 'APP_STORE',
      firstDate: daysBack(4),
    });

    expect(points[0].total.conversion).toBeNull();
  });

  it('answers null impressions and a visitor based conversion for google play', () => {
    const { points } = measureStoreFunnel({
      rows: [row(daysBack(4), { sourceType: 'all', pageViews: 200, gets: 50 })],
      days: 5,
      today: TODAY,
      store: 'GOOGLE_PLAY',
      firstDate: daysBack(4),
    });

    expect(points[0].total).toEqual({
      impressions: null,
      uniqueImpressions: null,
      pageViews: 200,
      gets: 50,
      conversion: 0.25,
    });
  });
});

describe('measureStoreFunnel windows', () => {
  const rows = [
    ...everyDay(70, {
      impressions: 100,
      uniqueImpressions: 100,
      pageViews: 20,
      gets: 5,
    }),
  ].map((each) =>
    each.date > daysBack(10)
      ? { ...each, impressions: 120, uniqueImpressions: 120, gets: 6 }
      : each,
  );

  it('measures a window over complete days and compares it with the period before', () => {
    const { windows } = measureStoreFunnel({
      rows,
      days: 90,
      today: TODAY,
      store: 'APP_STORE',
      firstDate: daysBack(69),
    });
    const week = windows.find((window) => window.days === 7);

    expect(week).toEqual({
      days: 7,
      status: 'measured',
      from: '2026-10-07',
      to: '2026-10-13',
      current: {
        impressions: 840,
        uniqueImpressions: 840,
        pageViews: 140,
        gets: 42,
        conversion: 0.05,
      },
      previous: {
        impressions: 700,
        uniqueImpressions: 700,
        pageViews: 140,
        gets: 35,
        conversion: 0.05,
      },
      change: {
        impressions: 0.2,
        pageViews: 0,
        gets: 0.2,
        conversion: 0,
      },
    });
    expect(windows.map((window) => window.days)).toEqual([7, 14, 28]);
    expect(windows.every((window) => window.status === 'measured')).toBe(true);
  });

  it('never counts a day the store has not delivered as complete', () => {
    const delivered = rows.filter((row) => row.date <= daysBack(10));
    const {
      completeThrough: through,
      points,
      windows,
    } = measureStoreFunnel({
      rows: delivered,
      days: 90,
      today: TODAY,
      store: 'APP_STORE',
      firstDate: daysBack(69),
      lastDate: daysBack(10),
    });
    const week = windows.find((window) => window.days === 7);

    expect(through).toBe(daysBack(10));
    expect(week).toMatchObject({ to: daysBack(10), status: 'measured' });
    expect(week?.current?.gets).toBe(35);
    expect(points.find((point) => point.date === daysBack(5))?.complete).toBe(
      false,
    );
  });

  it('keeps a window pending while its current period has a complete day but not all of them', () => {
    const { windows } = measureStoreFunnel({
      rows: everyDay(5, { gets: 1 }),
      days: 90,
      today: TODAY,
      store: 'APP_STORE',
      firstDate: daysBack(4),
    });
    const week = windows.find((window) => window.days === 7);

    expect(week).toMatchObject({
      status: 'pending',
      previous: null,
      change: null,
    });
    expect(week?.current?.gets).toBe(2);
  });

  it('keeps a window pending while the period before is only partly covered', () => {
    const { windows } = measureStoreFunnel({
      rows: everyDay(12, { gets: 1 }),
      days: 90,
      today: TODAY,
      store: 'APP_STORE',
      firstDate: daysBack(11),
    });

    expect(windows.find((window) => window.days === 7)?.status).toBe('pending');
  });

  it('leaves a window unmeasured without a complete day', () => {
    const { windows } = measureStoreFunnel({
      rows: everyDay(2, { gets: 1 }),
      days: 90,
      today: TODAY,
      store: 'APP_STORE',
      firstDate: daysBack(1),
    });

    expect(windows.map((window) => window.status)).toEqual([
      'unmeasured',
      'unmeasured',
      'unmeasured',
    ]);
    expect(windows[0]).toMatchObject({
      current: null,
      previous: null,
      change: null,
    });
  });

  it('leaves every window unmeasured without any row', () => {
    const { windows } = measureStoreFunnel({
      rows: [],
      days: 90,
      today: TODAY,
      store: 'APP_STORE',
      firstDate: null,
    });

    expect(windows.every((window) => window.status === 'unmeasured')).toBe(
      true,
    );
  });

  it('reads windows from rows older than the requested series', () => {
    const { points, windows } = measureStoreFunnel({
      rows,
      days: 7,
      today: TODAY,
      store: 'APP_STORE',
      firstDate: daysBack(69),
    });

    expect(points).toHaveLength(7);
    expect(windows.find((window) => window.days === 28)?.status).toBe(
      'measured',
    );
  });
});

describe('funnelPages', () => {
  const DETAILED = gzipSync(
    readFileSync(join(__dirname, 'fixtures', 'asc', 'discovery-detailed.tsv')),
  );

  const page = (
    pageTitle: string,
    pageViews: number,
    gets: number,
  ): PageDayRow => ({
    date: '2026-10-10',
    pageTitle,
    impressions: 0,
    uniqueImpressions: 0,
    pageViews,
    uniquePageViews: pageViews,
    gets,
    uniqueGets: gets,
  });

  it('measures each page of the real detailed report by its Get taps over its product page views, since Apple counts no impression against a page', async () => {
    const rows = await pivotDetailedReport(DETAILED, '2026-09-12');

    const pages = funnelPages(rows);

    expect(pages).toEqual([
      {
        title: 'Default product page',
        counts: {
          impressions: null,
          uniqueImpressions: null,
          pageViews: 312,
          gets: 40,
          conversion: 0.1282,
        },
        defaultConversion: 0.1282,
        ratio: 1,
      },
      {
        title: 'Summer sale',
        counts: {
          impressions: null,
          uniqueImpressions: null,
          pageViews: 100,
          gets: 7,
          conversion: 0.07,
        },
        defaultConversion: 0.1282,
        ratio: 0.546,
      },
    ]);
  });

  it('puts the default page first, then pages by product page views, with the ratio to the default', () => {
    const pages = funnelPages([
      page('Summer sale', 200, 4),
      page('default product page', 1000, 40),
      page('Winter deal', 500, 30),
      page('Summer sale', 100, 2),
    ]);

    expect(pages.map((each) => each.title)).toEqual([
      'default product page',
      'Winter deal',
      'Summer sale',
    ]);
    expect(pages[0]).toMatchObject({ defaultConversion: 0.04, ratio: 1 });
    expect(pages[1]).toMatchObject({ ratio: 1.5 });
    expect(pages[2]).toMatchObject({
      counts: { pageViews: 300, gets: 6, conversion: 0.02 },
      ratio: 0.5,
    });
  });

  it('answers a null ratio without a default page conversion', () => {
    const pages = funnelPages([page('Summer sale', 200, 4)]);

    expect(pages[0]).toMatchObject({ defaultConversion: null, ratio: null });
  });

  it('answers no pages without rows', () => {
    expect(funnelPages([])).toEqual([]);
  });
});
