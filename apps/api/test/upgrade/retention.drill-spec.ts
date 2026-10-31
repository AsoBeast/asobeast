import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { DEFAULT_WORKSPACE_ID } from '../../src/common/tenancy/default-workspace';
import { validateEnv } from '../../src/config/env';
import { RetentionService } from '../../src/jobs/retention.service';
import { PrismaClient } from '@prisma/client';
import { PrismaModule } from '../../src/prisma/prisma.module';
import { testDb } from '../helpers/test-db';

const NOW = new Date('2026-07-20T00:00:00.000Z');
const ANCIENT = new Date('2026-06-01T00:00:00.000Z');

const RETENTION_WINDOWS = {
  RETENTION_RANKINGS_DAYS: '5',
  RETENTION_SERP_DAYS: '0',
  RETENTION_SERP_DEEP_DAYS: '0',
  RETENTION_CATEGORY_RANKS_DAYS: '0',
  RETENTION_CHANGE_EVENTS_DAYS: '3',
  RETENTION_SNAPSHOTS_DAYS: '3',
  RETENTION_DELIVERIES_DAYS: '3',
  RETENTION_ALERT_EVENTS_DAYS: '3',
  RETENTION_AUDIT_SCORES_DAYS: '0',
  RETENTION_ACTIONS_DAYS: '3',
};

const SERP_WINDOWS = {
  RETENTION_SERP_DAYS: '90',
  RETENTION_SERP_DEEP_DAYS: '30',
};

const daysBefore = (days: number) =>
  new Date(NOW.getTime() - days * 86_400_000);

const retentionModule = () =>
  Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        validate: validateEnv,
      }),
      PrismaModule,
    ],
    providers: [RetentionService],
  }).compile();

const withWindows = async <T>(
  windows: Record<string, string>,
  run: () => Promise<T>,
): Promise<T> => {
  const saved = new Map(
    Object.keys(windows).map((key) => [key, process.env[key]]),
  );
  Object.assign(process.env, windows);
  try {
    return await run();
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
};

const pruneAtNow = async (retention: RetentionService) => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
  jest.setSystemTime(NOW);
  try {
    return await retention.prune();
  } finally {
    jest.useRealTimers();
  }
};

const CLOSED_STATUSES = ['DONE', 'DISMISSED', 'RESOLVED'] as const;
const OPEN_STATUSES = ['OPEN', 'SNOOZED'] as const;

type ActionDrillStatus =
  (typeof CLOSED_STATUSES)[number] | (typeof OPEN_STATUSES)[number];

describe('Retention against an upgraded baseline database', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaClient;
  let retention: RetentionService;
  let deleted: Record<string, number>;

  const actionFor = (status: ActionDrillStatus) => ({
    workspaceId: DEFAULT_WORKSPACE_ID,
    appId: 'app_ios',
    keywordId: 'kw_ios_us',
    rule: 'keyword.defend',
    category: 'regression',
    store: 'APP_STORE' as const,
    country: 'us',
    fingerprint: `drill-${status.toLowerCase()}`,
    status,
    priority: 'high',
    impact: 60,
    formulaVersion: 'v1',
    evidence: {},
    firstSeenAt: ANCIENT,
    lastSeenAt: ANCIENT,
    resolvedAt: status === 'RESOLVED' ? ANCIENT : null,
    closedAt: status === 'DONE' || status === 'DISMISSED' ? ANCIENT : null,
    snoozedUntil: status === 'SNOOZED' ? ANCIENT : null,
    updatedAt: ANCIENT,
  });

  beforeAll(async () => {
    moduleRef = await withWindows(RETENTION_WINDOWS, retentionModule);

    retention = moduleRef.get(RetentionService);
    prisma = testDb();

    const changeEvents = await prisma.changeEvent.count();
    if (changeEvents !== 2) {
      throw new Error(
        `Expected the freshly loaded baseline fixture and found ${changeEvents} change events. Run apps/api/test/upgrade/run-drill.sh before this spec; it asserts what retention deleted, so it cannot run twice against the same database.`,
      );
    }

    await prisma.actionItem.deleteMany({
      where: { fingerprint: { startsWith: 'drill-' } },
    });
    await prisma.actionItem.createMany({
      data: [...OPEN_STATUSES, ...CLOSED_STATUSES].map(actionFor),
    });

    await prisma.appSnapshot.createMany({
      data: ['snap_market_old', 'snap_market_new'].map((id, index) => ({
        id,
        appId: 'app_ios',
        country: 'gb',
        title: 'Drill Fitness',
        description: 'Market description.',
        raw: {},
        capturedAt: new Date(`2026-06-0${index + 1}T00:00:00.000Z`),
      })),
    });

    deleted = await pruneAtNow(retention);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await prisma.$disconnect();
    await moduleRef.close();
  });

  it('prunes only the rankings older than the window', async () => {
    expect(deleted.keywordRanking).toBe(1);
    const remaining = await prisma.keywordRanking.findMany({
      select: { date: true },
    });
    expect(remaining).toHaveLength(9);
    expect(remaining.every((row) => row.date >= new Date('2026-07-15'))).toBe(
      true,
    );
  });

  it('keeps the newest snapshot per app and market regardless of age', async () => {
    expect(deleted.appSnapshot).toBe(4);
    const remaining = await prisma.appSnapshot.findMany({
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    expect(remaining.map((row) => row.id)).toEqual([
      'snap_ios_new',
      'snap_market_new',
      'snap_play_escaped',
    ]);
  });

  it('keeps every table configured to retain forever', async () => {
    expect(deleted.serpEntry).toBe(0);
    expect(deleted.categoryRank).toBe(0);
    expect(deleted.auditScore).toBe(0);
    await expect(prisma.serpEntry.count()).resolves.toBe(3);
    await expect(prisma.categoryRank.count()).resolves.toBe(3);
    await expect(prisma.auditScore.count()).resolves.toBe(2);
  });

  it('prunes the aged change events and delivery log', async () => {
    expect(deleted.changeEvent).toBe(2);
    expect(deleted.alertDelivery).toBe(2);
    await expect(prisma.changeEvent.count()).resolves.toBe(0);
    await expect(prisma.alertDelivery.count()).resolves.toBe(0);
  });

  it('prunes flushed alert events and retains unfinished claims', async () => {
    expect(deleted.alertEvent).toBe(1);
    const remaining = await prisma.alertEvent.findMany({
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    expect(remaining.map((row) => row.id)).toEqual([
      'evt_pending',
      'evt_pending_two',
      'evt_unclaimed',
    ]);
  });

  it('keeps a suggest probe inside its fixed window', async () => {
    expect(deleted.suggestProbe).toBe(0);
    await expect(prisma.suggestProbe.count()).resolves.toBe(1);
  });

  it('prunes closed actions and never prunes open or snoozed ones by age', async () => {
    expect(deleted.actionItem).toBe(CLOSED_STATUSES.length);
    const remaining = await prisma.actionItem.findMany({
      select: { status: true },
      orderBy: { status: 'asc' },
    });
    expect(remaining.map((row) => row.status)).toEqual([...OPEN_STATUSES]);
  });

  it('leaves the tracking entities the upgrade carried forward untouched', async () => {
    await expect(prisma.workspace.count()).resolves.toBe(2);
    await expect(prisma.user.count()).resolves.toBe(2);
    await expect(prisma.app.count()).resolves.toBe(7);
    await expect(
      prisma.keyword.count({ where: { id: { startsWith: 'kw_' } } }),
    ).resolves.toBe(14);
    await expect(
      prisma.trackedKeyword.count({
        where: { keywordId: { startsWith: 'kw_' } },
      }),
    ).resolves.toBe(15);
    await expect(
      prisma.keywordMetric.count({
        where: {
          keywordId: { startsWith: 'kw_' },
          date: new Date('2026-07-01T00:00:00.000Z'),
        },
      }),
    ).resolves.toBe(3);
    await expect(prisma.review.count()).resolves.toBe(3);
  });
});

describe('Retention of search results below the top 10', () => {
  const KEYWORD_ID = 'drill_serp_depth';
  let prisma: PrismaClient;
  let positions: (date: Date) => Promise<number[]>;

  beforeAll(async () => {
    prisma = testDb();
    await prisma.keyword.create({
      data: {
        id: KEYWORD_ID,
        text: 'drill serp depth',
        store: 'APP_STORE',
        country: 'us',
      },
    });
    await prisma.serpEntry.createMany({
      data: [daysBefore(40), daysBefore(10)].flatMap((date) =>
        Array.from({ length: 12 }, (_, index) => ({
          keywordId: KEYWORD_ID,
          date,
          position: index + 1,
          storeAppId: `drill-${index + 1}`,
          title: `Drill ${index + 1}`,
        })),
      ),
    });
    positions = async (date) =>
      (
        await prisma.serpEntry.findMany({
          where: { keywordId: KEYWORD_ID, date },
          orderBy: { position: 'asc' },
          select: { position: true },
        })
      ).map((row) => row.position);

    await withWindows(SERP_WINDOWS, async () => {
      const moduleRef = await retentionModule();
      try {
        await pruneAtNow(moduleRef.get(RetentionService));
      } finally {
        await moduleRef.close();
      }
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('keeps only the top 10 of a day older than the deep window', async () => {
    await expect(positions(daysBefore(40))).resolves.toEqual(
      Array.from({ length: 10 }, (_, index) => index + 1),
    );
  });

  it('keeps every position of a day inside the deep window', async () => {
    await expect(positions(daysBefore(10))).resolves.toEqual(
      Array.from({ length: 12 }, (_, index) => index + 1),
    );
  });
});
