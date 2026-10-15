import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { OPENAI_CLIENT } from '../src/ai/openai.client';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { ownerAgent, useCookies } from './helpers/session';
import { testDb } from './helpers/test-db';
import { obliterateQueues, settleBootRegistration } from './obliterate-queues';

describe('AI without a key (e2e)', () => {
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
    })
      .overrideProvider(OPENAI_CLIENT)
      .useValue(null)
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

  afterAll(async () => {
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  it('answers that ai is not configured', async () => {
    const status = await api.get('/ai/status').expect(200);

    expect(status.body).toEqual({ configured: false, model: null });
  });

  it('refuses a review reply draft without a key', async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword" RESTART IDENTITY CASCADE',
    );
    const created = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '111',
        country: 'us',
      },
    });
    const review = await prisma.review.create({
      data: { appId: created.id, reviewId: 'r1', score: 1, text: 'Broken' },
    });

    const refused = await api
      .post(`/apps/${created.id}/reviews/${review.id}/reply/draft`)
      .send({})
      .expect(409);

    expect((refused.body as { message: string }).message).toBe(
      'AI features require OPENAI_API_KEY',
    );
    await expect(prisma.reviewReply.count()).resolves.toBe(0);
    await expect(prisma.aiCall.count()).resolves.toBe(0);
  });

  it('refuses a new review translation without a key and answers a kept one', async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword" RESTART IDENTITY CASCADE',
    );
    const created = await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '111',
        country: 'us',
      },
    });
    const review = await prisma.review.create({
      data: {
        appId: created.id,
        reviewId: 'r1',
        score: 1,
        text: 'Kaputt',
        translationLanguage: 'en',
        sourceLanguage: 'de',
        translatedText: 'Broken',
        translatedAt: new Date('2026-10-15T00:00:00Z'),
      },
    });
    const path = `/apps/${created.id}/reviews/${review.id}/translation`;

    await api.post(path).send({ language: 'fr' }).expect(409);
    const kept = await api.post(path).send({ language: 'en' }).expect(201);

    expect(kept.body).toMatchObject({ language: 'en', text: 'Broken' });
    await expect(prisma.aiCall.count()).resolves.toBe(0);
  });

  it('refuses an anonymous request', async () => {
    await request(app.getHttpServer()).get('/ai/status').expect(401);
  });
});
