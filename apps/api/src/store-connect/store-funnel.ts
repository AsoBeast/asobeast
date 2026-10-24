import {
  STORE_FUNNEL_COMPLETE_AFTER_DAYS,
  STORE_FUNNEL_WINDOWS,
  funnelChange,
  funnelConversion,
  type ChangeImpactStatus,
  type Store,
  type StoreFunnelChange,
  type StoreFunnelCounts,
  type StoreFunnelPoint,
  type StoreFunnelReport,
  type StoreFunnelWindow,
  type StoreFunnelWindowDays,
} from '@asobeast/shared';
import {
  addDays,
  startOfUtcDay,
  toDateKey,
} from '../analytics/analytics.support';

export interface FunnelDayRow {
  date: string;
  country: string | null;
  sourceType: string;
  pageType: string;
  impressions: number;
  uniqueImpressions: number;
  pageViews: number;
  uniquePageViews: number;
  gets: number;
  uniqueGets: number;
}

export interface StoreFunnelInput {
  rows: FunnelDayRow[];
  days: number;
  today: Date;
  store: Store;
  firstDate: string | null;
  lastDate?: string | null;
}

export type StoreFunnelMeasurement = Pick<
  StoreFunnelReport,
  'completeThrough' | 'points' | 'windows'
>;

const LONGEST_WINDOW = Math.max(...STORE_FUNNEL_WINDOWS);

export const FUNNEL_LOOKBACK_DAYS =
  2 * LONGEST_WINDOW + STORE_FUNNEL_COMPLETE_AFTER_DAYS;

const shift = (date: string, days: number): string =>
  toDateKey(addDays(new Date(`${date}T00:00:00.000Z`), days));

export const completeThrough = (today: Date): string =>
  toDateKey(addDays(startOfUtcDay(today), -STORE_FUNNEL_COMPLETE_AFTER_DAYS));

export function reportedThrough(
  today: Date,
  lastDate: string | null | undefined,
): string {
  const through = completeThrough(today);
  return lastDate && lastDate < through ? lastDate : through;
}

export function countsOf(
  rows: FunnelDayRow[],
  store: Store,
): StoreFunnelCounts {
  const sum = (pick: (row: FunnelDayRow) => number): number =>
    rows.reduce((total, row) => total + pick(row), 0);
  const pageViews = sum((row) =>
    row.pageType === 'productPage' ? row.pageViews : 0,
  );
  const gets = sum((row) => row.gets);
  if (store === 'GOOGLE_PLAY') {
    return {
      impressions: null,
      uniqueImpressions: null,
      pageViews,
      gets,
      conversion: funnelConversion(gets, pageViews),
    };
  }
  const uniqueImpressions = sum((row) => row.uniqueImpressions);
  return {
    impressions: sum((row) => row.impressions),
    uniqueImpressions,
    pageViews,
    gets,
    conversion: funnelConversion(gets, uniqueImpressions),
  };
}

export function countsChange(
  current: StoreFunnelCounts,
  previous: StoreFunnelCounts,
): StoreFunnelChange {
  return {
    impressions: funnelChange(current.impressions, previous.impressions),
    pageViews: funnelChange(current.pageViews, previous.pageViews),
    gets: funnelChange(current.gets, previous.gets),
    conversion: funnelChange(current.conversion, previous.conversion),
  };
}

const between = (rows: FunnelDayRow[], from: string, to: string) =>
  rows.filter((row) => row.date >= from && row.date <= to);

function funnelPoints(
  { rows, days, today, store }: StoreFunnelInput,
  through: string,
): StoreFunnelPoint[] {
  const last = toDateKey(startOfUtcDay(today));
  const byDate = new Map<string, FunnelDayRow[]>();
  for (const row of rows) {
    const day = byDate.get(row.date);
    if (day) day.push(row);
    else byDate.set(row.date, [row]);
  }
  return Array.from({ length: days }, (_, index) => {
    const date = shift(last, index - days + 1);
    const day = byDate.get(date) ?? [];
    return {
      date,
      complete: date <= through,
      total: countsOf(day, store),
      search: countsOf(
        day.filter((row) => row.sourceType === 'search'),
        store,
      ),
    };
  });
}

function windowStatus(
  firstDate: string | null,
  from: string,
  to: string,
  previousFrom: string,
): ChangeImpactStatus {
  if (firstDate === null || firstDate > to) return 'unmeasured';
  return firstDate <= previousFrom ? 'measured' : 'pending';
}

function funnelWindow(
  { rows, store, firstDate }: StoreFunnelInput,
  days: StoreFunnelWindowDays,
  to: string,
): StoreFunnelWindow {
  const from = shift(to, 1 - days);
  const previousTo = shift(from, -1);
  const previousFrom = shift(from, -days);
  const status = windowStatus(firstDate, from, to, previousFrom);
  const current =
    status === 'unmeasured' ? null : countsOf(between(rows, from, to), store);
  const previous =
    status === 'measured'
      ? countsOf(between(rows, previousFrom, previousTo), store)
      : null;
  return {
    days,
    status,
    from,
    to,
    current,
    previous,
    change: current && previous ? countsChange(current, previous) : null,
  };
}

export function measureStoreFunnel(
  input: StoreFunnelInput,
): StoreFunnelMeasurement {
  const through = reportedThrough(input.today, input.lastDate);
  return {
    completeThrough: through,
    points: funnelPoints(input, through),
    windows: STORE_FUNNEL_WINDOWS.map((days) =>
      funnelWindow(input, days, through),
    ),
  };
}
