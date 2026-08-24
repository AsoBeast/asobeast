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
  RETENTION_CATEGORY_RANKS_DAYS: '0',
  RETENTION_CHANGE_EVENTS_DAYS: '3',
  RETENTION_SNAPSHOTS_DAYS: '3',
  RETENTION_DELIVERIES_DAYS: '3',
  RETENTION_ALERT_EVENTS_DAYS: '3',
  RETENTION_AUDIT_SCORES_DAYS: '0',
  RETENTION_ACTIONS_DAYS: '3',
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

  const savedWindows = new Map<string, string | undefined>();

  beforeAll(async () => {
    for (const key of Object.keys(RETENTION_WINDOWS)) {
      savedWindows.set(key, process.env[key]);
    }
    Object.assign(process.env, RETENTION_WINDOWS);

    moduleRef = await Test.createTestingModule({
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

    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    jest.setSystemTime(NOW);
    deleted = await retention.prune();
    jest.useRealTimers();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await prisma.$disconnect();
    await moduleRef.close();
    for (const [key, value] of savedWindows) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('prunes only the rankings older than the window', async () => {
    expect(deleted.keywordRanking).toBe(1);
    const remaining = await prisma.keywordRanking.findMany({
      select: { date: true },
    });
    expect(remaining).toHaveLength(5);
    expect(remaining.every((row) => row.date >= new Date('2026-07-15'))).toBe(
      true,
    );
  });

  it('keeps the newest snapshot per app regardless of age', async () => {
    expect(deleted.appSnapshot).toBe(1);
    const remaining = await prisma.appSnapshot.findMany({
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    expect(remaining.map((row) => row.id)).toEqual([
      'snap_ios_new',
      'snap_play',
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
    await expect(prisma.app.count()).resolves.toBe(3);
    await expect(
      prisma.keyword.count({ where: { id: { startsWith: 'kw_' } } }),
    ).resolves.toBe(4);
    await expect(
      prisma.trackedKeyword.count({
        where: { keywordId: { startsWith: 'kw_' } },
      }),
    ).resolves.toBe(5);
    await expect(
      prisma.keywordMetric.count({
        where: { keywordId: { startsWith: 'kw_' } },
      }),
    ).resolves.toBe(3);
    await expect(prisma.review.count()).resolves.toBe(3);
  });
});
