import { execSync } from 'child_process';
import { join } from 'path';
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

describe('keyword relevance per market (e2e)', () => {
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

  const createApp = (store: Store, storeAppId: string) =>
    prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store,
        storeAppId,
        country: 'us',
        name: 'Mine',
      },
    });

  const listing = (
    appId: string,
    country: string | null,
    texts: { title: string; subtitle?: string; summary?: string },
  ) =>
    prisma.appSnapshot.create({
      data: {
        appId,
        country,
        title: texts.title,
        subtitle: texts.subtitle ?? null,
        summary: texts.summary ?? null,
        description: `${texts.title} description`,
        raw: {},
      },
    });

  const track = async (
    appId: string,
    store: Store,
    text: string,
    country: string,
  ) => {
    const keyword = await prisma.keyword.create({
      data: { text, store, country },
    });
    await prisma.trackedKeyword.create({
      data: { appId, keywordId: keyword.id, source: 'MANUAL', active: true },
    });
  };

  const seed = async () => {
    const mine = await createApp(Store.APP_STORE, '111');
    await listing(mine.id, null, {
      title: 'Habit Tracker',
      subtitle: 'Daily Streak Counter',
    });
    await listing(mine.id, 'de', {
      title: 'Gewohnheits Tracker',
      subtitle: 'Taegliche Serie',
    });
    await track(mine.id, Store.APP_STORE, 'gewohnheits tracker', 'de');
    await track(mine.id, Store.APP_STORE, 'habit tracker', 'pl');
    return mine;
  };

  const relevanceOf = async (path: string, text: string) => {
    const rows = (await api.get(path).expect(200)).body as TrackedKeywordItem[];
    return rows.find((row) => row.text === text)?.relevance;
  };

  it('derives the relevance of a market keyword from its listing', async () => {
    const mine = await seed();

    await expect(
      relevanceOf(
        `/apps/${mine.id}/keywords?country=de`,
        'gewohnheits tracker',
      ),
    ).resolves.toBe(90);
  });

  it('derives the relevance of a keyword in a market without a listing from home', async () => {
    const mine = await seed();

    await expect(
      relevanceOf(`/apps/${mine.id}/keywords?country=pl`, 'habit tracker'),
    ).resolves.toBe(90);
  });
});
