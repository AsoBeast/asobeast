import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import { ESSENTIAL_ALERT_EVENTS } from '@asobeast/shared';
import { App } from 'supertest/types';
import { DefaultAlertsService } from '../src/alerts/default-alerts.service';
import { MailerService } from '../src/alerts/mailer.service';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { OWNER, ownerAgent, useCookies } from './helpers/session';
import { asWorkspace } from './helpers/tenancy';
import { testDb } from './helpers/test-db';
import { obliterateQueues, pauseQueues } from './obliterate-queues';

const OTHER_WORKSPACE = 'ws_default_alerts_other';

describe('essential email alerts (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let defaults: DefaultAlertsService;
  const send = jest.fn<Promise<void>, [{ to: string; subject: string }]>();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailerService)
      .useValue({
        enabled: true,
        origin: 'https://aso.example.com',
        send,
        sendAccountMail: send,
      })
      .compile();
    app = moduleFixture.createNestApplication();
    useCookies(app);
    await app.init();
    await pauseQueues(app);
    prisma = testDb();
    defaults = app.get(DefaultAlertsService);
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: {},
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
    await ownerAgent(app);
  });

  beforeEach(async () => {
    send.mockReset().mockResolvedValue(undefined);
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword", "EmailAlert", "Webhook" RESTART IDENTITY CASCADE',
    );
    await prisma.workspace.updateMany({ data: { defaultAlertsAt: null } });
    await verifyOwner(true);
  });

  afterAll(async () => {
    await verifyOwner(false);
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  const today = () => new Date().toISOString().slice(0, 10);

  const verifyOwner = (verified: boolean) =>
    prisma.user.update({
      where: { email: OWNER.email },
      data: { emailVerifiedAt: verified ? new Date() : null },
    });

  const rankToday = async (workspaceId = DEFAULT_WORKSPACE_ID) => {
    const tracked = await prisma.app.create({
      data: {
        workspaceId,
        store: Store.APP_STORE,
        storeAppId: `defaults-${workspaceId}`,
        country: 'us',
        name: 'Defaults',
      },
    });
    const keyword = await prisma.keyword.create({
      data: {
        text: `habit tracker ${workspaceId}`,
        store: Store.APP_STORE,
        country: 'us',
      },
    });
    await prisma.keywordRanking.create({
      data: {
        appId: tracked.id,
        workspaceId,
        keywordId: keyword.id,
        date: new Date(`${today()}T00:00:00.000Z`),
        position: 15,
      },
    });
  };

  const run = (workspaceId = DEFAULT_WORKSPACE_ID) =>
    asWorkspace(app, () => defaults.createFor(today()), workspaceId);

  it('creates one essential alert once and never again', async () => {
    await rankToday();

    await expect(run()).resolves.toBe('created');
    const [alert, ...rest] = await prisma.emailAlert.findMany();
    expect(rest).toEqual([]);
    expect(alert).toMatchObject({
      email: OWNER.email,
      events: [...ESSENTIAL_ALERT_EVENTS],
      rankDropThreshold: 10,
      confirmDrops: true,
      defaultOrigin: true,
    });
    expect(alert.confirmedAt).not.toBeNull();

    await expect(run()).resolves.toBe('settled');
    await prisma.emailAlert.deleteMany();
    await expect(run()).resolves.toBe('settled');
    expect(await prisma.emailAlert.count()).toBe(0);
  });

  it('waits for a primary app ranked on the day', async () => {
    await expect(run()).resolves.toBe('not_due');
    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { id: DEFAULT_WORKSPACE_ID },
    });
    expect(workspace.defaultAlertsAt).toBeNull();
  });

  it('leaves a workspace that already has a webhook alone', async () => {
    await rankToday();
    await prisma.webhook.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        url: 'https://hooks.example.com/existing',
        events: ['rank.dropped'],
      },
    });

    await expect(run()).resolves.toBe('settled');
    expect(await prisma.emailAlert.count()).toBe(0);
  });

  it('asks an unverified self hosted owner to confirm', async () => {
    await verifyOwner(false);
    await rankToday();

    await expect(run()).resolves.toBe('unconfirmed');
    const alert = await prisma.emailAlert.findFirstOrThrow();
    expect(alert.confirmedAt).toBeNull();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].to).toBe(OWNER.email);
  });

  it('creates nothing for a workspace without an owner', async () => {
    await prisma.workspace.upsert({
      where: { id: OTHER_WORKSPACE },
      update: { defaultAlertsAt: null },
      create: { id: OTHER_WORKSPACE, name: 'Other' },
    });
    await rankToday(OTHER_WORKSPACE);

    await expect(run(OTHER_WORKSPACE)).resolves.toBe('waiting');
  });
});
