import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { testDb } from './helpers/test-db';
import { ACTION_REOPEN_AFTER_DAYS } from '../src/actions/action-lifecycle';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { obliterateQueues } from './obliterate-queues';
import {
  ACTION_DAY,
  generateActionsAt,
  seedUncoveredKeyword,
} from './helpers/action-seed';

const D = ACTION_DAY;

describe('action generation (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
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

  const runAt = (now: Date) => generateActionsAt(app, now);

  it('opens nothing new on a second run over unchanged data', async () => {
    await seedUncoveredKeyword(prisma);

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
    await seedUncoveredKeyword(prisma);
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

  it('confirms a done action once its rule stops firing and reopens it when it returns', async () => {
    await seedUncoveredKeyword(prisma);
    const first = await runAt(D(0));
    expect(first.opened).toBeGreaterThan(0);
    await prisma.actionItem.updateMany({
      where: { workspaceId: DEFAULT_WORKSPACE_ID },
      data: { status: 'DONE', closedAt: D(0) },
    });
    const coverKeyword = (title: string) =>
      prisma.appSnapshot.updateMany({ data: { title } });

    await coverKeyword('Budget Planner: Expense Tracker');
    const verifying = await runAt(D(-1));
    const quiet = await runAt(D(-2));
    const verified = await prisma.actionItem.findMany({
      where: { workspaceId: DEFAULT_WORKSPACE_ID },
      select: { verifiedAt: true },
    });
    await coverKeyword('Budget Planner');
    const returned = await runAt(D(-3));

    expect(verifying.verified).toBe(first.opened);
    expect(
      verified.every((row) => row.verifiedAt?.getTime() === D(-1).getTime()),
    ).toBe(true);
    expect(quiet).toMatchObject({ verified: 0, reopened: 0, touched: 0 });
    expect(returned.reopened).toBe(first.opened);
    const rows = await prisma.actionItem.findMany({
      where: { workspaceId: DEFAULT_WORKSPACE_ID },
      select: { status: true, reopenCount: true, verifiedAt: true },
    });
    expect(rows).toEqual(
      rows.map(() => ({ status: 'OPEN', reopenCount: 1, verifiedAt: null })),
    );
  });
});
