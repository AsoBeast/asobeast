import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import {
  AlertDeliveryItem,
  AlertsConfig,
  ApiErrorEnvelope,
  EmailAlertItem,
  WebhookTestResult,
} from '@asobeast/shared';
import { App } from 'supertest/types';
import { MailerService } from '../src/alerts/mailer.service';
import { AppModule } from '../src/app.module';
import { testDb } from './helpers/test-db';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { ownerAgent, useCookies } from './helpers/session';
import {
  clearRateLimitCounters,
  obliterateQueues,
  settleBootRegistration,
} from './obliterate-queues';

function migrate(): void {
  execSync('pnpm prisma migrate deploy', {
    cwd: join(__dirname, '..'),
    env: process.env,
    stdio: 'ignore',
  });
}

async function seedWorkspace(prisma: PrismaClient): Promise<void> {
  await prisma.workspace.upsert({
    where: { id: DEFAULT_WORKSPACE_ID },
    update: {},
    create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
  });
}

describe('EmailAlertsController (e2e, smtp enabled)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let api: Awaited<ReturnType<typeof ownerAgent>>;
  const send = jest.fn().mockResolvedValue(undefined);

  beforeAll(async () => {
    migrate();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailerService)
      .useValue({ enabled: true, send })
      .compile();

    app = moduleFixture.createNestApplication();
    useCookies(app);
    await app.init();
    await settleBootRegistration(app);
    prisma = testDb();
    await seedWorkspace(prisma);
    api = await ownerAgent(app);
  });

  beforeEach(async () => {
    send.mockClear();
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "EmailAlert", "Webhook", "AlertDelivery" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  it('reports email as enabled', async () => {
    const response = await api.get('/alerts/config').expect(200);
    expect(response.body as AlertsConfig).toEqual({ emailEnabled: true });
  });

  it('runs the full crud round trip', async () => {
    const created = await api
      .post('/email-alerts')
      .send({
        email: 'ops@example.com',
        events: ['metadata.changed', 'rank.dropped'],
      })
      .expect(201);
    const alert = created.body as EmailAlertItem;
    expect(alert.email).toBe('ops@example.com');
    expect(alert.active).toBe(true);
    expect(alert.events).toEqual(['metadata.changed', 'rank.dropped']);

    const listed = await api.get('/email-alerts').expect(200);
    expect(listed.body as EmailAlertItem[]).toHaveLength(1);

    const patched = await api
      .patch(`/email-alerts/${alert.id}`)
      .send({ active: false, email: 'team@example.com' })
      .expect(200);
    const updated = patched.body as EmailAlertItem;
    expect(updated.active).toBe(false);
    expect(updated.email).toBe('team@example.com');

    await api.delete(`/email-alerts/${alert.id}`).expect(204);
    const empty = await api.get('/email-alerts').expect(200);
    expect(empty.body as EmailAlertItem[]).toHaveLength(0);
  });

  it('accepts the milestone, first rank and overtake events', async () => {
    const created = await api
      .post('/email-alerts')
      .send({
        email: 'ops@example.com',
        events: ['rank.milestone', 'rank.first', 'rank.overtaken'],
      })
      .expect(201);

    expect((created.body as EmailAlertItem).events).toEqual([
      'rank.milestone',
      'rank.first',
      'rank.overtaken',
    ]);
  });

  it('accepts, keeps and replaces the star filter of a new review alert', async () => {
    await clearRateLimitCounters(app);
    const created = await api
      .post('/email-alerts')
      .send({
        email: 'ops@example.com',
        events: ['review.new'],
        reviewScores: [2, 1, 2],
      })
      .expect(201);
    const alert = created.body as EmailAlertItem;
    expect(alert).toMatchObject({
      events: ['review.new'],
      reviewScores: [1, 2],
    });

    const listed = await api.get('/email-alerts').expect(200);
    expect((listed.body as EmailAlertItem[])[0].reviewScores).toEqual([1, 2]);

    const kept = await api
      .patch(`/email-alerts/${alert.id}`)
      .send({ events: ['review.new', 'rank.dropped'] })
      .expect(200);
    expect((kept.body as EmailAlertItem).reviewScores).toEqual([1, 2]);

    const moved = await api
      .patch(`/email-alerts/${alert.id}`)
      .send({ email: 'team@example.com' })
      .expect(200);
    expect((moved.body as EmailAlertItem).reviewScores).toEqual([1, 2]);

    const replaced = await api
      .patch(`/email-alerts/${alert.id}`)
      .send({ email: 'crew@example.com', reviewScores: [5] })
      .expect(200);
    expect((replaced.body as EmailAlertItem).reviewScores).toEqual([5]);

    const cleared = await api
      .patch(`/email-alerts/${alert.id}`)
      .send({ reviewScores: [] })
      .expect(200);
    expect((cleared.body as EmailAlertItem).reviewScores).toEqual([]);

    await api
      .patch(`/email-alerts/${alert.id}`)
      .send({ reviewScores: [9] })
      .expect(400);
  });

  it('stores every star for an email alert created without a filter', async () => {
    await clearRateLimitCounters(app);
    const created = await api
      .post('/email-alerts')
      .send({ email: 'ops@example.com', events: ['review.new'] })
      .expect(201);

    expect((created.body as EmailAlertItem).reviewScores).toEqual([]);
  });

  it('replaces only the events of an email alert', async () => {
    const created = await api
      .post('/email-alerts')
      .send({ email: 'ops@example.com', events: ['metadata.changed'] })
      .expect(201);
    const alert = created.body as EmailAlertItem;

    const patched = await api
      .patch(`/email-alerts/${alert.id}`)
      .send({ events: ['rank.first'] })
      .expect(200);

    expect(patched.body as EmailAlertItem).toMatchObject({
      events: ['rank.first'],
      email: 'ops@example.com',
    });
  });

  it('rejects an invalid email', async () => {
    await api
      .post('/email-alerts')
      .send({ email: 'not-an-email', events: ['metadata.changed'] })
      .expect(400);
  });

  it.each([{ email: null }, { events: null }, { active: null }])(
    'rejects a null field when updating an alert: %o',
    async (patch) => {
      const created = await api
        .post('/email-alerts')
        .send({ email: 'ops@example.com', events: ['metadata.changed'] })
        .expect(201);
      const alert = created.body as EmailAlertItem;

      const response = await api
        .patch(`/email-alerts/${alert.id}`)
        .send(patch)
        .expect(400);
      expect((response.body as ApiErrorEnvelope).statusCode).toBe(400);

      const stored = await prisma.emailAlert.findUniqueOrThrow({
        where: { id: alert.id },
      });
      expect(stored.email).toBe('ops@example.com');
      expect(stored.events).toEqual(['metadata.changed']);
      expect(stored.active).toBe(true);
    },
  );

  it('mails nobody an address cannot confirm without a web origin to link to', async () => {
    const created = await api
      .post('/email-alerts')
      .send({ email: 'stranger@example.net', events: ['metadata.changed'] })
      .expect(201);
    const alert = created.body as EmailAlertItem;

    const response = await api
      .post(`/email-alerts/${alert.id}/test`)
      .expect(201);

    expect(alert.confirmed).toBe(false);
    expect(alert.confirmationSent).toBe(false);
    expect(response.body as WebhookTestResult).toEqual({
      delivered: false,
      status: null,
    });
    expect(send).not.toHaveBeenCalled();
  });

  it('answers a missing web origin with 503 before the resend cooldown', async () => {
    const created = await api
      .post('/email-alerts')
      .send({ email: 'stranger@example.net', events: ['metadata.changed'] })
      .expect(201);
    await prisma.emailAlert.update({
      where: { id: (created.body as EmailAlertItem).id },
      data: { confirmationSentAt: new Date() },
    });

    const refused = await api
      .post(
        `/email-alerts/${(created.body as EmailAlertItem).id}/resend-confirmation`,
      )
      .expect(503);

    expect((refused.body as ApiErrorEnvelope).message).toContain(
      'WEB_PUBLIC_URL',
    );
  });

  it('sends a sample through the test endpoint', async () => {
    const alert = await prisma.emailAlert.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        email: 'ops@example.com',
        events: ['metadata.changed'],
        confirmedAt: new Date(),
      },
    });

    const response = await api
      .post(`/email-alerts/${alert.id}/test`)
      .expect(201);
    expect(response.body as WebhookTestResult).toEqual({
      delivered: true,
      status: null,
    });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('lists deliveries filtered by a single channel', async () => {
    const alert = await prisma.emailAlert.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        email: 'ops@example.com',
        events: ['metadata.changed'],
      },
    });
    await prisma.alertDelivery.create({
      data: {
        channel: 'email',
        emailAlertId: alert.id,
        event: 'metadata.changed',
        status: 'success',
        attempt: 1,
      },
    });
    const webhook = await prisma.webhook.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        url: 'https://hooks.example.com/x',
        events: ['rank.dropped'],
      },
    });
    await prisma.alertDelivery.create({
      data: {
        channel: 'webhook',
        webhookId: webhook.id,
        event: 'rank.dropped',
        status: 'failed',
        detail: 'boom',
        attempt: 2,
      },
    });

    const byEmail = await api
      .get(`/alerts/deliveries?emailAlertId=${alert.id}`)
      .expect(200);
    const emailRows = byEmail.body as AlertDeliveryItem[];
    expect(emailRows).toHaveLength(1);
    expect(emailRows[0].channel).toBe('email');
    expect(emailRows[0].status).toBe('success');

    const byWebhook = await api
      .get(`/alerts/deliveries?webhookId=${webhook.id}`)
      .expect(200);
    const webhookRows = byWebhook.body as AlertDeliveryItem[];
    expect(webhookRows).toHaveLength(1);
    expect(webhookRows[0].detail).toBe('boom');
    expect(webhookRows[0].attempt).toBe(2);
  });

  it('requires exactly one channel filter', async () => {
    await api.get('/alerts/deliveries').expect(400);
    await api.get('/alerts/deliveries?webhookId=a&emailAlertId=b').expect(400);
  });
});

describe('EmailAlertsController (e2e, smtp disabled)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let api: Awaited<ReturnType<typeof ownerAgent>>;

  beforeAll(async () => {
    migrate();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailerService)
      .useValue({ enabled: false, send: jest.fn() })
      .compile();

    app = moduleFixture.createNestApplication();
    useCookies(app);
    await app.init();
    await settleBootRegistration(app);
    prisma = testDb();
    await seedWorkspace(prisma);
    api = await ownerAgent(app);
  });

  afterAll(async () => {
    await obliterateQueues(app);
    await app.close();
  });

  it('reports email as disabled', async () => {
    const response = await api.get('/alerts/config').expect(200);
    expect(response.body as AlertsConfig).toEqual({ emailEnabled: false });
  });

  it('rejects creation with a 400 envelope', async () => {
    const response = await api
      .post('/email-alerts')
      .send({ email: 'ops@example.com', events: ['metadata.changed'] })
      .expect(400);
    const body = response.body as ApiErrorEnvelope;
    expect(body.statusCode).toBe(400);
    expect(body.message).toContain('SMTP configuration');
  });
});
