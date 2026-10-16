import { Readable } from 'node:stream';
import { StringDecoder } from 'node:string_decoder';
import { createGunzip } from 'node:zlib';
import type { StoreFunnelPageType, StoreFunnelSource } from '@asobeast/shared';

export const DISCOVERY_REQUIRED_COLUMNS = [
  'Date',
  'App Apple Identifier',
  'Event',
  'Page Type',
  'Source Type',
  'Engagement Type',
  'Territory',
  'Counts',
  'Unique Counts',
] as const;

const PAGE_TITLE_COLUMN = 'Page Title';
const NO_PAGE_TITLE = 'no page';

export const DETAILED_REQUIRED_COLUMNS = [
  ...DISCOVERY_REQUIRED_COLUMNS,
  PAGE_TITLE_COLUMN,
] as const;

export interface FunnelKey {
  date: string;
  territory: string;
  sourceType: StoreFunnelSource;
  pageType: StoreFunnelPageType;
}

export interface FunnelCounters {
  impressions: number;
  uniqueImpressions: number;
  pageViews: number;
  uniquePageViews: number;
  gets: number;
  uniqueGets: number;
}

export type FunnelRow = FunnelKey & FunnelCounters & { processingDate: string };

export interface PageFunnelKey {
  date: string;
  territory: string;
  pageTitle: string;
}

export type PageFunnelRow = PageFunnelKey &
  FunnelCounters & { processingDate: string };

export class DiscoveryHeaderError extends Error {
  constructor(missing: string[]) {
    super(
      `The discovery report header lacks the column${missing.length > 1 ? 's' : ''} ${missing.join(', ')}`,
    );
    this.name = 'DiscoveryHeaderError';
  }
}

const SOURCE_TYPES: Record<string, StoreFunnelSource> = {
  'app store search': 'search',
  'app store browse': 'browse',
  'app referrer': 'referrer',
  'web referrer': 'referrer',
};

const PAGE_TYPES: Record<string, StoreFunnelPageType> = {
  'product page': 'productPage',
  'no page': 'noPage',
  'in-app event': 'inAppEvent',
  'store sheet': 'storeSheet',
};

const COUNTERS: Record<string, [keyof FunnelCounters, keyof FunnelCounters]> = {
  impression: ['impressions', 'uniqueImpressions'],
  'page view': ['pageViews', 'uniquePageViews'],
  'tap|get': ['gets', 'uniqueGets'],
};

const normalized = (value: string): string => value.trim().toLowerCase();

export const sourceTypeOf = (raw: string): StoreFunnelSource =>
  SOURCE_TYPES[normalized(raw)] ?? 'other';

export const pageTypeOf = (raw: string): StoreFunnelPageType =>
  PAGE_TYPES[normalized(raw)] ?? 'other';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_FIRST_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

function dateOf(raw: string): string | null {
  const value = raw.trim();
  if (ISO_DATE.test(value)) return value;
  const monthFirst = MONTH_FIRST_DATE.exec(value);
  if (!monthFirst) return null;
  const [, month, day, year] = monthFirst;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function countOf(raw: string): number | null {
  const value = raw.trim();
  if (value.length === 0) return 0;
  const count = Number(value);
  return Number.isFinite(count) ? count : null;
}

const emptyCounters = (): FunnelCounters => ({
  impressions: 0,
  uniqueImpressions: 0,
  pageViews: 0,
  uniquePageViews: 0,
  gets: 0,
  uniqueGets: 0,
});

export const MAX_LINE_CHARS = 1_000_000;

export class DiscoveryLineError extends Error {
  constructor() {
    super(
      `The discovery report holds a line longer than ${MAX_LINE_CHARS} characters`,
    );
    this.name = 'DiscoveryLineError';
  }
}

async function* linesOf(gzip: Buffer): AsyncGenerator<string> {
  const decoder = new StringDecoder('utf8');
  let rest = '';
  for await (const chunk of Readable.from([gzip]).pipe(createGunzip())) {
    const lines = (rest + decoder.write(chunk as Buffer)).split('\n');
    rest = lines.pop() ?? '';
    if (rest.length > MAX_LINE_CHARS) throw new DiscoveryLineError();
    yield* lines;
  }
  rest += decoder.end();
  if (rest.length > 0) yield rest;
}

function columnsOf(
  header: string,
  required: readonly string[],
): Map<string, number> {
  const names = header
    .replace(/^\uFEFF/, '')
    .split('\t')
    .map((name) => name.trim());
  const missing = required.filter((column) => !names.includes(column));
  if (missing.length > 0) throw new DiscoveryHeaderError(missing);
  return new Map(required.map((column) => [column, names.indexOf(column)]));
}

function counterOf(
  event: string,
  engagement: string,
): [keyof FunnelCounters, keyof FunnelCounters] | undefined {
  const name = normalized(event);
  return name === 'tap'
    ? COUNTERS[`tap|${normalized(engagement)}`]
    : COUNTERS[name];
}

type Cell = (column: string) => string;

async function pivot<K extends { date: string }>(
  gzip: Buffer,
  processingDate: string,
  required: readonly string[],
  keyOf: (cell: Cell, date: string) => K | null,
): Promise<(K & FunnelCounters & { processingDate: string })[]> {
  if (gzip.length === 0) return [];
  const rows = new Map<
    string,
    K & FunnelCounters & { processingDate: string }
  >();
  let columns: Map<string, number> | null = null;
  for await (const raw of linesOf(gzip)) {
    const line = raw.replace(/\r$/, '');
    if (line.trim().length === 0) continue;
    if (!columns) {
      columns = columnsOf(line, required);
      continue;
    }
    const cells = line.split('\t');
    const index = columns;
    const cell: Cell = (column) => cells[index.get(column) ?? -1] ?? '';
    const counter = counterOf(cell('Event'), cell('Engagement Type'));
    const date = dateOf(cell('Date'));
    const counts = countOf(cell('Counts'));
    const uniques = countOf(cell('Unique Counts'));
    if (!counter || !date || counts === null || uniques === null) continue;
    const key = keyOf(cell, date);
    if (!key) continue;
    const id = Object.values(key).join('|');
    const row = rows.get(id) ?? { ...key, ...emptyCounters(), processingDate };
    row[counter[0]] += counts;
    row[counter[1]] += uniques;
    rows.set(id, row);
  }
  return [...rows.values()];
}

export function pivotDiscoveryReport(
  gzip: Buffer,
  processingDate: string,
): Promise<FunnelRow[]> {
  return pivot(
    gzip,
    processingDate,
    DISCOVERY_REQUIRED_COLUMNS,
    (cell, date) => ({
      date,
      territory: cell('Territory').trim(),
      sourceType: sourceTypeOf(cell('Source Type')),
      pageType: pageTypeOf(cell('Page Type')),
    }),
  );
}

export function pivotDetailedReport(
  gzip: Buffer,
  processingDate: string,
): Promise<PageFunnelRow[]> {
  return pivot(
    gzip,
    processingDate,
    DETAILED_REQUIRED_COLUMNS,
    (cell, date) => {
      const pageTitle = cell(PAGE_TITLE_COLUMN).trim();
      if (!pageTitle || normalized(pageTitle) === NO_PAGE_TITLE) return null;
      return { date, territory: cell('Territory').trim(), pageTitle };
    },
  );
}
