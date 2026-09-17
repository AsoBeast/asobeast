import { AppAuditResult } from '@asobeast/shared';
import { WorkspaceFanOut } from '../common/tenancy/workspace-fanout';
import { KeywordsService } from '../keywords/keywords.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAiService } from './audit-ai.service';
import { AuditContextLoader } from './audit-context.loader';
import { AuditService } from './audit.service';

interface SnapshotQuery {
  where: { capturedAt?: { lte: Date } };
}

const snapshot = (capturedAt: Date, ratingCount: number) => ({
  capturedAt,
  title: 'Habit Tracker',
  subtitle: null,
  description: 'Build better habits.',
  ratingAvg: 4.6,
  ratingCount,
  storeUpdatedAt: capturedAt,
  raw: {},
});

type Snapshot = ReturnType<typeof snapshot>;

const fanOut = {
  each: async <T>(_justification: string, work: () => Promise<T>) => ({
    results: [await work()],
    failures: [],
  }),
} as unknown as WorkspaceFanOut;

const trendCheck = (result: AppAuditResult) =>
  result.factors
    .find((item) => item.id === 'ratings')
    ?.checks.find((item) => item.id === 'ratings-trend');

describe('AuditService rating trend baseline', () => {
  afterEach(() => jest.useRealTimers());

  const runAudit = (snapshots: Snapshot[]) => {
    const ascending = [...snapshots].sort(
      (a, b) => a.capturedAt.getTime() - b.capturedAt.getTime(),
    );
    const prisma = {
      app: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'app-1',
          store: 'APP_STORE',
          country: 'us',
          name: 'Habit Tracker',
        }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      appSnapshot: {
        findFirst: jest.fn(({ where }: SnapshotQuery) => {
          const cutoff = where.capturedAt?.lte;
          const matches = ascending.filter(
            (item) => cutoff === undefined || item.capturedAt <= cutoff,
          );
          return Promise.resolve(matches[matches.length - 1] ?? null);
        }),
      },
      auditInsight: { findUnique: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const keywords = {
      listTracked: jest.fn().mockResolvedValue([]),
      compare: jest.fn().mockResolvedValue({ competitors: [], rows: [] }),
      getKeywordField: jest.fn().mockResolvedValue({ tracked: [] }),
    } as unknown as KeywordsService;
    const auditAi = {
      configured: false,
      model: null,
    } as unknown as AuditAiService;

    return new AuditService(
      prisma,
      new AuditContextLoader(prisma, keywords, auditAi),
      auditAi,
      fanOut,
    ).audit('app-1');
  };

  it('leaves the 30 day trend unanswered when the only snapshot predates the window', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-31T00:00:00.000Z'));

    const result = await runAudit([
      snapshot(new Date('2026-07-01T00:00:00.000Z'), 5000),
    ]);

    expect(trendCheck(result)?.score).toBeNull();
    expect(trendCheck(result)?.status).toBe('unanswered');
  });

  it('scores the 30 day trend when a baseline older than the current snapshot exists', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-31T00:00:00.000Z'));

    const result = await runAudit([
      snapshot(new Date('2026-06-01T00:00:00.000Z'), 4000),
      snapshot(new Date('2026-07-30T00:00:00.000Z'), 5000),
    ]);

    expect(trendCheck(result)?.score).toBe(10);
  });
});
