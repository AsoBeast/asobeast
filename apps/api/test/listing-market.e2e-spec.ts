import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { obliterateQueues, settleBootRegistration } from './obliterate-queues';
import { testDb } from './helpers/test-db';
import { useCookies } from './helpers/session';

describe('listing market columns (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;

  beforeAll(async () => {
    execSync('pnpm prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'ignore',
    });
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    useCookies(app);
    await app.init();
    await settleBootRegistration(app);
    prisma = testDb();
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: {},
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  const seedApp = () =>
    prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '111',
        country: 'us',
        name: 'Mine',
      },
    });

  const snapshotData = (
    appId: string,
    country: string | null,
    title: string,
  ) => ({
    appId,
    country,
    title,
    description: 'Description',
    raw: {},
  });

  it('keeps a market snapshot beside the home snapshot of the same app', async () => {
    const mine = await seedApp();
    await prisma.appSnapshot.createMany({
      data: [
        snapshotData(mine.id, null, 'Habit Tracker'),
        snapshotData(mine.id, 'de', 'Gewohnheits Tracker'),
      ],
    });

    const rows = await prisma.appSnapshot.findMany({
      where: { appId: mine.id },
      orderBy: { title: 'asc' },
      select: { country: true, title: true },
    });

    expect(rows).toEqual([
      { country: 'de', title: 'Gewohnheits Tracker' },
      { country: null, title: 'Habit Tracker' },
    ]);
  });

  it('keeps a market change event beside the home change event', async () => {
    const mine = await seedApp();
    await prisma.changeEvent.createMany({
      data: [
        { appId: mine.id, field: 'title', before: 'A', after: 'B' },
        {
          appId: mine.id,
          country: 'de',
          field: 'title',
          before: 'C',
          after: 'D',
        },
      ],
    });

    const rows = await prisma.changeEvent.findMany({
      where: { appId: mine.id },
      orderBy: { after: 'asc' },
      select: { country: true, after: true },
    });

    expect(rows).toEqual([
      { country: null, after: 'B' },
      { country: 'de', after: 'D' },
    ]);
  });

  it('deletes market snapshots and events with their app', async () => {
    const mine = await seedApp();
    await prisma.appSnapshot.create({
      data: snapshotData(mine.id, 'de', 'Titel'),
    });
    await prisma.changeEvent.create({
      data: {
        appId: mine.id,
        country: 'de',
        field: 'title',
        before: 'C',
        after: 'D',
      },
    });

    await prisma.app.delete({ where: { id: mine.id } });

    await expect(prisma.appSnapshot.count()).resolves.toBe(0);
    await expect(prisma.changeEvent.count()).resolves.toBe(0);
  });
});
