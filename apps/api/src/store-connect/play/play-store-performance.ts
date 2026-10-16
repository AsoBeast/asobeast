import { normalizeText, type StoreFunnelSource } from '@asobeast/shared';
import type { FunnelRow } from '../discovery-report';
import { countOf, dateOf } from '../report-cells';

export const PLAY_ALL = 'all';
const OTHER_TERM = 'other';

const COUNTRY_COLUMNS = [
  'Date',
  'Country',
  'Store listing acquisitions',
  'Store listing visitors',
] as const;

const TRAFFIC_COLUMNS = [
  'Date',
  'Traffic source',
  'Store listing acquisitions',
  'Store listing visitors',
] as const;

const SEARCH_TERM_COLUMN = 'Search term';

export const PLAY_TRAFFIC_SOURCES: Record<string, StoreFunnelSource> = {
  'google play search': 'search',
  'google play explore': 'browse',
  'third-party referrers': 'referrer',
  'third party referrers': 'referrer',
};

export interface SearchTermRow {
  month: string;
  term: string;
  normalized: string;
  visitors: number;
  acquisitions: number;
}

export class PlayHeaderError extends Error {
  constructor(missing: string[]) {
    super(`The store performance file lacks the columns ${missing.join(', ')}`);
    this.name = 'PlayHeaderError';
  }
}

function swapBytes(bytes: Buffer): Buffer {
  const swapped = Buffer.from(bytes);
  swapped.swap16();
  return swapped;
}

export function decodeCsv(bytes: Buffer): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return bytes.subarray(2).toString('utf16le');
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    const body = bytes.subarray(2);
    return swapBytes(
      body.subarray(0, body.length - (body.length % 2)),
    ).toString('utf16le');
  }
  const text = bytes.toString('utf8');
  return text.startsWith('\uFEFF') ? text.slice(1) : text;
}

function delimiterOf(text: string): string {
  const header = text.slice(0, text.search(/\r?\n|$/));
  return header.includes('\t') && !header.includes(',') ? '\t' : ',';
}

export function parseCsv(text: string): string[][] {
  const delimiter = delimiterOf(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((value) => value.trim().length > 0));
}

type Cell = (cells: string[], column: string) => string;

function reader(header: string[], required: readonly string[]): Cell {
  const names = header.map((name) => name.trim());
  const missing = required.filter((column) => !names.includes(column));
  if (missing.length > 0) throw new PlayHeaderError(missing);
  return (cells, column) => cells[names.indexOf(column)] ?? '';
}

interface PlayCounts {
  date: string;
  visitors: number;
  acquisitions: number;
}

function countsOf(cells: string[], cell: Cell): PlayCounts | null {
  const date = dateOf(cell(cells, 'Date'));
  const visitors = countOf(cell(cells, 'Store listing visitors'));
  const acquisitions = countOf(cell(cells, 'Store listing acquisitions'));
  if (!date || visitors === null || acquisitions === null) return null;
  return { date, visitors, acquisitions };
}

function rowOf(
  key: {
    date: string;
    territory: string;
    country: string | null;
    sourceType: StoreFunnelSource;
  },
  counts: PlayCounts,
  processingDate: string,
): FunnelRow {
  return {
    ...key,
    pageType: 'productPage',
    impressions: 0,
    uniqueImpressions: 0,
    pageViews: counts.visitors,
    uniquePageViews: counts.visitors,
    gets: counts.acquisitions,
    uniqueGets: counts.acquisitions,
    processingDate,
  };
}

function summed(rows: FunnelRow[]): FunnelRow[] {
  const byKey = new Map<string, FunnelRow>();
  for (const row of rows) {
    const id = `${row.date}|${row.territory}|${row.sourceType}`;
    const existing = byKey.get(id);
    if (!existing) {
      byKey.set(id, { ...row });
      continue;
    }
    existing.pageViews += row.pageViews;
    existing.uniquePageViews += row.uniquePageViews;
    existing.gets += row.gets;
    existing.uniqueGets += row.uniqueGets;
  }
  return [...byKey.values()];
}

export function pivotCountryFile(
  rows: string[][],
  processingDate: string,
): FunnelRow[] {
  const [header, ...lines] = rows;
  if (!header) return [];
  const cell = reader(header, COUNTRY_COLUMNS);
  return summed(
    lines.flatMap((cells) => {
      const counts = countsOf(cells, cell);
      const code = cell(cells, 'Country').trim().toLowerCase();
      if (!counts || !/^[a-z]{2}$/.test(code)) return [];
      return [
        rowOf(
          {
            date: counts.date,
            territory: code,
            country: code,
            sourceType: 'all',
          },
          counts,
          processingDate,
        ),
      ];
    }),
  );
}

export const playSourceOf = (raw: string): StoreFunnelSource =>
  PLAY_TRAFFIC_SOURCES[raw.trim().toLowerCase()] ?? 'other';

export function pivotTrafficFile(
  rows: string[][],
  processingDate: string,
): FunnelRow[] {
  const [header, ...lines] = rows;
  if (!header) return [];
  const cell = reader(header, TRAFFIC_COLUMNS);
  return summed(
    lines.flatMap((cells) => {
      const counts = countsOf(cells, cell);
      if (!counts) return [];
      return [
        rowOf(
          {
            date: counts.date,
            territory: PLAY_ALL,
            country: null,
            sourceType: playSourceOf(cell(cells, 'Traffic source')),
          },
          counts,
          processingDate,
        ),
      ];
    }),
  );
}

export function searchTermsOf(rows: string[][]): SearchTermRow[] {
  const [header, ...lines] = rows;
  if (!header) return [];
  const cell = reader(header, TRAFFIC_COLUMNS);
  const byTerm = new Map<string, SearchTermRow>();
  for (const cells of lines) {
    const term = cell(cells, SEARCH_TERM_COLUMN).trim();
    const counts = countsOf(cells, cell);
    if (!counts || !term || term.toLowerCase() === OTHER_TERM) continue;
    const month = `${counts.date.slice(0, 7)}-01`;
    const id = `${month}|${term}`;
    const existing = byTerm.get(id);
    if (existing) {
      existing.visitors += counts.visitors;
      existing.acquisitions += counts.acquisitions;
    } else {
      byTerm.set(id, {
        month,
        term,
        normalized: normalizeText(term),
        visitors: counts.visitors,
        acquisitions: counts.acquisitions,
      });
    }
  }
  return [...byTerm.values()];
}
