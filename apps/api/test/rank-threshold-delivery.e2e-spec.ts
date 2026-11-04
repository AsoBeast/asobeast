import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import type { AlertBatchPayload, RankDroppedPayload } from '@asobeast/shared';
import { Queue } from 'bullmq';
import { App } from 'supertest/types';
import { MailerService } from '../src/alerts/mailer.service';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { DeliverEmailPayload, QUEUES } from '../src/jobs/jobs.types';
import { ownerAgent, useCookies } from './helpers/session';
import { testDb } from './helpers/test-db';
import { obliterateQueues, pauseQueues } from './obliterate-queues';

describe('rank drop threshold per subscription (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let api: Awaited<ReturnType<typeof ownerAgent>>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailerService)
      .useValue({ enabled: true, send: jest.fn() })
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
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "AlertEvent", "EmailAlert" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  const subscribe = (email: string, rankDropThreshold: number | null) =>
    prisma.emailAlert.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        email,
        events: ['rank.dropped'],
        rankDropThreshold,
        confirmedAt: new Date(),
      },
    });

  it('mails a seven place drop only to the subscription it reaches', async () => {
    const tracked = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: 'threshold-app',
        country: 'us',
        name: 'Threshold',
      },
    });
    const loose = await subscribe('loose@example.com', 5);
    const strict = await subscribe('strict@example.com', 10);
    const payload: RankDroppedPayload = {
      event: 'rank.dropped',
      occurredAt: new Date().toISOString(),
      app: { id: tracked.id, name: 'Threshold' },
      keyword: {
        id: 'kw1',
        text: 'habit tracker',
        store: 'APP_STORE',
        country: 'us',
      },
      from: 3,
      to: 10,
      fromDepth: 200,
      toDepth: 200,
      threshold: 5,
    };
    await prisma.alertEvent.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        event: 'rank.dropped',
        appId: tracked.id,
        dedupeKey: `rank:${tracked.id}:kw1:today`,
        payload: { ...payload },
      },
    });

    await api.post('/alerts/flush').expect(201);

    const jobs = await app
      .get<Queue<DeliverEmailPayload>>(getQueueToken(QUEUES.ALERTS), {
        strict: false,
      })
      .getJobs(['wait', 'paused', 'delayed', 'waiting-children']);
    const mailed = jobs.filter((job) =>
      [loose.id, strict.id].includes(job.data.emailAlertId),
    );
    expect(mailed.map((job) => job.data.emailAlertId)).toEqual([loose.id]);
    expect(
      (mailed[0].data.payload as AlertBatchPayload).apps[0].rankDrops,
    ).toEqual([expect.objectContaining({ to: 10, threshold: 5 })]);
    const rows = await prisma.alertEvent.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].flushedAt).not.toBeNull();
  });
});
