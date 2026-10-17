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

type Column = (typeof DISCOVERY_REQUIRED_COLUMNS)[number];

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

function columnsOf(header: string): Map<Column, number> {
  const names = header
    .replace(/^\uFEFF/, '')
    .split('\t')
    .map((name) => name.trim());
  const missing = DISCOVERY_REQUIRED_COLUMNS.filter(
    (column) => !names.includes(column),
  );
  if (missing.length > 0) throw new DiscoveryHeaderError(missing);
  return new Map(
    DISCOVERY_REQUIRED_COLUMNS.map((column) => [column, names.indexOf(column)]),
  );
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

export async function pivotDiscoveryReport(
  gzip: Buffer,
  processingDate: string,
): Promise<FunnelRow[]> {
  if (gzip.length === 0) return [];
  const rows = new Map<string, FunnelRow>();
  let columns: Map<Column, number> | null = null;
  for await (const raw of linesOf(gzip)) {
    const line = raw.replace(/\r$/, '');
    if (line.trim().length === 0) continue;
    if (!columns) {
      columns = columnsOf(line);
      continue;
    }
    const cells = line.split('\t');
    const cell = (column: Column): string => cells[columns!.get(column)!] ?? '';
    const counter = counterOf(cell('Event'), cell('Engagement Type'));
    const date = dateOf(cell('Date'));
    const counts = countOf(cell('Counts'));
    const uniques = countOf(cell('Unique Counts'));
    if (!counter || !date || counts === null || uniques === null) continue;
    const key: FunnelKey = {
      date,
      territory: cell('Territory').trim(),
      sourceType: sourceTypeOf(cell('Source Type')),
      pageType: pageTypeOf(cell('Page Type')),
    };
    const id = `${key.date}|${key.territory}|${key.sourceType}|${key.pageType}`;
    const row = rows.get(id) ?? { ...key, ...emptyCounters(), processingDate };
    row[counter[0]] += counts;
    row[counter[1]] += uniques;
    rows.set(id, row);
  }
  return [...rows.values()];
}
