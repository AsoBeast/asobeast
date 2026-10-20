import { execSync } from 'child_process';
import { join } from 'path';
import { setTimeout as sleep } from 'timers/promises';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import { TrackedKeywordItem } from '@asobeast/shared';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { obliterateQueues, settleBootRegistration } from './obliterate-queues';
import { testDb } from './helpers/test-db';
import { ownerAgent, useCookies } from './helpers/session';

const HELD_MS = 6_000;

describe('a scoped read that waits longer than an interactive transaction (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let api: Awaited<ReturnType<typeof ownerAgent>>;

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
    api = await ownerAgent(app);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  it('answers the keyword list once the rankings it reads are free again', async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword" RESTART IDENTITY CASCADE',
    );
    const owned = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '1',
        country: 'us',
        name: 'Mine',
      },
    });
    const keyword = await prisma.keyword.create({
      data: { text: 'habit tracker', store: Store.APP_STORE, country: 'us' },
    });
    await prisma.trackedKeyword.create({
      data: {
        appId: owned.id,
        keywordId: keyword.id,
        source: 'MANUAL',
      },
    });
    await prisma.keywordRanking.create({
      data: {
        appId: owned.id,
        workspaceId: DEFAULT_WORKSPACE_ID,
        keywordId: keyword.id,
        date: new Date('2026-10-19T00:00:00Z'),
        position: 4,
      },
    });

    let locked: () => void = () => undefined;
    const isLocked = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const holder = prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(
          'LOCK TABLE "KeywordRanking" IN ACCESS EXCLUSIVE MODE',
        );
        locked();
        await sleep(HELD_MS);
      },
      { timeout: HELD_MS * 3 },
    );
    await isLocked;

    const response = await api.get(`/apps/${owned.id}/keywords`);
    await holder;

    expect(response.status).toBe(200);
    const [row] = response.body as TrackedKeywordItem[];
    expect(row).toMatchObject({ keywordId: keyword.id, latestPosition: 4 });
  }, 40_000);
});
