import './helpers/enable-screenshot-ocr';
import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { KeywordSource, PrismaClient, Store } from '@prisma/client';
import { MetadataAuditResult } from '@asobeast/shared';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { ownerAgent, useCookies } from './helpers/session';
import { appleKey, appleShot } from './helpers/screenshot-store';
import { testDb } from './helpers/test-db';
import { obliterateQueues, pauseQueues } from './obliterate-queues';

const D0 = new Date('2026-07-01T00:00:00.000Z');

const DEFAULT_ROWS = [
  { status: 'read', caption: 'Track every habit' },
  { status: 'blank', caption: null },
  { status: 'read', caption: 'Your habit tracker, simplified' },
];

describe('Screenshot text in the metadata audit (e2e)', () => {
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
    await pauseQueues(app);

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
      'TRUNCATE TABLE "App", "Keyword", "AppGroup", "ScreenshotText" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  const seed = async (
    store: Store = Store.APP_STORE,
    rows: Array<{ status: string; caption: string | null }> = DEFAULT_ROWS,
  ): Promise<string> => {
    const created = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store,
        storeAppId: '111',
        country: 'us',
        name: 'Focus Timer',
      },
    });
    const snapshot = await prisma.appSnapshot.create({
      data: {
        appId: created.id,
        title: 'Focus Timer',
        subtitle: 'Pomodoro sessions',
        description: 'A description',
        raw: {},
        capturedAt: D0,
      },
    });
    const tracked: Array<[string, KeywordSource]> = [
      ['habit tracker', KeywordSource.MANUAL],
      ['focus timer', KeywordSource.TITLE],
    ];
    for (const [text, source] of tracked) {
      const keyword = await prisma.keyword.create({
        data: { text, store, country: 'us' },
      });
      await prisma.trackedKeyword.create({
        data: {
          appId: created.id,
          keywordId: keyword.id,
          source,
          active: true,
        },
      });
    }
    await prisma.snapshotScreenshot.createMany({
      data: rows.map((row, index) => ({
        snapshotId: snapshot.id,
        workspaceId: DEFAULT_WORKSPACE_ID,
        position: index + 1,
        url: appleShot(index + 1),
        assetKey: appleKey(index + 1),
        ...row,
      })),
    });
    return created.id;
  };

  const audit = async (id: string) =>
    (await api.get(`/apps/${id}/metadata/audit`).expect(200))
      .body as MetadataAuditResult;

  const row = (result: MetadataAuditResult, text: string) =>
    result.coverage.find((item) => item.text === text);

  it('reports the state and, per keyword, the screenshots whose caption contains it', async () => {
    const result = await audit(await seed());

    expect(result.screenshotText).toEqual({
      status: 'ready',
      read: 2,
      total: 3,
    });
    expect(row(result, 'habit tracker')?.screenshotText).toEqual({
      covered: true,
      positions: [3],
    });
    expect(row(result, 'focus timer')?.screenshotText).toEqual({
      covered: false,
      positions: [],
    });
  });

  it('never lets screenshot text change what counts as covered', async () => {
    const result = await audit(await seed());

    const habit = row(result, 'habit tracker');
    expect(habit?.uncovered).toBe(true);
    expect(habit?.fields.map((field) => field.field)).toEqual([
      'title',
      'subtitle',
      'keywordField',
    ]);
    expect(habit?.fields.every((field) => !field.covered)).toBe(true);
  });

  it('says the captions are still being read and adds nothing per keyword', async () => {
    const id = await seed();
    await prisma.snapshotScreenshot.updateMany({
      where: { position: 2 },
      data: { status: 'pending' },
    });

    const result = await audit(id);

    expect(result.screenshotText?.status).toBe('reading');
    expect(result.coverage.some((item) => 'screenshotText' in item)).toBe(
      false,
    );
  });

  it('leaves a google play audit exactly as it was', async () => {
    const result = await audit(await seed(Store.GOOGLE_PLAY));

    expect('screenshotText' in result).toBe(false);
    expect(result.coverage.some((item) => 'screenshotText' in item)).toBe(
      false,
    );
  });

  it('reports an app store app with no recorded screenshots as empty', async () => {
    const result = await audit(await seed(Store.APP_STORE, []));

    expect(result.screenshotText).toEqual({
      status: 'empty',
      read: 0,
      total: 0,
    });
  });
});
