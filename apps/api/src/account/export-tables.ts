import type { PrismaService } from '../prisma/prisma.service';

export const EXPORT_PAGE_SIZE = 2_000;

export interface ExportTable {
  name: string;
  count: () => Promise<number>;
  read: (skip: number, take: number) => Promise<unknown[]>;
}

const SECRET_FIELDS = [
  'passwordHash',
  'verificationHash',
  'tokenHash',
  'secret',
];

export function withoutSecrets(row: unknown): unknown {
  if (row === null || typeof row !== 'object') return row;
  return Object.fromEntries(
    Object.entries(row).filter(([key]) => !SECRET_FIELDS.includes(key)),
  );
}

export function exportTables(prisma: PrismaService): ExportTable[] {
  const table = <T>(
    name: string,
    count: () => Promise<number>,
    read: (skip: number, take: number) => Promise<T[]>,
  ): ExportTable => ({ name, count, read: (skip, take) => read(skip, take) });

  return [
    table(
      'workspace',
      () => prisma.workspace.count(),
      (skip, take) =>
        prisma.workspace.findMany({ skip, take, orderBy: { id: 'asc' } }),
    ),
    table(
      'user',
      () => prisma.user.count(),
      (skip, take) =>
        prisma.user.findMany({ skip, take, orderBy: { id: 'asc' } }),
    ),
    table(
      'apiToken',
      () => prisma.apiToken.count(),
      (skip, take) =>
        prisma.apiToken.findMany({ skip, take, orderBy: { id: 'asc' } }),
    ),
    table(
      'workspaceInvite',
      () => prisma.workspaceInvite.count(),
      (skip, take) =>
        prisma.workspaceInvite.findMany({
          skip,
          take,
          orderBy: { id: 'asc' },
        }),
    ),
    table(
      'appGroup',
      () => prisma.appGroup.count(),
      (skip, take) =>
        prisma.appGroup.findMany({ skip, take, orderBy: { id: 'asc' } }),
    ),
    table(
      'app',
      () => prisma.app.count(),
      (skip, take) =>
        prisma.app.findMany({ skip, take, orderBy: { id: 'asc' } }),
    ),
    table(
      'appSnapshot',
      () => prisma.appSnapshot.count(),
      (skip, take) =>
        prisma.appSnapshot.findMany({ skip, take, orderBy: { id: 'asc' } }),
    ),
    table(
      'trackedKeyword',
      () => prisma.trackedKeyword.count(),
      (skip, take) =>
        prisma.trackedKeyword.findMany({
          skip,
          take,
          orderBy: [{ appId: 'asc' }, { keywordId: 'asc' }],
          include: { keyword: true },
        }),
    ),
    table(
      'keywordRanking',
      () => prisma.keywordRanking.count(),
      (skip, take) =>
        prisma.keywordRanking.findMany({
          skip,
          take,
          orderBy: [{ date: 'asc' }, { appId: 'asc' }, { keywordId: 'asc' }],
        }),
    ),
    table(
      'categoryRank',
      () => prisma.categoryRank.count(),
      (skip, take) =>
        prisma.categoryRank.findMany({
          skip,
          take,
          orderBy: [
            { date: 'asc' },
            { appId: 'asc' },
            { collection: 'asc' },
            { genre: 'asc' },
          ],
        }),
    ),
    table(
      'review',
      () => prisma.review.count(),
      (skip, take) =>
        prisma.review.findMany({ skip, take, orderBy: { id: 'asc' } }),
    ),
    table(
      'changeEvent',
      () => prisma.changeEvent.count(),
      (skip, take) =>
        prisma.changeEvent.findMany({ skip, take, orderBy: { id: 'asc' } }),
    ),
    table(
      'auditInsight',
      () => prisma.auditInsight.count(),
      (skip, take) =>
        prisma.auditInsight.findMany({ skip, take, orderBy: { appId: 'asc' } }),
    ),
    table(
      'auditScore',
      () => prisma.auditScore.count(),
      (skip, take) =>
        prisma.auditScore.findMany({
          skip,
          take,
          orderBy: [{ appId: 'asc' }, { date: 'asc' }],
        }),
    ),
    table(
      'actionItem',
      () => prisma.actionItem.count(),
      (skip, take) =>
        prisma.actionItem.findMany({ skip, take, orderBy: { id: 'asc' } }),
    ),
    table(
      'webhook',
      () => prisma.webhook.count(),
      (skip, take) =>
        prisma.webhook.findMany({ skip, take, orderBy: { id: 'asc' } }),
    ),
    table(
      'emailAlert',
      () => prisma.emailAlert.count(),
      (skip, take) =>
        prisma.emailAlert.findMany({ skip, take, orderBy: { id: 'asc' } }),
    ),
    table(
      'alertDelivery',
      () => prisma.alertDelivery.count(),
      (skip, take) =>
        prisma.alertDelivery.findMany({ skip, take, orderBy: { id: 'asc' } }),
    ),
    table(
      'alertEvent',
      () => prisma.alertEvent.count(),
      (skip, take) =>
        prisma.alertEvent.findMany({ skip, take, orderBy: { id: 'asc' } }),
    ),
    table(
      'suggestProbe',
      () => prisma.suggestProbe.count(),
      (skip, take) =>
        prisma.suggestProbe.findMany({
          skip,
          take,
          orderBy: [
            { appId: 'asc' },
            { term: 'asc' },
            { day: 'asc' },
            { probe: 'asc' },
          ],
        }),
    ),
  ];
}
