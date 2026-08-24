import { AppAuditResult } from '@asobeast/shared';
import { KeywordsService } from '../keywords/keywords.service';
import { WorkspaceFanOut } from '../common/tenancy/workspace-fanout';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAiService } from './audit-ai.service';
import { AuditService } from './audit.service';

const buildResult = (
  overrides: Partial<AppAuditResult> = {},
): AppAuditResult => ({
  appId: 'app-1',
  store: 'APP_STORE',
  overall: 78,
  coveredWeight: 80,
  totalWeight: 100,
  factors: [
    {
      id: 'title',
      label: 'Title',
      weight: 20,
      score: 90,
      checks: [],
      needsInput: false,
    },
    {
      id: 'reviews',
      label: 'Reviews',
      weight: 15,
      score: null,
      checks: [],
      needsInput: true,
    },
  ],
  recommendations: { quickWins: [], highImpact: [], strategic: [] },
  ai: { configured: false, model: null, generatedAt: null },
  generatedAt: '2026-07-22T06:00:00.000Z',
  ...overrides,
});

const buildPrisma = () => ({
  app: { findMany: jest.fn().mockResolvedValue([{ id: 'a' }, { id: 'b' }]) },
  auditScore: { upsert: jest.fn().mockResolvedValue(undefined) },
});

const fanOut = {
  each: async <T>(_justification: string, work: () => Promise<T>) => ({
    results: [await work()],
    failures: [],
  }),
} as unknown as WorkspaceFanOut;

describe('AuditService.snapshotAll', () => {
  afterEach(() => jest.useRealTimers());

  it('snapshots one row per primary app with slim factors on the UTC date', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-22T06:15:00.000Z'));
    const prisma = buildPrisma();
    const service = new AuditService(
      prisma as unknown as PrismaService,
      {} as unknown as KeywordsService,
      { configured: false, model: null } as unknown as AuditAiService,
      fanOut,
    );
    jest
      .spyOn(service, 'audit')
      .mockImplementation((appId) => Promise.resolve(buildResult({ appId })));

    const saved = await service.snapshotAll();

    expect(saved).toBe(2);
    const [findArgs] = prisma.app.findMany.mock.calls[0] as [
      { where: { isCompetitor: boolean } },
    ];
    expect(findArgs.where.isCompetitor).toBe(false);
    const [{ where, create }] = prisma.auditScore.upsert.mock.calls[0] as [
      {
        where: { appId_date: { appId: string; date: Date } };
        create: { factors: unknown };
      },
    ];
    expect(where.appId_date).toEqual({
      appId: 'a',
      date: new Date('2026-07-22T00:00:00.000Z'),
    });
    expect(create.factors).toEqual([
      { id: 'title', score: 90, weight: 20 },
      { id: 'reviews', score: null, weight: 15 },
    ]);
  });

  it('continues after one app fails and counts only the saved rows', async () => {
    const prisma = buildPrisma();
    const service = new AuditService(
      prisma as unknown as PrismaService,
      {} as unknown as KeywordsService,
      { configured: false, model: null } as unknown as AuditAiService,
      fanOut,
    );
    jest
      .spyOn(service, 'audit')
      .mockImplementation((appId) =>
        appId === 'a'
          ? Promise.reject(new Error('boom'))
          : Promise.resolve(buildResult({ appId })),
      );

    const saved = await service.snapshotAll();

    expect(saved).toBe(1);
    expect(prisma.auditScore.upsert).toHaveBeenCalledTimes(1);
  });
});

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
    };
    const keywords = {
      listTracked: jest.fn().mockResolvedValue([]),
      compare: jest.fn().mockResolvedValue({ competitors: [], rows: [] }),
    };

    return new AuditService(
      prisma as unknown as PrismaService,
      keywords as unknown as KeywordsService,
      { configured: false, model: null } as unknown as AuditAiService,
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
