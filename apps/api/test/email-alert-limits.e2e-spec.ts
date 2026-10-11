import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ApiErrorEnvelope, EmailAlertItem } from '@asobeast/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  CONFIRMATIONS_PER_RECIPIENT_PER_DAY,
  CONFIRMATIONS_PER_WORKSPACE_PER_DAY,
} from '../src/alerts/confirmation-mail.limiter';
import {
  MAX_EMAIL_ALERTS,
  MAX_UNCONFIRMED_EMAIL_ALERTS,
} from '../src/alerts/email-alerts.service';
import { unsubscribeToken } from '../src/alerts/unsubscribe-token';
import { sha256 } from '../src/auth/password-hash';
import { windowKey } from '../src/auth/rate-limit/window';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { FailFastRedis } from '../src/redis/fail-fast-redis';
import { TEST_AUTH_SECRET } from './helpers/auth-env';
import { EmailAlertApp, startEmailAlertApp } from './helpers/email-alert-app';
import { OWNER } from './helpers/session';

const EVENTS = ['metadata.changed'];

const DAY_SECONDS = 24 * 60 * 60;

const allowanceKey = (scope: string, label: string): string =>
  windowKey('confirmation', scope, label, DAY_SECONDS, new Date());

describe('Email alert limits (e2e)', () => {
  let fixture: EmailAlertApp;
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let api: EmailAlertApp['api'];
  let send: jest.Mock;
  let sendAccountMail: jest.Mock;

  beforeAll(async () => {
    fixture = await startEmailAlertApp();
    ({ app, prisma, api, send, sendAccountMail } = fixture);
  });

  beforeEach(() => fixture.reset());

  afterAll(() => fixture.close());

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

  it('refuses a workspace more email alerts than its cap', async () => {
    await seed(MAX_EMAIL_ALERTS, true);

    const refused = await api
      .post('/email-alerts')
      .send({ email: 'one-more@example.net', events: EVENTS })
      .expect(403);

    expect((refused.body as ApiErrorEnvelope).message).toContain(
      String(MAX_EMAIL_ALERTS),
    );
    expect(await prisma.emailAlert.count()).toBe(MAX_EMAIL_ALERTS);
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

  it('refuses a recipient past the waiting limit', async () => {
    await seed(MAX_UNCONFIRMED_EMAIL_ALERTS, false);

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
    await seed(MAX_UNCONFIRMED_EMAIL_ALERTS, true);

    await api
      .post('/email-alerts')
      .send({ email: 'sixth@example.net', events: EVENTS })
      .expect(201);
  });

  it('sends one recipient a bounded number of confirmation emails a day', async () => {
    for (
      let attempt = 0;
      attempt < CONFIRMATIONS_PER_RECIPIENT_PER_DAY;
      attempt += 1
    ) {
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

    for (
      let attempt = 0;
      attempt <= CONFIRMATIONS_PER_RECIPIENT_PER_DAY;
      attempt += 1
    ) {
      const created = await api
        .post('/email-alerts')
        .send({ email: OWNER.email, events: EVENTS })
        .expect(201);
      await api
        .delete(`/email-alerts/${(created.body as EmailAlertItem).id}`)
        .expect(204);
    }

    expect(sendAccountMail).not.toHaveBeenCalled();
  });

  it('refuses an address change past the waiting limit', async () => {
    await seed(MAX_UNCONFIRMED_EMAIL_ALERTS, false);
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
    await seed(MAX_UNCONFIRMED_EMAIL_ALERTS, false);
    const waiting = await prisma.emailAlert.findFirstOrThrow();

    await api
      .patch(`/email-alerts/${waiting.id}`)
      .send({ email: 'elsewhere@example.net' })
      .expect(200);
  });
});
