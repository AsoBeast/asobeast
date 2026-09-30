import './helpers/enable-private-webhooks';
import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import {
  ApiErrorEnvelope,
  WebhookItem,
  WebhookTestResult,
} from '@asobeast/shared';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { testDb } from './helpers/test-db';
import { clearRateLimitCounters, obliterateQueues } from './obliterate-queues';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { ownerAgent, useCookies } from './helpers/session';

const mockFetch = jest.fn<Promise<unknown>, unknown[]>();
jest.mock('undici', () => ({
  ...jest.requireActual<Record<string, unknown>>('undici'),
  fetch: (...args: unknown[]) => mockFetch(...args),
}));

describe('Webhooks on an instance that allows private targets (e2e)', () => {
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

    prisma = testDb();
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: {},
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
    api = await ownerAgent(app);
  });

  beforeEach(async () => {
    mockFetch.mockReset();
    await clearRateLimitCounters(app);
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "Webhook" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
    delete process.env.WEBHOOK_ALLOW_PRIVATE_TARGETS;
  });

  it.each([
    'http://hooks:8080/x',
    'http://n8n:5678/webhook/asobeast',
    'http://my_hooks:8080/x',
    'http://localhost:8080/x',
    'http://LOCALHOST:8080/x',
    'http://172.24.0.2:8080/hook',
    'http://[::1]:8080/x',
  ])('registers %s', async (url) => {
    const created = await api
      .post('/webhooks')
      .send({ url, events: ['rank.dropped'] })
      .expect(201);
    expect((created.body as WebhookItem).url).toBe(url);
    expect(await prisma.webhook.count()).toBe(1);
  });

  it('moves an existing webhook onto a bare hostname', async () => {
    const created = await api
      .post('/webhooks')
      .send({
        url: 'https://hooks.example.com/asobeast',
        events: ['rank.dropped'],
      })
      .expect(201);
    const webhook = created.body as WebhookItem;

    const patched = await api
      .patch(`/webhooks/${webhook.id}`)
      .send({ url: 'http://hooks:8080/x' })
      .expect(200);
    expect((patched.body as WebhookItem).url).toBe('http://hooks:8080/x');
  });

  it('sends the test payload to a bare hostname', async () => {
    const created = await api
      .post('/webhooks')
      .send({ url: 'http://hooks:8080/x', events: ['rank.dropped'] })
      .expect(201);
    const webhook = created.body as WebhookItem;

    mockFetch.mockResolvedValue({ ok: true, status: 200 });
    const response = await api.post(`/webhooks/${webhook.id}/test`).expect(201);
    expect(response.body as WebhookTestResult).toEqual({
      delivered: true,
      status: 200,
    });
    const [target] = mockFetch.mock.calls[0] as [URL];
    expect(target.toString()).toBe('http://hooks:8080/x');
  });

  it.each([
    'http://user:pass@hooks:8080/x',
    'ftp://hooks/x',
    'hooks:8080/x',
    'http://hooks:99999/x',
    'http://localhost./x',
  ])('still refuses %s', async (url) => {
    await api
      .post('/webhooks')
      .send({ url, events: ['rank.dropped'] })
      .expect(400);
    expect(await prisma.webhook.count()).toBe(0);
  });

  it('names the credentials rule for an url with userinfo', async () => {
    const response = await api
      .post('/webhooks')
      .send({
        url: 'http://user:pass@hooks:8080/x',
        events: ['rank.dropped'],
      })
      .expect(400);
    expect((response.body as ApiErrorEnvelope).message).toMatch(
      /must not embed credentials/,
    );
  });
});
