import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import {
  AppDetail,
  ChangeTimeline,
  MetadataAuditResult,
} from '@asobeast/shared';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { RetentionService } from '../src/jobs/retention.service';
import { obliterateQueues, settleBootRegistration } from './obliterate-queues';
import { testDb } from './helpers/test-db';
import { ownerAgent, useCookies } from './helpers/session';

describe('listing reads beside a localized listing (e2e)', () => {
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

  const createApp = () =>
    prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '6657987209',
        country: 'pl',
        name: 'Where Am I?',
      },
    });

  const snapshot = (
    appId: string,
    localization: string | null,
    title: string,
    capturedAt: string,
  ) => ({
    appId,
    country: null,
    localization,
    title,
    description: `${title} description`,
    raw: {},
    capturedAt: new Date(capturedAt),
  });

  it('reads the default listing although a newer localized one exists', async () => {
    const { id: appId } = await createApp();
    await prisma.appSnapshot.createMany({
      data: [
        snapshot(appId, null, 'Default title', '2026-10-01T00:00:00.000Z'),
        snapshot(appId, 'pl', 'Polski tytuł', '2026-10-02T00:00:00.000Z'),
      ],
    });
    await prisma.changeEvent.create({
      data: {
        appId,
        localization: 'pl',
        field: 'title',
        before: 'Stary tytuł',
        after: 'Polski tytuł',
      },
    });

    const detail = (await api.get(`/apps/${appId}`).expect(200))
      .body as AppDetail;
    expect(detail.latestSnapshot?.title).toBe('Default title');

    const audit = (await api.get(`/apps/${appId}/metadata/audit`).expect(200))
      .body as MetadataAuditResult;
    expect(audit.fields.find((field) => field.field === 'title')?.value).toBe(
      'Default title',
    );

    const recent = (await api.get('/changes/recent').expect(200))
      .body as ChangeTimeline;
    expect(recent.events).toEqual([]);
  });

  it('keeps the newest snapshot of every listing and localization', async () => {
    const { id: appId } = await createApp();
    await prisma.appSnapshot.createMany({
      data: [
        snapshot(appId, null, 'Default old', '2025-01-01T00:00:00.000Z'),
        snapshot(appId, null, 'Default new', '2025-02-01T00:00:00.000Z'),
        snapshot(appId, 'pl', 'Polski stary', '2025-01-05T00:00:00.000Z'),
        snapshot(appId, 'pl', 'Polski nowy', '2025-02-05T00:00:00.000Z'),
      ],
    });

    await app.get(RetentionService).prune();

    const remaining = await prisma.appSnapshot.findMany({
      where: { appId },
      orderBy: { capturedAt: 'asc' },
      select: { localization: true, title: true },
    });
    expect(remaining).toEqual([
      { localization: null, title: 'Default new' },
      { localization: 'pl', title: 'Polski nowy' },
    ]);
  });
});
