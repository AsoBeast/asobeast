import { AppAuditResult } from '@asobeast/shared';
import { WorkspaceFanOut } from '../common/tenancy/workspace-fanout';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAiService } from './audit-ai.service';
import { AuditContextLoader } from './audit-context.loader';
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
      {} as unknown as AuditContextLoader,
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
      {} as unknown as AuditContextLoader,
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
