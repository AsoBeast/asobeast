import { Store } from '@prisma/client';
import type { Job } from 'bullmq';
import { AlertsWorker } from '../src/alerts/alerts.worker';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import {
  DeliverEmailPayload,
  JOBS,
  QUEUES,
  utcDateKey,
} from '../src/jobs/jobs.types';
import { PipelineWorker } from '../src/jobs/pipeline.worker';
import {
  createPipelineHarness,
  type PipelineHarness,
} from './helpers/pipeline-harness';

const OWNER_EMAIL = 'essential-owner@example.com';
const SENTENCE =
  'You are getting this because AsoBeast turns on the essential alerts for new apps.';

describe('essential alerts after the daily run (e2e)', () => {
  jest.setTimeout(30_000);

  let harness: PipelineHarness;
  let ownerId: string;

  beforeAll(async () => {
    harness = await createPipelineHarness();
    Object.assign(harness.mailer, { origin: 'https://aso.example.com' });
    const owner = await harness.prisma.user.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        email: OWNER_EMAIL,
        passwordHash: 'unused',
        role: 'owner',
        emailVerifiedAt: new Date(),
        createdAt: new Date('2000-01-01T00:00:00.000Z'),
      },
    });
    ownerId = owner.id;
  });

  beforeEach(async () => {
    await harness.reset();
    await harness.prisma.workspace.update({
      where: { id: DEFAULT_WORKSPACE_ID },
      data: { defaultAlertsAt: null, suspendedAt: null },
    });
  });

  afterEach(() => harness.settle());

  afterAll(async () => {
    await harness.prisma.user.delete({ where: { id: ownerId } });
    Object.assign(harness.mailer, { origin: null });
    await harness.close();
  });

  const today = utcDateKey();

  const seedDropToday = async () => {
    const primary = await harness.seedApp(Store.APP_STORE, 'essential-app');
    const keyword = await harness.seedKeyword(
      primary.id,
      Store.APP_STORE,
      'essential keyword',
    );
    await harness.prisma.keywordRanking.create({
      data: {
        appId: primary.id,
        workspaceId: DEFAULT_WORKSPACE_ID,
        keywordId: keyword.id,
        date: new Date(`${today}T00:00:00.000Z`),
        position: 15,
      },
    });
    return { primary, keyword };
  };

  const queueDrop = (appId: string, keywordId: string, key: string) =>
    harness.prisma.alertEvent.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        appId,
        event: 'rank.dropped',
        dedupeKey: key,
        payload: {
          event: 'rank.dropped',
          occurredAt: new Date().toISOString(),
          app: { id: appId, name: 'Essential' },
          keyword: {
            id: keywordId,
            text: 'essential keyword',
            store: 'APP_STORE',
            country: 'us',
          },
          from: 4,
          to: 15,
          fromDepth: 200,
          toDepth: 200,
          threshold: 5,
          confirmed: true,
        },
      },
    });

  const complete = async () => {
    await harness.app.get(PipelineWorker).process({
      name: JOBS.DAILY_COMPLETE,
      data: { date: today, apps: 1, keywords: 1, categories: 0, reviews: 0 },
    } as Job);
    const jobs = (await harness.allJobs(QUEUES.ALERTS)).filter(
      (job) => job.name === JOBS.DELIVER_EMAIL,
    ) as Job<DeliverEmailPayload>[];
    for (const job of jobs) {
      await harness.app.get(AlertsWorker).process(job);
      await job.remove();
    }
  };

  const mails = () =>
    harness.mailer.send.mock.calls.map(
      ([mail]) => mail as { to: string; subject: string; text: string },
    );

  it('creates the essential alert and mails its report in the same run', async () => {
    const { primary, keyword } = await seedDropToday();
    await queueDrop(primary.id, keyword.id, 'first-drop');

    await complete();

    const alerts = await harness.prisma.emailAlert.findMany();
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      email: OWNER_EMAIL,
      defaultOrigin: true,
    });
    expect(mails()).toHaveLength(1);
    expect(mails()[0].to).toBe(OWNER_EMAIL);
    expect(mails()[0].subject.startsWith('[asobeast]')).toBe(true);
    expect(mails()[0].text).toContain(SENTENCE);

    await queueDrop(primary.id, keyword.id, 'second-drop');
    await complete();

    expect(await harness.prisma.emailAlert.count()).toBe(1);
    expect(mails()).toHaveLength(2);
    expect(mails()[1].text).not.toContain(SENTENCE);
  });

  it('creates nothing for a suspended workspace and keeps its marker open', async () => {
    await seedDropToday();
    await harness.prisma.workspace.update({
      where: { id: DEFAULT_WORKSPACE_ID },
      data: { suspendedAt: new Date() },
    });

    await complete();

    expect(await harness.prisma.emailAlert.count()).toBe(0);
    const workspace = await harness.prisma.workspace.findUniqueOrThrow({
      where: { id: DEFAULT_WORKSPACE_ID },
    });
    expect(workspace.defaultAlertsAt).toBeNull();
  });

  it('creates nothing for a workspace that already has a webhook', async () => {
    await seedDropToday();
    await harness.seedWebhook();

    await complete();

    expect(await harness.prisma.emailAlert.count()).toBe(0);
  });
});
