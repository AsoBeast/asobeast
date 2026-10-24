import { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

export const EXPORT_PAGE_SIZE = 2_000;

export type ExportRow = Record<string, unknown>;

export interface ExportPage {
  rows: ExportRow[];
  next?: ExportRow;
}

export interface ExportTable {
  name: string;
  count: () => Promise<number>;
  page: (after: ExportRow | undefined, take: number) => Promise<ExportPage>;
}

interface ExportTableKey {
  name: string;
  key: readonly string[];
  include?: Record<string, true>;
  omit?: Record<string, true>;
}

interface ExportDelegate {
  count: () => Promise<number>;
  findMany: (args: {
    where: ExportRow;
    orderBy: Record<string, 'asc'>[];
    include?: Record<string, true>;
    omit?: Record<string, true>;
  }) => Promise<ExportRow[]>;
}

const SECRET_FIELDS = [
  'passwordHash',
  'verificationHash',
  'verificationExpiresAt',
  'resetHash',
  'resetExpiresAt',
  'sessionVersion',
  'tokenHash',
  'secret',
  'credentialCiphertext',
  'checkoutClaimToken',
  'checkoutSessionId',
];

export function withoutSecrets(row: unknown): unknown {
  if (row === null || typeof row !== 'object') return row;
  return Object.fromEntries(
    Object.entries(row).filter(([key]) => !SECRET_FIELDS.includes(key)),
  );
}

const ID = ['id'];
const BY_LOCALIZATION = ['appId', 'localization'];

export const EXPORT_TABLE_KEYS: readonly ExportTableKey[] = [
  { name: 'workspace', key: ID },
  { name: 'user', key: ID },
  { name: 'apiToken', key: ID },
  { name: 'workspaceInvite', key: ID },
  { name: 'appGroup', key: ID },
  { name: 'app', key: ID },
  { name: 'appSnapshot', key: ID },
  {
    name: 'trackedKeyword',
    key: ['appId', 'keywordId'],
    include: { keyword: true },
  },
  { name: 'keywordField', key: BY_LOCALIZATION },
  { name: 'appSetup', key: ['appId'] },
  { name: 'appLocalization', key: BY_LOCALIZATION },
  { name: 'keywordRanking', key: ['appId', 'keywordId', 'date'] },
  { name: 'categoryRank', key: ['appId', 'date', 'collection', 'genre'] },
  { name: 'chartFollow', key: ID },
  { name: 'appAnnotation', key: ID },
  { name: 'review', key: ID },
  { name: 'reviewReply', key: ['reviewId'] },
  { name: 'changeEvent', key: ID },
  { name: 'snapshotScreenshot', key: ['snapshotId', 'position'] },
  { name: 'auditInsight', key: ['appId'] },
  { name: 'auditScore', key: ['appId', 'date'] },
  { name: 'actionItem', key: ID },
  { name: 'actionEvent', key: ID },
  { name: 'aiCall', key: ID },
  { name: 'storeConnection', key: ID },
  { name: 'storeReportRequest', key: ID },
  { name: 'storeReportInstance', key: ID, omit: { raw: true } },
  { name: 'storeFunnelDay', key: ID },
  { name: 'webhook', key: ID },
  { name: 'emailAlert', key: ID },
  { name: 'alertDelivery', key: ID },
  { name: 'alertEvent', key: ID },
  { name: 'suggestProbe', key: ['appId', 'term', 'country', 'day', 'probe'] },
];

const quoted = (identifier: string) => Prisma.raw(`"${identifier}"`);

export function keysAfter(
  table: string,
  key: readonly string[],
  after: ExportRow | undefined,
  take: number,
): Prisma.Sql {
  const columns = Prisma.join(key.map(quoted));
  const from = quoted(table.charAt(0).toUpperCase() + table.slice(1));
  const where = after
    ? Prisma.sql`WHERE (${columns}) > (${Prisma.join(key.map((column) => after[column]))})`
    : Prisma.empty;
  return Prisma.sql`SELECT ${columns} FROM ${from} ${where} ORDER BY ${columns} LIMIT ${take}`;
}

const sameValue = (left: unknown, right: unknown) =>
  left instanceof Date && right instanceof Date
    ? left.getTime() === right.getTime()
    : left === right;

const prefixOf = (key: readonly string[], length: number, row: ExportRow) =>
  Object.fromEntries(
    key.slice(0, length).map((column) => [column, row[column]]),
  );

export function keyRange(
  key: readonly string[],
  first: ExportRow,
  last: ExportRow,
): ExportRow {
  const split = key.findIndex(
    (column) => !sameValue(first[column], last[column]),
  );
  if (split === -1) return prefixOf(key, key.length, first);
  const end = key.length - 1;
  const above = (index: number) => (index === end ? 'gte' : 'gt');
  const below = (index: number) => (index === end ? 'lte' : 'lt');
  const edge = (
    index: number,
    row: ExportRow,
    operator: (index: number) => string,
  ) => ({
    ...prefixOf(key, index, row),
    [key[index]]: { [operator(index)]: row[key[index]] },
  });
  const deeper = Array.from(
    { length: end - split },
    (_column, offset) => end - offset,
  );
  return {
    OR: [
      ...deeper.map((index) => edge(index, first, above)),
      {
        ...prefixOf(key, split, first),
        [key[split]]: {
          [above(split)]: first[key[split]],
          [below(split)]: last[key[split]],
        },
      },
      ...[...deeper].reverse().map((index) => edge(index, last, below)),
    ],
  };
}

export function exportTables(prisma: PrismaService): ExportTable[] {
  const delegates = prisma as unknown as Record<string, ExportDelegate>;
  return EXPORT_TABLE_KEYS.map(({ name, key, include, omit }) => ({
    name,
    count: () => delegates[name].count(),
    page: async (after, take) => {
      const keys = await prisma.$queryRaw<ExportRow[]>(
        keysAfter(name, key, after, take),
      );
      if (keys.length === 0) return { rows: [] };
      const rows = await delegates[name].findMany({
        where: keyRange(key, keys[0], keys[keys.length - 1]),
        orderBy: key.map((column) => ({ [column]: 'asc' as const })),
        ...(include ? { include } : {}),
        ...(omit ? { omit } : {}),
      });
      return {
        rows,
        next: keys.length < take ? undefined : keys[keys.length - 1],
      };
    },
  }));
}
