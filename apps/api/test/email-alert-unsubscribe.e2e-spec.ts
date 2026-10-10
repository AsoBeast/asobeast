import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { EmailAlertItem } from '@asobeast/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { MailerService } from '../src/alerts/mailer.service';
import { unsubscribeToken } from '../src/alerts/unsubscribe-token';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { TEST_AUTH_SECRET } from './helpers/auth-env';
import { ownerAgent, useCookies } from './helpers/session';
import { testDb } from './helpers/test-db';
import { obliterateQueues } from './obliterate-queues';

describe('Email alert one click unsubscribe (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let api: Awaited<ReturnType<typeof ownerAgent>>;

  const oneClick = (id: string, query: string) =>
    request(app.getHttpServer())
      .post(`/email-alerts/${id}/unsubscribe?${query}`)
      .type('form')
      .send('List-Unsubscribe=One-Click');

  const tokenFor = ({ id, email }: Pick<EmailAlertItem, 'id' | 'email'>) =>
    `token=${unsubscribeToken(TEST_AUTH_SECRET, { alertId: id, email })}`;

  const create = async (email: string): Promise<EmailAlertItem> =>
    (
      await api
        .post('/email-alerts')
        .send({ email, events: ['metadata.changed'] })
        .expect(201)
    ).body as EmailAlertItem;

  const activeById = async (): Promise<Record<string, boolean>> => {
    const listed = (await api.get('/email-alerts').expect(200))
      .body as EmailAlertItem[];
    return Object.fromEntries(listed.map((alert) => [alert.id, alert.active]));
  };

  beforeAll(async () => {
    execSync('pnpm prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'ignore',
    });
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailerService)
      .useValue({ enabled: true, origin: null, send: jest.fn() })
      .compile();
    app = moduleFixture.createNestApplication();
    useCookies(app);
    await app.init();
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
      'TRUNCATE TABLE "EmailAlert", "AlertDelivery" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  it('pauses only the named alert, without a session, cookie or redirect', async () => {
    const first = await create('ops@example.com');
    const second = await create('team@example.com');

    const response = await oneClick(first.id, tokenFor(first)).expect(204);

    expect(response.headers.location).toBeUndefined();
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(await activeById()).toEqual({
      [first.id]: false,
      [second.id]: true,
    });
  });

  it('answers the same when a mailbox provider retries', async () => {
    const alert = await create('ops@example.com');
    await oneClick(alert.id, tokenFor(alert)).expect(204);
    await oneClick(alert.id, tokenFor(alert)).expect(204);
    expect(await activeById()).toEqual({ [alert.id]: false });
  });

  it('refuses another alert token and an unknown alert alike', async () => {
    const first = await create('ops@example.com');
    const second = await create('team@example.com');

    await oneClick(second.id, tokenFor(first)).expect(404);
    await oneClick(
      'cm_missing_alert',
      tokenFor({ id: 'cm_missing_alert', email: 'ops@example.com' }),
    ).expect(404);
    expect(await activeById()).toEqual({
      [first.id]: true,
      [second.id]: true,
    });
  });

  it('retires the links sent to an address the alert no longer uses', async () => {
    const alert = await create('ops@example.com');
    await api
      .patch(`/email-alerts/${alert.id}`)
      .send({ email: 'team@example.com' })
      .expect(200);

    await oneClick(alert.id, tokenFor(alert)).expect(404);
    await oneClick(
      alert.id,
      tokenFor({ id: alert.id, email: 'team@example.com' }),
    ).expect(204);
  });

  it('takes a burst of one click unsubscribes from one mailbox provider address', async () => {
    const alert = await create('ops@example.com');
    const statuses = new Set<number>();
    for (let attempt = 0; attempt < 120; attempt += 1) {
      statuses.add((await oneClick(alert.id, tokenFor(alert))).status);
    }
    expect([...statuses]).toEqual([204]);
  });

  it('refuses a malformed token and an extra query parameter', async () => {
    const alert = await create('ops@example.com');
    await oneClick(alert.id, 'token=short').expect(400);
    await oneClick(alert.id, `${tokenFor(alert)}&extra=1`).expect(400);
    expect(await activeById()).toEqual({ [alert.id]: true });
  });

  it('never unsubscribes on a GET, which link scanners send', async () => {
    const alert = await create('ops@example.com');
    await request(app.getHttpServer())
      .get(`/email-alerts/${alert.id}/unsubscribe?${tokenFor(alert)}`)
      .expect(404);
    expect(await activeById()).toEqual({ [alert.id]: true });
  });
});
