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
import {
  clearRateLimitCounters,
  obliterateQueues,
  settleBootRegistration,
} from './obliterate-queues';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { ownerAgent, useCookies } from './helpers/session';

const mockFetch = jest.fn<Promise<unknown>, unknown[]>();
jest.mock('undici', () => ({
  ...jest.requireActual<Record<string, unknown>>('undici'),
  fetch: (...args: unknown[]) => mockFetch(...args),
}));

describe('WebhooksController (e2e)', () => {
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
  });

  it('runs the full crud round trip and masks the secret', async () => {
    const created = await api
      .post('/webhooks')
      .send({
        url: 'https://hooks.example.com/asobeast',
        events: ['metadata.changed', 'rank.dropped'],
        secret: 'supersecret',
      })
      .expect(201);

    const webhook = created.body as WebhookItem;
    expect(webhook.hasSecret).toBe(true);
    expect(webhook).not.toHaveProperty('secret');
    expect(webhook.active).toBe(true);
    expect(webhook.events).toEqual(['metadata.changed', 'rank.dropped']);
    expect(webhook.channel).toBe('generic');

    const listed = await api.get('/webhooks').expect(200);
    expect(listed.body as WebhookItem[]).toHaveLength(1);
    expect((listed.body as WebhookItem[])[0].channel).toBe('generic');

    const patched = await api
      .patch(`/webhooks/${webhook.id}`)
      .send({ active: false, secret: '' })
      .expect(200);
    const updated = patched.body as WebhookItem;
    expect(updated.active).toBe(false);
    expect(updated.hasSecret).toBe(false);

    await api.delete(`/webhooks/${webhook.id}`).expect(204);
    const empty = await api.get('/webhooks').expect(200);
    expect(empty.body as WebhookItem[]).toHaveLength(0);
  });

  it('answers the chat tool a webhook url reaches', async () => {
    const created = await api
      .post('/webhooks')
      .send({
        url: 'https://hooks.slack.com/services/T1/B2/x',
        events: ['rank.dropped'],
      })
      .expect(201);
    expect((created.body as WebhookItem).channel).toBe('slack');

    const listed = await api.get('/webhooks').expect(200);
    expect((listed.body as WebhookItem[])[0].channel).toBe('slack');

    const moved = await api
      .patch(`/webhooks/${(created.body as WebhookItem).id}`)
      .send({ url: 'https://discord.com/api/webhooks/123/abc' })
      .expect(200);
    expect((moved.body as WebhookItem).channel).toBe('discord');
  });

  it.each([
    [
      'https://api.telegram.org/bot123:ABC/sendMessage',
      'a telegram url needs the chat to post to: add ?chat_id=<id> after sendMessage',
    ],
    [
      'https://contoso.webhook.office.com/webhookb2/abc',
      'office 365 connector urls stopped delivering in may 2026; create a workflow with the "send webhook alerts to a channel" template and paste its url',
    ],
  ])('refuses %s with the fix in the message', async (url, message) => {
    const response = await api
      .post('/webhooks')
      .send({ url, events: ['rank.dropped'] })
      .expect(400);

    expect((response.body as { message: string }).message).toBe(message);
  });

  it('accepts the milestone, first rank and overtake events', async () => {
    const created = await api
      .post('/webhooks')
      .send({
        url: 'https://hooks.example.com/asobeast',
        events: ['rank.milestone', 'rank.first', 'rank.overtaken'],
      })
      .expect(201);

    expect((created.body as WebhookItem).events).toEqual([
      'rank.milestone',
      'rank.first',
      'rank.overtaken',
    ]);
  });

  it('replaces only the events of a signed webhook', async () => {
    const created = await api
      .post('/webhooks')
      .send({
        url: 'https://hooks.example.com/asobeast',
        events: ['metadata.changed'],
        secret: 'supersecret',
      })
      .expect(201);
    const webhook = created.body as WebhookItem;

    const patched = await api
      .patch(`/webhooks/${webhook.id}`)
      .send({ events: ['rank.milestone'] })
      .expect(200);

    expect(patched.body as WebhookItem).toMatchObject({
      events: ['rank.milestone'],
      hasSecret: true,
    });
    const stored = await prisma.webhook.findUniqueOrThrow({
      where: { id: webhook.id },
    });
    expect(stored.secret).toBe('supersecret');
    expect(stored.url).toBe('https://hooks.example.com/asobeast');
  });

  it('rejects an invalid url', async () => {
    await api
      .post('/webhooks')
      .send({ url: 'not-a-url', events: ['metadata.changed'] })
      .expect(400);
  });

  it.each([
    'http://127.0.0.1/hook',
    'http://169.254.169.254/latest/meta-data/',
    'http://[::1]/hook',
    'http://[::ffff:169.254.169.254]/hook',
    'http://10.0.0.5:8080/hook',
  ])('refuses %s as a webhook target', async (url) => {
    const response = await api
      .post('/webhooks')
      .send({ url, events: ['metadata.changed'] })
      .expect(400);
    expect((response.body as ApiErrorEnvelope).message).toMatch(
      /private|reserved|inside this network/,
    );
    expect(await prisma.webhook.count()).toBe(0);
  });

  it.each(['http://localhost:4000/webhooks', 'http://printer.local/hook'])(
    'refuses the local hostname %s as a webhook target',
    async (url) => {
      await api
        .post('/webhooks')
        .send({ url, events: ['metadata.changed'] })
        .expect(400);
      expect(await prisma.webhook.count()).toBe(0);
    },
  );

  it.each([
    'http://hooks:8080/x',
    'http://n8n:5678/webhook/asobeast',
    'http://my_hooks:8080/x',
    'http://LOCALHOST:8080/x',
    'http://0.0.0.0:8080/x',
    'http://printer.local。/x',
  ])('explains that %s stays inside the network', async (url) => {
    const response = await api
      .post('/webhooks')
      .send({ url, events: ['metadata.changed'] })
      .expect(400);
    const { message } = response.body as ApiErrorEnvelope;
    expect(message).toMatch(/private|reserved|inside this network/);
    expect(message).not.toMatch(/must be a URL address/);
    expect(await prisma.webhook.count()).toBe(0);
  });

  it('refuses to move an existing webhook onto a bare hostname', async () => {
    const created = await api
      .post('/webhooks')
      .send({
        url: 'https://hooks.example.com/asobeast',
        events: ['metadata.changed'],
      })
      .expect(201);
    const webhook = created.body as WebhookItem;

    const response = await api
      .patch(`/webhooks/${webhook.id}`)
      .send({ url: 'http://hooks:8080/x' })
      .expect(400);
    expect((response.body as ApiErrorEnvelope).message).toMatch(
      /inside this network/,
    );

    const stored = await prisma.webhook.findUniqueOrThrow({
      where: { id: webhook.id },
    });
    expect(stored.url).toBe('https://hooks.example.com/asobeast');
  });

  it('refuses to move an existing webhook onto a private target', async () => {
    const created = await api
      .post('/webhooks')
      .send({
        url: 'https://hooks.example.com/asobeast',
        events: ['metadata.changed'],
      })
      .expect(201);
    const webhook = created.body as WebhookItem;

    await api
      .patch(`/webhooks/${webhook.id}`)
      .send({ url: 'http://169.254.169.254/latest/meta-data/' })
      .expect(400);

    const stored = await prisma.webhook.findUniqueOrThrow({
      where: { id: webhook.id },
    });
    expect(stored.url).toBe('https://hooks.example.com/asobeast');
  });

  it.each([{ url: null }, { events: null }, { active: null }])(
    'rejects a null field when updating a webhook: %o',
    async (patch) => {
      const created = await api
        .post('/webhooks')
        .send({
          url: 'https://hooks.example.com/asobeast',
          events: ['metadata.changed'],
        })
        .expect(201);
      const webhook = created.body as WebhookItem;

      const response = await api
        .patch(`/webhooks/${webhook.id}`)
        .send(patch)
        .expect(400);
      expect((response.body as ApiErrorEnvelope).statusCode).toBe(400);

      const stored = await prisma.webhook.findUniqueOrThrow({
        where: { id: webhook.id },
      });
      expect(stored.url).toBe('https://hooks.example.com/asobeast');
      expect(stored.events).toEqual(['metadata.changed']);
      expect(stored.active).toBe(true);
    },
  );

  it('rejects an unknown event name', async () => {
    await api
      .post('/webhooks')
      .send({ url: 'https://hooks.example.com', events: ['nope'] })
      .expect(400);
  });

  it('returns a 404 envelope for an unknown webhook id', async () => {
    const response = await api
      .patch('/webhooks/missing')
      .send({ active: false })
      .expect(404);
    const body = response.body as ApiErrorEnvelope;
    expect(body.statusCode).toBe(404);
  });

  it('delivers a sample payload through the test endpoint', async () => {
    const created = await api
      .post('/webhooks')
      .send({
        url: 'https://hooks.example.com/asobeast',
        events: ['metadata.changed'],
      })
      .expect(201);
    const webhook = created.body as WebhookItem;

    mockFetch.mockResolvedValue({ ok: true, status: 200 });
    const response = await api.post(`/webhooks/${webhook.id}/test`).expect(201);
    expect(response.body as WebhookTestResult).toEqual({
      delivered: true,
      status: 200,
    });
    const [target] = mockFetch.mock.calls[0] as [URL];
    expect(target.toString()).toBe('https://hooks.example.com/asobeast');
  });

  it.each([
    [
      'https://prod-21.westeurope.logic.azure.com:443/workflows/abc/triggers/manual/paths/invoke?sig=SECRET',
      'attachments',
    ],
    [
      'https://api.telegram.org/bot123:SECRET/sendMessage?chat_id=-100',
      'chat_id',
    ],
  ])(
    'tests %s with its own body and keeps its token for delivery',
    async (url, key) => {
      const created = await api
        .post('/webhooks')
        .send({ url, events: ['metadata.changed'] })
        .expect(201);
      mockFetch.mockResolvedValue({ ok: true, status: 202 });

      await api
        .post(`/webhooks/${(created.body as WebhookItem).id}/test`)
        .expect(201);

      const [target, init] = mockFetch.mock.calls[0] as [URL, { body: string }];
      expect(target.toString()).toContain('SECRET');
      expect(JSON.parse(init.body)).toHaveProperty(key);
    },
  );

  it('reports a private target as undelivered without reaching the network', async () => {
    const webhook = await prisma.webhook.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        url: 'http://169.254.169.254/latest/meta-data/',
        events: ['metadata.changed'],
      },
    });

    const response = await api.post(`/webhooks/${webhook.id}/test`).expect(201);
    expect(response.body as WebhookTestResult).toEqual({
      delivered: false,
      status: null,
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
