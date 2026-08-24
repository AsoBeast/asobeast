import { execSync } from 'child_process';
import { createHash } from 'crypto';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { BullExplorer } from '@nestjs/bullmq/dist/bull.explorer';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import * as argon2 from 'argon2';
import request from 'supertest';
import type { App } from 'supertest/types';
import { API_TOKEN_PREFIX } from '@asobeast/shared';
import { AppModule } from '../../src/app.module';
import { StoreProviderRegistry } from '../../src/store-providers/store-provider.registry';
import { NormalizedApp, StoreProvider } from '../../src/store-providers/types';
import { useCookies } from '../helpers/session';
import { testDb } from '../helpers/test-db';
import {
  clearRateLimitCounters,
  obliterateQueues,
  pauseQueues,
} from '../obliterate-queues';

export const SHARED_STORE_APP_ID = '111111111';
export const SHARED_PLAY_APP_ID = 'com.shared.tracker';
export const SHARED_KEYWORD = 'habit tracker';
export const SHARED_COMPETITOR_ID = '222222222';
export const PASSWORD = 'supersecret1';

export const TENANT_TABLES_TRUNCATE =
  '"App", "Keyword", "AlertEvent", "Webhook", "EmailAlert", "AlertDelivery", "ApiToken", "WorkspaceInvite", "User"';

export interface IsolationWorkspace {
  id: string;
  email: string;
  userId: string;
  token: string;
  agent: ReturnType<typeof request.agent>;
  appleAppId: string;
  playAppId: string;
  competitorId: string;
  keywordId: string;
  otherMarketKeywordId: string;
  privateKeywordId: string;
  webhookId: string;
  emailAlertId: string;
  actionId: string;
  reviewId: string;
  changeId: string;
}

export interface IsolationFixture {
  app: INestApplication<App>;
  db: PrismaClient;
  a: IsolationWorkspace;
  b: IsolationWorkspace;
  close: () => Promise<void>;
}

const snapshotFor = (store: Store, storeAppId: string): NormalizedApp => ({
  store,
  storeAppId,
  title: 'Shared Fixture',
  subtitle: 'Shared subtitle',
  summary: 'Shared summary',
  description: 'Shared description',
  iconUrl: 'https://example.com/icon.png',
  ratingAvg: 4.5,
  ratingCount: 100,
  price: 0,
  version: '1.0.0',
  releasedAt: new Date('2024-01-01T00:00:00Z'),
  storeUpdatedAt: new Date('2025-01-01T00:00:00Z'),
  raw: { source: 'isolation', primaryGenreId: 6007, price: 0 },
});

const provider = (store: Store): StoreProvider => ({
  store,
  getApp: (storeAppId: string) =>
    Promise.resolve(snapshotFor(store, storeAppId)),
  search: () => Promise.resolve([]),
  suggest: () => Promise.resolve([]),
  similar: () => Promise.resolve([]),
  topCharts: () => Promise.resolve([]),
  reviews: () => Promise.resolve([]),
  developerApps: () => Promise.resolve([]),
  availability: () => Promise.resolve([]),
});

function utcDay(daysAgo = 0): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
      daysAgo * 86_400_000,
  );
}

export async function createIsolationFixture(): Promise<IsolationFixture> {
  execSync('pnpm prisma migrate deploy', {
    cwd: join(__dirname, '..', '..'),
    env: process.env,
    stdio: 'ignore',
  });

  const registry = {
    get: (store: Store) => provider(store),
  } as unknown as StoreProviderRegistry;

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(StoreProviderRegistry)
    .useValue(registry)
    .compile();

  const app: INestApplication<App> = moduleFixture.createNestApplication();
  useCookies(app);
  await app.init();
  await app.get(BullExplorer, { strict: false }).onApplicationShutdown();
  await pauseQueues(app);

  await clearRateLimitCounters(app);

  const db = testDb();
  await db.$executeRawUnsafe(
    `TRUNCATE TABLE ${TENANT_TABLES_TRUNCATE} RESTART IDENTITY CASCADE`,
  );
  await db.workspace.deleteMany({});

  const a = await seedWorkspace(app, db, 'ws_iso_a', 'a@example.com');
  const b = await seedWorkspace(app, db, 'ws_iso_b', 'b@example.com');

  return {
    app,
    db,
    a,
    b,
    close: async () => {
      await db.$executeRawUnsafe(
        `TRUNCATE TABLE ${TENANT_TABLES_TRUNCATE} RESTART IDENTITY CASCADE`,
      );
      await db.workspace.deleteMany({});
      await db.$disconnect();
      await obliterateQueues(app);
      await app.close();
    },
  };
}

async function seedWorkspace(
  app: INestApplication<App>,
  db: PrismaClient,
  id: string,
  email: string,
): Promise<IsolationWorkspace> {
  await db.workspace.create({ data: { id, name: id } });
  const user = await db.user.create({
    data: {
      workspaceId: id,
      email,
      passwordHash: await argon2.hash(PASSWORD),
      role: 'owner',
    },
  });

  await db.workspaceInvite.create({
    data: {
      workspaceId: id,
      email: `invited-${id}@example.com`,
      tokenHash: createHash('sha256').update(`${id}-invite`).digest('hex'),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  const rawToken = `${API_TOKEN_PREFIX}${id}-token`;
  await db.apiToken.create({
    data: {
      userId: user.id,
      name: 'isolation',
      tokenHash: createHash('sha256').update(rawToken).digest('hex'),
      prefix: rawToken.slice(0, 12),
    },
  });

  const agent = request.agent(app.getHttpServer());
  await agent
    .post('/auth/login')
    .send({ email, password: PASSWORD })
    .expect(200);

  const apple = await db.app.create({
    data: {
      workspaceId: id,
      store: Store.APP_STORE,
      storeAppId: SHARED_STORE_APP_ID,
      country: 'us',
      name: `${id} apple`,
    },
  });
  const play = await db.app.create({
    data: {
      workspaceId: id,
      store: Store.GOOGLE_PLAY,
      storeAppId: SHARED_PLAY_APP_ID,
      country: 'us',
      name: `${id} play`,
    },
  });
  const competitor = await db.app.create({
    data: {
      workspaceId: id,
      store: Store.APP_STORE,
      storeAppId: SHARED_COMPETITOR_ID,
      country: 'us',
      name: `${id} rival`,
      isCompetitor: true,
      primaryAppId: apple.id,
    },
  });

  for (const target of [apple, play, competitor]) {
    await db.appSnapshot.create({
      data: {
        appId: target.id,
        title: `${id} ${target.storeAppId}`,
        subtitle: 'Isolation subtitle',
        summary: 'Isolation summary',
        description: 'Isolation description',
        raw: { source: 'isolation', primaryGenreId: 6007, price: 0 },
      },
    });
  }

  const keyword = await db.keyword.upsert({
    where: {
      text_store_country: {
        text: SHARED_KEYWORD,
        store: Store.APP_STORE,
        country: 'us',
      },
    },
    update: {},
    create: { text: SHARED_KEYWORD, store: Store.APP_STORE, country: 'us' },
  });
  const otherMarket = await db.keyword.upsert({
    where: {
      text_store_country: {
        text: SHARED_KEYWORD,
        store: Store.APP_STORE,
        country: 'gb',
      },
    },
    update: {},
    create: { text: SHARED_KEYWORD, store: Store.APP_STORE, country: 'gb' },
  });

  const privateKeyword = await db.keyword.create({
    data: { text: `${id} only`, store: Store.APP_STORE, country: 'us' },
  });

  for (const row of [keyword, otherMarket, privateKeyword]) {
    await db.trackedKeyword.create({
      data: {
        appId: apple.id,
        keywordId: row.id,
        source: 'MANUAL',
        active: true,
      },
    });
  }

  for (const [index, day] of [0, 1, 2].entries()) {
    await db.keywordRanking.create({
      data: {
        appId: apple.id,
        workspaceId: id,
        keywordId: keyword.id,
        date: utcDay(day),
        position: id === 'ws_iso_a' ? 3 + index : 40 + index,
        depth: 200,
      },
    });
  }
  await db.keywordRanking.create({
    data: {
      appId: competitor.id,
      workspaceId: id,
      keywordId: keyword.id,
      date: utcDay(0),
      position: 9,
      depth: 200,
    },
  });

  await db.categoryRank.create({
    data: {
      appId: apple.id,
      date: utcDay(0),
      collection: 'free',
      genre: '6007',
      position: id === 'ws_iso_a' ? 5 : 55,
      depth: 200,
    },
  });

  const change = await db.changeEvent.create({
    data: {
      appId: apple.id,
      field: 'title',
      before: 'Old',
      after: `${id} new title`,
    },
  });

  const review = await db.review.create({
    data: {
      appId: apple.id,
      reviewId: `${id}-review`,
      score: 2,
      title: 'Isolation review',
      text: `${id} review body`,
      reviewedAt: new Date(),
    },
  });

  await db.auditScore.create({
    data: {
      appId: apple.id,
      date: utcDay(0),
      overall: id === 'ws_iso_a' ? 80 : 20,
      coveredWeight: 10,
      totalWeight: 10,
      factors: {},
    },
  });

  const webhook = await db.webhook.create({
    data: {
      workspaceId: id,
      url: `https://hooks.example.com/${id}`,
      events: ['rank.dropped', 'metadata.changed'],
    },
  });
  const emailAlert = await db.emailAlert.create({
    data: {
      workspaceId: id,
      email: `alerts+${id}@example.com`,
      events: ['rank.dropped'],
    },
  });

  const action = await db.actionItem.create({
    data: {
      workspaceId: id,
      appId: apple.id,
      keywordId: keyword.id,
      rule: 'keyword.defend',
      category: 'regression',
      store: Store.APP_STORE,
      country: 'us',
      fingerprint: `${id}-fingerprint`,
      status: 'OPEN',
      priority: 'high',
      impact: 60,
      formulaVersion: 'v1',
      evidence: {},
      lastSeenAt: new Date(),
    },
  });

  return {
    id,
    email,
    userId: user.id,
    token: rawToken,
    agent,
    appleAppId: apple.id,
    playAppId: play.id,
    competitorId: competitor.id,
    keywordId: keyword.id,
    otherMarketKeywordId: otherMarket.id,
    privateKeywordId: privateKeyword.id,
    webhookId: webhook.id,
    emailAlertId: emailAlert.id,
    actionId: action.id,
    reviewId: review.id,
    changeId: change.id,
  };
}
