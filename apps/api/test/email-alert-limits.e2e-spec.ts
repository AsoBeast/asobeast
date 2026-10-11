import './helpers/enable-public-url';
import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { ApiErrorEnvelope, EmailAlertItem } from '@asobeast/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { CONFIRMATIONS_PER_WORKSPACE_PER_DAY } from '../src/alerts/confirmation-mail.limiter';
import {
  MAX_EMAIL_ALERTS,
  MAX_UNCONFIRMED_EMAIL_ALERTS,
} from '../src/alerts/email-alerts.service';
import { MailerService } from '../src/alerts/mailer.service';
import { unsubscribeToken } from '../src/alerts/unsubscribe-token';
import { sha256 } from '../src/auth/password-hash';
import { windowKey } from '../src/auth/rate-limit/window';
import { FailFastRedis } from '../src/redis/fail-fast-redis';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { TEST_AUTH_SECRET } from './helpers/auth-env';
import { TEST_WEB_PUBLIC_URL } from './helpers/enable-public-url';
import { OWNER, ownerAgent, useCookies } from './helpers/session';
import {
  clearRateLimitCounters,
  obliterateQueues,
  settleBootRegistration,
} from './obliterate-queues';
import { testDb } from './helpers/test-db';

const EVENTS = ['metadata.changed'];

const DAY_SECONDS = 24 * 60 * 60;

const allowanceKey = (scope: string, label: string): string =>
  windowKey('confirmation', scope, label, DAY_SECONDS, new Date());

function migrate(): void {
  execSync('pnpm prisma migrate deploy', {
    cwd: join(__dirname, '..'),
    env: process.env,
    stdio: 'ignore',
  });
}

describe('Email alert limits (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let api: Awaited<ReturnType<typeof ownerAgent>>;
  const send = jest.fn().mockResolvedValue(undefined);
  const sendAccountMail = jest.fn().mockResolvedValue(undefined);

  beforeAll(async () => {
    migrate();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailerService)
      .useValue({
        enabled: true,
        origin: TEST_WEB_PUBLIC_URL,
        send,
        sendAccountMail,
      })
      .compile();

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
    send.mockClear();
    sendAccountMail.mockClear();
    await clearRateLimitCounters(app);
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "EmailAlert", "AlertDelivery" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  const seed = (count: number, confirmed: boolean) =>
    prisma.emailAlert.createMany({
      data: Array.from({ length: count }, (_, index) => ({
        workspaceId: DEFAULT_WORKSPACE_ID,
        email: `seed-${index}@example.net`,
        events: EVENTS,
        confirmedAt: confirmed ? new Date() : null,
      })),
    });

  it('throttles the test send like an invitation', async () => {
    const [alert] = await prisma.emailAlert.createManyAndReturn({
      data: [
        {
          workspaceId: DEFAULT_WORKSPACE_ID,
          email: 'ops@example.net',
          events: EVENTS,
          confirmedAt: new Date(),
        },
      ],
    });

    for (let sent = 0; sent < 10; sent += 1) {
      await api.post(`/email-alerts/${alert.id}/test`).expect(201);
    }
    const refused = await api
      .post(`/email-alerts/${alert.id}/test`)
      .expect(429);

    expect((refused.body as ApiErrorEnvelope).statusCode).toBe(429);
    expect(Number(refused.headers['retry-after'])).toBeGreaterThan(0);
    expect(send).toHaveBeenCalledTimes(10);
  });

  it('refuses a workspace more than 25 email alerts', async () => {
    await seed(25, true);

    const refused = await api
      .post('/email-alerts')
      .send({ email: 'one-more@example.net', events: EVENTS })
      .expect(403);

    expect((refused.body as ApiErrorEnvelope).message).toContain('25');
    expect(await prisma.emailAlert.count()).toBe(25);
  });

  it('holds the cap when creates race each other', async () => {
    await seed(MAX_EMAIL_ALERTS - 1, true);

    const answers = await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        api
          .post('/email-alerts')
          .send({ email: `race-${index}@example.net`, events: EVENTS }),
      ),
    );

    expect(answers.map(({ status }) => status).sort()).toEqual([
      201, 403, 403, 403, 403, 403,
    ]);
    expect(await prisma.emailAlert.count()).toBe(MAX_EMAIL_ALERTS);
  });

  it('holds the waiting limit when creates race each other', async () => {
    await seed(MAX_UNCONFIRMED_EMAIL_ALERTS - 1, false);

    const answers = await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        api
          .post('/email-alerts')
          .send({ email: `race-${index}@example.net`, events: EVENTS }),
      ),
    );

    expect(answers.map(({ status }) => status).sort()).toEqual([
      201, 403, 403, 403, 403, 403,
    ]);
    expect(sendAccountMail).toHaveBeenCalledTimes(1);
  });

  it('refuses a sixth recipient who has not confirmed yet', async () => {
    await seed(5, false);

    await api
      .post('/email-alerts')
      .send({ email: 'sixth@example.net', events: EVENTS })
      .expect(403);

    expect(sendAccountMail).not.toHaveBeenCalled();
  });

  it('does not count a recipient who unsubscribed as waiting', async () => {
    await seed(MAX_UNCONFIRMED_EMAIL_ALERTS, false);
    for (const alert of await prisma.emailAlert.findMany()) {
      await request(app.getHttpServer())
        .post(`/email-alerts/${alert.id}/unsubscribe`)
        .query({
          token: unsubscribeToken(TEST_AUTH_SECRET, {
            alertId: alert.id,
            email: alert.email,
          }),
        })
        .expect(204);
    }

    await api
      .post('/email-alerts')
      .send({ email: 'sixth@example.net', events: EVENTS })
      .expect(201);
  });

  it('keeps counting only unconfirmed alerts against that limit', async () => {
    await seed(5, true);

    await api
      .post('/email-alerts')
      .send({ email: 'sixth@example.net', events: EVENTS })
      .expect(201);
  });

  it('sends one recipient at most five confirmation emails a day', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const created = await api
        .post('/email-alerts')
        .send({ email: 'victim@example.net', events: EVENTS })
        .expect(201);
      await api
        .delete(`/email-alerts/${(created.body as EmailAlertItem).id}`)
        .expect(204);
    }
    sendAccountMail.mockClear();

    const refused = await api
      .post('/email-alerts')
      .send({ email: 'Victim@Example.net', events: EVENTS })
      .expect(429);

    expect((refused.body as ApiErrorEnvelope).message).toContain('recipient');
    expect(Number(refused.headers['retry-after'])).toBeGreaterThan(0);
    expect(sendAccountMail).not.toHaveBeenCalled();
    expect(await prisma.emailAlert.count()).toBe(0);
  });

  it('leaves the recipient allowance alone once the workspace allowance is spent', async () => {
    const redis = app.get(FailFastRedis).client;
    await redis.set(
      allowanceKey(DEFAULT_WORKSPACE_ID, 'workspace'),
      String(CONFIRMATIONS_PER_WORKSPACE_PER_DAY),
    );

    const refused = await api
      .post('/email-alerts')
      .send({ email: 'victim@example.net', events: EVENTS })
      .expect(429);

    expect((refused.body as ApiErrorEnvelope).message).toContain('workspace');
    expect(
      await redis.get(allowanceKey(sha256('victim@example.net'), 'recipient')),
    ).toBeNull();
  });

  it('gives the allowances back when the confirmation cannot be sent', async () => {
    sendAccountMail.mockRejectedValueOnce(new Error('relay refused'));

    await api
      .post('/email-alerts')
      .send({ email: 'victim@example.net', events: EVENTS })
      .expect(201);

    const redis = app.get(FailFastRedis).client;
    const recipient = await redis.get(
      allowanceKey(sha256('victim@example.net'), 'recipient'),
    );
    const workspace = await redis.get(
      allowanceKey(DEFAULT_WORKSPACE_ID, 'workspace'),
    );
    expect(Number(recipient)).toBe(0);
    expect(Number(workspace)).toBe(0);
  });

  it('does not count a recipient the workspace already trusts', async () => {
    await prisma.user.updateMany({
      where: { email: OWNER.email },
      data: { emailVerifiedAt: new Date() },
    });

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const created = await api
        .post('/email-alerts')
        .send({ email: OWNER.email, events: EVENTS })
        .expect(201);
      await api
        .delete(`/email-alerts/${(created.body as EmailAlertItem).id}`)
        .expect(204);
    }
  });

  it('refuses to send an address change to a sixth waiting recipient', async () => {
    await seed(5, false);
    const [confirmed] = await prisma.emailAlert.createManyAndReturn({
      data: [
        {
          workspaceId: DEFAULT_WORKSPACE_ID,
          email: 'ops@example.net',
          events: EVENTS,
          confirmedAt: new Date(),
        },
      ],
    });

    await api
      .patch(`/email-alerts/${confirmed.id}`)
      .send({ email: 'elsewhere@example.net' })
      .expect(403);

    const stored = await prisma.emailAlert.findUniqueOrThrow({
      where: { id: confirmed.id },
    });
    expect(stored.email).toBe('ops@example.net');
    expect(stored.confirmedAt).not.toBeNull();
  });

  it('lets a waiting recipient change address inside the waiting limit', async () => {
    await seed(5, false);
    const waiting = await prisma.emailAlert.findFirstOrThrow();

    await api
      .patch(`/email-alerts/${waiting.id}`)
      .send({ email: 'elsewhere@example.net' })
      .expect(200);
  });
});
