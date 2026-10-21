import type { PrismaService } from '../prisma/prisma.service';

export const EXPORT_PAGE_SIZE = 2_000;

export type ExportRow = Record<string, unknown>;

export interface ExportTable {
  name: string;
  count: () => Promise<number>;
  page: (after: ExportRow | undefined, take: number) => Promise<ExportRow[]>;
}

interface ExportTableKey {
  name: string;
  key: readonly string[];
  include?: Record<string, true>;
}

interface ExportDelegate {
  count: () => Promise<number>;
  findMany: (args: {
    where: ExportRow;
    orderBy: Record<string, 'asc'>[];
    take: number;
    include?: Record<string, true>;
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
  { name: 'review', key: ID },
  { name: 'reviewReply', key: ['reviewId'] },
  { name: 'changeEvent', key: ID },
  { name: 'snapshotScreenshot', key: ['snapshotId', 'position'] },
  { name: 'auditInsight', key: ['appId'] },
  { name: 'auditScore', key: ['appId', 'date'] },
  { name: 'actionItem', key: ID },
  { name: 'actionEvent', key: ID },
  { name: 'aiCall', key: ID },
  { name: 'webhook', key: ID },
  { name: 'emailAlert', key: ID },
  { name: 'alertDelivery', key: ID },
  { name: 'alertEvent', key: ID },
  { name: 'suggestProbe', key: ['appId', 'term', 'country', 'day', 'probe'] },
];

export function keysetAfter(
  key: readonly string[],
  after: ExportRow | undefined,
): ExportRow {
  if (!after) return {};
  const terms = key.map((column, index) => ({
    ...Object.fromEntries(
      key.slice(0, index).map((equal) => [equal, after[equal]]),
    ),
    [column]: { gt: after[column] },
  }));
  if (terms.length === 1) return terms[0];
  const [first] = key;
  return { [first]: { gte: after[first] }, OR: terms };
}

export function exportTables(prisma: PrismaService): ExportTable[] {
  const delegates = prisma as unknown as Record<string, ExportDelegate>;
  return EXPORT_TABLE_KEYS.map(({ name, key, include }) => ({
    name,
    count: () => delegates[name].count(),
    page: (after, take) =>
      delegates[name].findMany({
        where: keysetAfter(key, after),
        orderBy: key.map((column) => ({ [column]: 'asc' as const })),
        take,
        ...(include ? { include } : {}),
      }),
  }));
}
