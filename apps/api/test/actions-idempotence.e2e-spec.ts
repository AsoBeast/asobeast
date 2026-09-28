import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import { App } from 'supertest/types';
import { DailyBudgetService } from '../src/jobs/daily-budget.service';
import { AppModule } from '../src/app.module';
import { testDb } from './helpers/test-db';
import { ACTION_REOPEN_AFTER_DAYS } from '../src/actions/action-lifecycle';
import { ActionsGenerator } from '../src/actions/actions.generator';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { obliterateQueues } from './obliterate-queues';
import { asWorkspace } from './helpers/tenancy';

const D = (offset: number): Date =>
  new Date(Date.UTC(2026, 6, 30) - offset * 86_400_000);

describe('action generation (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let generator: ActionsGenerator;
  let budget: DailyBudgetService;
  let providerCalls = 0;

  beforeAll(async () => {
    execSync('pnpm prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'ignore',
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(StoreProviderRegistry)
      .useValue({
        get: () => {
          providerCalls += 1;
          throw new Error('generation must never touch a store');
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = testDb();
    generator = app.get(ActionsGenerator);
    budget = app.get(DailyBudgetService);

    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: {},
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  const seedUncoveredKeyword = async (): Promise<void> => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword" RESTART IDENTITY CASCADE',
    );

    const created = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '111',
        country: 'us',
        name: 'Budget Planner',
      },
    });
    await prisma.appSnapshot.create({
      data: {
        appId: created.id,
        title: 'Budget Planner',
        subtitle: 'Money',
        description: 'Track spending.',
        version: '4.2.0',
        raw: {},
        capturedAt: D(1),
      },
    });

    const keyword = await prisma.keyword.create({
      data: { text: 'expense tracker', store: Store.APP_STORE, country: 'us' },
    });
    await prisma.trackedKeyword.create({
      data: {
        appId: created.id,
        keywordId: keyword.id,
        source: 'MANUAL',
        active: true,
        relevance: 90,
      },
    });
    await prisma.keywordMetric.create({
      data: {
        keywordId: keyword.id,
        date: D(1),
        traffic: 8,
        difficulty: 3,
        formulaVersion: 'app-store-v2',
      },
    });
  };

  const runAt = async (now: Date) => {
    const estimated = await asWorkspace(app, () => budget.estimate());
    return asWorkspace(app, () =>
      generator.generateForWorkspace(estimated, now),
    );
  };

  it('opens nothing new on a second run over unchanged data', async () => {
    await seedUncoveredKeyword();

    const first = await runAt(D(0));
    const second = await runAt(D(0));

    expect(first.opened).toBeGreaterThan(0);
    expect(second).toMatchObject({ opened: 0, resolved: 0, reopened: 0 });
    expect(second.refreshed).toBe(first.opened);
    expect(providerCalls).toBe(0);

    const rows = await prisma.actionItem.findMany({
      where: { workspaceId: DEFAULT_WORKSPACE_ID },
      select: { firstSeenAt: true, status: true },
    });
    expect(rows.every((row) => row.status === 'OPEN')).toBe(true);
    expect(
      rows.every((row) => row.firstSeenAt.getTime() === D(0).getTime()),
    ).toBe(true);
  });

  it('reopens a done action whose rule keeps firing for fourteen days', async () => {
    await seedUncoveredKeyword();
    const first = await runAt(D(0));
    expect(first.opened).toBeGreaterThan(0);

    await prisma.actionItem.updateMany({
      where: { workspaceId: DEFAULT_WORKSPACE_ID },
      data: { status: 'DONE', closedAt: D(0) },
    });

    for (let day = 1; day < ACTION_REOPEN_AFTER_DAYS; day += 1) {
      const run = await runAt(D(-day));
      expect(run).toMatchObject({ reopened: 0, touched: first.opened });
    }
    const due = await runAt(D(-ACTION_REOPEN_AFTER_DAYS));

    expect(due.reopened).toBe(first.opened);
    const rows = await prisma.actionItem.findMany({
      where: { workspaceId: DEFAULT_WORKSPACE_ID },
      select: { status: true, reopenCount: true },
    });
    expect(rows.every((row) => row.status === 'OPEN')).toBe(true);
    expect(rows.every((row) => row.reopenCount === 1)).toBe(true);
  });
});
