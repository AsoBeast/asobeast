import { Prisma } from '@prisma/client';
import type {
  FunnelCounters,
  FunnelRow,
  PageFunnelRow,
} from './discovery-report';
import { countryOfTerritory } from './territory-codes';

export const FUNNEL_UPSERT_BATCH = 500;

type CounterRow = FunnelCounters & {
  date: string;
  territory: string;
  country?: string | null;
  processingDate: string;
};

const countryOf = (row: CounterRow): string | null =>
  row.country === undefined ? countryOfTerritory(row.territory) : row.country;

interface UpsertTarget<R extends CounterRow> {
  table: 'StoreFunnelDay' | 'StoreFunnelPageDay';
  keyColumns: readonly string[];
  keyValues: (row: R) => Prisma.Sql[];
}

const COUNTER_COLUMNS = [
  'impressions',
  'uniqueImpressions',
  'pageViews',
  'uniquePageViews',
  'gets',
  'uniqueGets',
] as const;

const dateValue = (key: string): Date => new Date(`${key}T00:00:00.000Z`);

const quoted = (columns: readonly string[]): Prisma.Sql =>
  Prisma.raw(columns.map((column) => `"${column}"`).join(', '));

function upserts<R extends CounterRow>(
  target: UpsertTarget<R>,
  workspaceId: string,
  appId: string,
  rows: R[],
): Prisma.Sql[] {
  const table = Prisma.raw(`"${target.table}"`);
  const columns = [
    'id',
    'workspaceId',
    'appId',
    'date',
    'territory',
    'country',
    ...target.keyColumns,
    ...COUNTER_COLUMNS,
    'processingDate',
  ];
  const updates = Prisma.raw(
    ['country', ...COUNTER_COLUMNS, 'processingDate']
      .map((column) => `"${column}" = EXCLUDED."${column}"`)
      .join(', '),
  );
  const conflict = quoted(['appId', 'date', 'territory', ...target.keyColumns]);
  const batches: Prisma.Sql[] = [];
  for (let start = 0; start < rows.length; start += FUNNEL_UPSERT_BATCH) {
    const values = rows
      .slice(start, start + FUNNEL_UPSERT_BATCH)
      .map(
        (row) =>
          Prisma.sql`(${Prisma.join([
            Prisma.sql`gen_random_uuid()::text`,
            Prisma.sql`${workspaceId}`,
            Prisma.sql`${appId}`,
            Prisma.sql`${dateValue(row.date)}::date`,
            Prisma.sql`${row.territory}`,
            Prisma.sql`${countryOf(row)}`,
            ...target.keyValues(row),
            ...COUNTER_COLUMNS.map((column) => Prisma.sql`${row[column]}`),
            Prisma.sql`${dateValue(row.processingDate)}::date`,
          ])})`,
      );
    batches.push(Prisma.sql`
      INSERT INTO ${table} (${quoted(columns)})
      VALUES ${Prisma.join(values)}
      ON CONFLICT (${conflict}) DO UPDATE SET ${updates}
      WHERE ${table}."processingDate" <= EXCLUDED."processingDate"`);
  }
  return batches;
}

const FUNNEL_DAY: UpsertTarget<FunnelRow> = {
  table: 'StoreFunnelDay',
  keyColumns: ['sourceType', 'pageType'],
  keyValues: (row) => [
    Prisma.sql`${row.sourceType}`,
    Prisma.sql`${row.pageType}`,
  ],
};

const FUNNEL_PAGE_DAY: UpsertTarget<PageFunnelRow> = {
  table: 'StoreFunnelPageDay',
  keyColumns: ['pageTitle'],
  keyValues: (row) => [Prisma.sql`${row.pageTitle}`],
};

export const funnelUpserts = (
  workspaceId: string,
  appId: string,
  rows: FunnelRow[],
): Prisma.Sql[] => upserts(FUNNEL_DAY, workspaceId, appId, rows);

export const pageUpserts = (
  workspaceId: string,
  appId: string,
  rows: PageFunnelRow[],
): Prisma.Sql[] => upserts(FUNNEL_PAGE_DAY, workspaceId, appId, rows);

export function unresolvedTerritories(rows: CounterRow[]): string[] {
  return [
    ...new Set(
      rows
        .filter((row) => row.country === undefined && countryOf(row) === null)
        .map((row) => row.territory),
    ),
  ];
}
