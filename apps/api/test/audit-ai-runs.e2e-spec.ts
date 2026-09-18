import { execSync } from 'child_process';
import { join } from 'path';
import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import { AppAuditResult, AuditAiRunResult } from '@asobeast/shared';
import { Queue } from 'bullmq';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AiClient, OPENAI_CLIENT } from '../src/ai/openai.client';
import { AuditAiRunsService } from '../src/audit/audit-ai-runs.service';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { QUEUES } from '../src/jobs/jobs.types';
import { testDb } from './helpers/test-db';
import { ownerAgent, useCookies } from './helpers/session';
import { asWorkspace } from './helpers/tenancy';
import { obliterateQueues, pauseQueues } from './obliterate-queues';

const D0 = new Date('2026-07-01T00:00:00.000Z');

const OBSERVATIONS = {
  icon: {
    hasText: false,
    elementCount: 'one',
    contrast: 'high',
    similarCompetitorPosition: null,
  },
  screenshots: [
    {
      position: 1,
      captionText: 'Build one habit',
      captionReadable: true,
      captionLanguage: 'en',
      message: 'benefit',
    },
  ],
  consistentStyle: true,
};

const structured = jest.fn();
const fakeAiClient: AiClient = { model: 'gpt-5.6-luna', structured };

describe('Audit creative runs (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let api: Awaited<ReturnType<typeof ownerAgent>>;

  const jobsOn = (name: string) =>
    app.get<Queue>(getQueueToken(name), { strict: false }).getJobs();

  beforeAll(async () => {
    execSync('pnpm prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'ignore',
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(OPENAI_CLIENT)
      .useValue(fakeAiClient)
      .compile();

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
    structured.mockReset();
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword" RESTART IDENTITY CASCADE',
    );
    await obliterateQueues(app);
    await pauseQueues(app);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  const seedApp = async (
    storeAppId: string,
    raw: Record<string, unknown>,
    isCompetitor = false,
  ): Promise<string> => {
    const created = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId,
        country: 'us',
        name: 'Habit Tracker',
        isCompetitor,
      },
    });
    await prisma.appSnapshot.create({
      data: {
        appId: created.id,
        title: 'Habit Tracker',
        description: 'Build better habits every single day.',
        ratingAvg: 4.6,
        ratingCount: 5000,
        storeUpdatedAt: D0,
        raw,
        capturedAt: D0,
      },
    });
    return created.id;
  };

  const seed = () =>
    seedApp('1234567890', {
      icon: 'https://cdn.example.com/icon.png',
      screenshots: ['s0.png', 's1.png'],
    });

  const runClaimed = (id: string): Promise<void> =>
    asWorkspace(app, async () => {
      const runs = app.get(AuditAiRunsService);
      const requestedAt = await runs.start(id);
      await runs.execute(id, requestedAt!);
    });

  const replaceScreenshots = async (
    appId: string,
    screenshots: string[],
  ): Promise<void> => {
    await prisma.appSnapshot.create({
      data: {
        appId,
        title: 'Habit Tracker',
        description: 'Build better habits every single day.',
        ratingAvg: 4.6,
        ratingCount: 5000,
        storeUpdatedAt: D0,
        raw: { icon: 'https://cdn.example.com/icon.png', screenshots },
        capturedAt: new Date('2026-07-02T00:00:00.000Z'),
      },
    });
  };

  it('queues a run and answers 202 immediately while the model is slow', async () => {
    structured.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(OBSERVATIONS), 60_000),
        ),
    );
    const id = await seed();

    const started = Date.now();
    const response = await api.post(`/apps/${id}/audit/ai/runs`).expect(202);

    expect(Date.now() - started).toBeLessThan(500);
    expect(response.body as AuditAiRunResult).toMatchObject({
      state: 'queued',
      reused: false,
      error: null,
    });
    expect(await jobsOn(QUEUES.AI)).toHaveLength(1);
  });

  it('reuses the analysis of an unchanged listing', async () => {
    structured.mockResolvedValue(OBSERVATIONS);
    const id = await seed();

    await api.post(`/apps/${id}/audit/ai/runs`).expect(202);
    await runClaimed(id);
    const again = await api.post(`/apps/${id}/audit/ai/runs`).expect(202);

    expect(again.body as AuditAiRunResult).toMatchObject({
      state: 'completed',
      reused: true,
    });
    expect(structured).toHaveBeenCalledTimes(1);
  });

  it('reports the run through the audit, and records today once it completes', async () => {
    structured.mockResolvedValue(OBSERVATIONS);
    const id = await seed();

    await api.post(`/apps/${id}/audit/ai/runs`).expect(202);
    const queued = (await api.get(`/apps/${id}/audit`).expect(200))
      .body as AppAuditResult;
    expect(queued.ai.run).toMatchObject({ state: 'queued' });

    await runClaimed(id);
    const audit = (await api.get(`/apps/${id}/audit`).expect(200))
      .body as AppAuditResult;

    expect(audit.ai.run).toMatchObject({ state: 'completed' });
    expect(audit.creative?.screenshots.length).toBeGreaterThan(0);
    expect(
      await prisma.auditScore.findFirst({ where: { appId: id } }),
    ).toMatchObject({ rubricVersion: 'v2' });
  });

  it('marks the analysis stale when the screenshots change, and queues again', async () => {
    structured.mockResolvedValue(OBSERVATIONS);
    const id = await seed();
    await api.post(`/apps/${id}/audit/ai/runs`).expect(202);
    await runClaimed(id);

    await replaceScreenshots(id, ['n1.png', 'n2.png']);

    const stale = (await api.get(`/apps/${id}/audit`).expect(200))
      .body as AppAuditResult;
    expect(stale.creative?.stale).toBe(true);
    expect(
      (await api.post(`/apps/${id}/audit/ai/runs`).expect(202))
        .body as AuditAiRunResult,
    ).toMatchObject({ state: 'queued', reused: false });
  });

  it('records a final failure as a failed run the audit reports', async () => {
    structured.mockResolvedValue({ nonsense: true });
    const id = await seed();
    await api.post(`/apps/${id}/audit/ai/runs`).expect(202);

    await asWorkspace(app, async () => {
      const runs = app.get(AuditAiRunsService);
      const requestedAt = await runs.start(id);
      await runs
        .execute(id, requestedAt!)
        .catch(() =>
          runs.fail(
            id,
            requestedAt!,
            'The model returned observations that do not match the schema.',
          ),
        );
    });

    const audit = (await api.get(`/apps/${id}/audit`).expect(200))
      .body as AppAuditResult;
    expect(audit.ai.run).toMatchObject({
      state: 'failed',
      error: 'The model returned observations that do not match the schema.',
    });
  });

  it('refuses an unknown app', async () => {
    await api.post('/apps/missing/audit/ai/runs').expect(404);
  });

  it('refuses a competitor row', async () => {
    const id = await seedApp('9999999999', { icon: 'i.png' }, true);

    await api.post(`/apps/${id}/audit/ai/runs`).expect(422);
  });

  it('refuses a listing with nothing to analyze', async () => {
    const id = await seedApp('8888888888', {});

    await api.post(`/apps/${id}/audit/ai/runs`).expect(422);
  });
});

describe('Audit creative runs without an AI key (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let api: Awaited<ReturnType<typeof ownerAgent>>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(OPENAI_CLIENT)
      .useValue(null)
      .compile();

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

  afterAll(async () => {
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  it('answers 409 without a key', async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword" RESTART IDENTITY CASCADE',
    );
    const created = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '5555555555',
        country: 'us',
        name: 'No Key App',
      },
    });

    await api.post(`/apps/${created.id}/audit/ai/runs`).expect(409);
  });
});
