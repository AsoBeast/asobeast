import type { FunnelDayRow } from '../store-connect/store-funnel';
import { measureChangeFunnel } from './change-impact-funnel';

const row = (
  date: string,
  gets: number,
  uniqueImpressions = 100,
): FunnelDayRow => ({
  date,
  country: 'us',
  sourceType: 'search',
  pageType: 'productPage',
  impressions: uniqueImpressions,
  uniqueImpressions,
  pageViews: 20,
  uniquePageViews: 20,
  gets,
  uniqueGets: gets,
});

const day = (offset: number): string =>
  new Date(Date.UTC(2026, 8, 1 + offset)).toISOString().slice(0, 10);

const rows = Array.from({ length: 40 }, (_, index) =>
  row(day(index), index < 20 ? 4 : 6),
);

const base = {
  rows,
  changedOn: day(20),
  days: 7 as const,
  completeThrough: day(39),
  firstDate: day(0),
  store: 'APP_STORE' as const,
};

describe('measureChangeFunnel', () => {
  it('sums the days before the change into before and the days from the change on into after', () => {
    const funnel = measureChangeFunnel(base);

    expect(funnel).toEqual({
      status: 'measured',
      completeDays: 7,
      before: {
        impressions: 700,
        uniqueImpressions: 700,
        pageViews: 140,
        gets: 28,
        conversion: 0.04,
      },
      after: {
        impressions: 700,
        uniqueImpressions: 700,
        pageViews: 140,
        gets: 42,
        conversion: 0.06,
      },
      change: { impressions: 0, pageViews: 0, gets: 0.5, conversion: 0.5 },
    });
  });

  it('excludes the change day from before and includes it in after', () => {
    const funnel = measureChangeFunnel({
      ...base,
      rows: [row(day(19), 1), row(day(20), 100)],
      firstDate: day(0),
    });

    expect(funnel?.before?.gets).toBe(1);
    expect(funnel?.after?.gets).toBe(100);
  });

  it('is pending while the days after the change are not all complete', () => {
    const funnel = measureChangeFunnel({
      ...base,
      changedOn: day(36),
      completeThrough: day(36),
    });

    expect(funnel).toMatchObject({
      status: 'pending',
      completeDays: 1,
      change: null,
    });
    expect(funnel?.after?.gets).toBe(6);
    expect(funnel?.before?.gets).toBe(42);
  });

  it('is pending with nothing after while no day after the change is complete', () => {
    const funnel = measureChangeFunnel({
      ...base,
      changedOn: day(38),
      completeThrough: day(36),
    });

    expect(funnel).toMatchObject({
      status: 'pending',
      completeDays: 0,
      after: null,
      change: null,
    });
  });

  it('is unmeasured while the days before the change are not all covered', () => {
    const funnel = measureChangeFunnel({ ...base, firstDate: day(15) });

    expect(funnel).toEqual({
      status: 'unmeasured',
      completeDays: 0,
      before: null,
      after: null,
      change: null,
    });
  });

  it('is unmeasured without rows', () => {
    expect(
      measureChangeFunnel({ ...base, rows: [], firstDate: null })?.status,
    ).toBe('unmeasured');
  });

  it('measures google play on visitors, without impressions', () => {
    const funnel = measureChangeFunnel({ ...base, store: 'GOOGLE_PLAY' });

    expect(funnel?.after).toMatchObject({ impressions: null, conversion: 0.3 });
    expect(funnel?.change?.impressions).toBeNull();
  });
});
