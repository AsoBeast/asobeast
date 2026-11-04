import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import type { AlertBatchPayload, RankDroppedPayload } from '@asobeast/shared';
import { Queue } from 'bullmq';
import { App } from 'supertest/types';
import { AlertsWorker } from '../src/alerts/alerts.worker';
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
  const send = jest.fn<Promise<void>, [{ text: string }]>();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailerService)
      .useValue({ enabled: true, send, origin: null })
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
    send.mockReset().mockResolvedValue(undefined);
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "AlertEvent", "EmailAlert" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  const subscribe = (
    email: string,
    rankDropThreshold: number | null,
    defaultOrigin = false,
  ) =>
    prisma.emailAlert.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        email,
        events: ['rank.dropped'],
        rankDropThreshold,
        confirmedAt: new Date(),
        defaultOrigin,
      },
    });

  const seedApp = () =>
    prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: 'threshold-app',
        country: 'us',
        name: 'Threshold',
      },
    });

  const queueDrop = (appId: string, keywordId: string) => {
    const payload: RankDroppedPayload = {
      event: 'rank.dropped',
      occurredAt: new Date().toISOString(),
      app: { id: appId, name: 'Threshold' },
      keyword: {
        id: keywordId,
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
    return prisma.alertEvent.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        event: 'rank.dropped',
        appId,
        dedupeKey: `rank:${appId}:${keywordId}:today`,
        payload: { ...payload },
      },
    });
  };

  const queuedFor = async (emailAlertId: string) =>
    (
      await app
        .get<Queue<DeliverEmailPayload>>(getQueueToken(QUEUES.ALERTS), {
          strict: false,
        })
        .getJobs(['wait', 'paused', 'delayed', 'waiting-children'])
    ).filter((job) => job.data.emailAlertId === emailAlertId);

  it('mails a seven place drop only to the subscription it reaches', async () => {
    const tracked = await seedApp();
    const loose = await subscribe('loose@example.com', 5);
    const strict = await subscribe('strict@example.com', 10);
    await queueDrop(tracked.id, 'kw1');

    await api.post('/alerts/flush').expect(201);

    const mailed = [
      ...(await queuedFor(loose.id)),
      ...(await queuedFor(strict.id)),
    ];
    expect(mailed.map((job) => job.data.emailAlertId)).toEqual([loose.id]);
    expect(
      (mailed[0].data.payload as AlertBatchPayload).apps[0].rankDrops,
    ).toEqual([expect.objectContaining({ to: 10, threshold: 5 })]);
    const rows = await prisma.alertEvent.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].flushedAt).not.toBeNull();
    for (const job of mailed) await job.remove();
  });

  it('opens only the first essential alerts email with the sentence', async () => {
    const tracked = await seedApp();
    const essential = await subscribe('owner@example.com', null, true);
    const sentence =
      'You are getting this because AsoBeast turns on the essential alerts for new apps.';
    const deliver = async (keywordId: string) => {
      await queueDrop(tracked.id, keywordId);
      await api.post('/alerts/flush').expect(201);
      const [job] = await queuedFor(essential.id);
      await app.get(AlertsWorker).process(job);
      await job.remove();
    };

    await deliver('kw-first');
    const [[first]] = send.mock.calls;
    expect(first.text).toContain(sentence);
    const stored = await prisma.emailAlert.findUniqueOrThrow({
      where: { id: essential.id },
    });
    expect(stored.introSentAt).not.toBeNull();

    await deliver('kw-second');
    const [, [second]] = send.mock.calls;
    expect(second.text).not.toContain(sentence);
  });
});
