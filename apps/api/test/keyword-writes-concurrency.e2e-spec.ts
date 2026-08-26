import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { KeywordsService } from '../src/keywords/keywords.service';
import { asWorkspace } from './helpers/tenancy';
import { testDb } from './helpers/test-db';
import { obliterateQueues, pauseQueues } from './obliterate-queues';

const PHRASE = 'focus timer';
const FIELD = 'focus timer,deep work,pomodoro';

describe('Keyword writes under concurrency (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let keywords: KeywordsService;

  beforeAll(async () => {
    execSync('pnpm prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'ignore',
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<App>();
    await app.init();
    await pauseQueues(app);
    keywords = app.get(KeywordsService);

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
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword" RESTART IDENTITY CASCADE',
    );
    await obliterateQueues(app);
    await app.close();
    await prisma.$disconnect();
  });

  const seedApp = async () => {
    const row = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: 'concurrent',
        country: 'us',
        name: 'Focus Timer',
      },
      select: { id: true },
    });
    return row.id;
  };

  const trackedRows = (appId: string) =>
    prisma.trackedKeyword.findMany({
      where: { appId },
      select: {
        keywordId: true,
        source: true,
        active: true,
        keyword: { select: { text: true } },
      },
    });

  it('adds the same phrase once when two requests arrive together', async () => {
    const appId = await seedApp();

    const settled = await asWorkspace(app, () =>
      Promise.allSettled([
        keywords.addManual(appId, [PHRASE]),
        keywords.addManual(appId, [PHRASE]),
      ]),
    );

    expect(settled.filter((entry) => entry.status === 'rejected')).toEqual([]);
    expect(await prisma.keyword.count({ where: { text: PHRASE } })).toBe(1);
    expect(await trackedRows(appId)).toHaveLength(1);
  });

  it('saves the same keyword field once when two saves arrive together', async () => {
    const appId = await seedApp();

    const settled = await asWorkspace(app, () =>
      Promise.allSettled([
        keywords.setKeywordField(appId, FIELD),
        keywords.setKeywordField(appId, FIELD),
      ]),
    );

    expect(settled.filter((entry) => entry.status === 'rejected')).toEqual([]);

    const rows = await trackedRows(appId);
    expect(rows).toHaveLength(FIELD.split(',').length);
    expect(rows.every((row) => row.active)).toBe(true);
    expect(rows.every((row) => row.source === 'KEYWORD_FIELD')).toBe(true);
  });

  it('keeps the keyword field in the order it was typed', async () => {
    const appId = await seedApp();

    const result = await asWorkspace(app, () =>
      keywords.setKeywordField(appId, FIELD),
    );

    expect(result.tracked.map((item) => item.text)).toEqual(FIELD.split(','));
  });

  it('reactivates a deactivated keyword when it is added again', async () => {
    const appId = await seedApp();
    await asWorkspace(app, () => keywords.addManual(appId, [PHRASE]));
    const [tracked] = await trackedRows(appId);
    await prisma.trackedKeyword.update({
      where: { appId_keywordId: { appId, keywordId: tracked.keywordId } },
      data: { active: false, source: 'TITLE' },
    });

    await asWorkspace(app, () => keywords.addManual(appId, [PHRASE]));

    expect(await trackedRows(appId)).toEqual([
      expect.objectContaining({ active: true, source: 'TITLE' }),
    ]);
  });

  it('takes a keyword over for the keyword field when it is tracked elsewhere', async () => {
    const appId = await seedApp();
    await asWorkspace(app, () => keywords.addManual(appId, [PHRASE]));

    await asWorkspace(app, () => keywords.setKeywordField(appId, PHRASE));

    expect(await trackedRows(appId)).toEqual([
      expect.objectContaining({ active: true, source: 'KEYWORD_FIELD' }),
    ]);
  });
});
