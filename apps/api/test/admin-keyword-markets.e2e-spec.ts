import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import type {
  AccountPlan,
  AdminAppList,
  AdminOverview,
  SupportWorkspaceDetail,
  Store,
  SupportWorkspaceSummary,
} from '@asobeast/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureAdminSurfaces } from '../src/admin-surfaces';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import {
  seedApiToken,
  seedWorkspace,
  truncateUsers,
} from './helpers/api-tokens';
import { testDb } from './helpers/test-db';
import {
  clearRateLimitCounters,
  obliterateQueues,
  pauseQueues,
} from './obliterate-queues';

const WORKSPACE = 'ws_markets_tenant';
const NEIGHBOUR = 'ws_markets_neighbour';
const SUPPORT = '/admin/support';
const METRICS = '/metrics';

describe('Keyword market counts (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let operatorToken: string;
  let tenantToken: string;

  interface Tracking {
    text: string;
    country?: string;
    store?: Store;
    active?: boolean;
  }

  async function track(appId: string, tracking: Tracking): Promise<void> {
    const {
      text,
      country = 'us',
      store = 'APP_STORE',
      active = true,
    } = tracking;
    const keyword = await prisma.keyword.upsert({
      where: {
        text_store_country: { text, store, country },
      },
      update: {},
      create: { text, store, country },
    });
    await prisma.trackedKeyword.create({
      data: { appId, keywordId: keyword.id, source: 'MANUAL', active },
    });
  }

  async function seedApp(
    workspaceId: string,
    storeAppId: string,
    name: string,
    store: Store = 'APP_STORE',
  ) {
    return prisma.app.create({
      data: { workspaceId, store, storeAppId, name },
    });
  }

  async function seedSharedPhrase(): Promise<void> {
    await seedWorkspace(prisma, WORKSPACE, 'Markets Tenant');
    await seedWorkspace(prisma, NEIGHBOUR, 'Markets Neighbour');
    const first = await seedApp(WORKSPACE, '300000001', 'First App');
    const second = await seedApp(WORKSPACE, '300000002', 'Second App');
    const play = await seedApp(
      WORKSPACE,
      'com.markets.play',
      'Play App',
      'GOOGLE_PLAY',
    );
    const neighbour = await seedApp(NEIGHBOUR, '300000003', 'Neighbour App');
    await track(first.id, { text: 'life' });
    await track(first.id, { text: 'life', country: 'gb' });
    await track(first.id, { text: 'habit tracker' });
    await track(first.id, { text: 'paused phrase', active: false });
    await track(second.id, { text: 'life' });
    await track(play.id, { text: 'life', store: 'GOOGLE_PLAY' });
    await track(neighbour.id, { text: 'life' });
  }

  const get = (path: string, token: string) =>
    request(app.getHttpServer())
      .get(path)
      .set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureAdminSurfaces(app);
    await app.init();
    await pauseQueues(app);
    await clearRateLimitCounters(app);

    prisma = testDb();
    await seedWorkspace(prisma, DEFAULT_WORKSPACE_ID, 'Default');
    await truncateUsers(prisma);
    await seedSharedPhrase();
    operatorToken = await seedApiToken(prisma, {
      seed: 'marketsoperator',
      email: 'operator@markets.example.com',
      workspaceId: DEFAULT_WORKSPACE_ID,
      role: 'owner',
    });
    tenantToken = await seedApiToken(prisma, {
      seed: 'marketstenant',
      email: 'owner@markets-tenant.example.com',
      workspaceId: WORKSPACE,
      role: 'owner',
    });
  });

  afterAll(async () => {
    await prisma.supportAccess.deleteMany({});
    await prisma.workspace.deleteMany({
      where: { id: { in: [WORKSPACE, NEIGHBOUR] } },
    });
    await truncateUsers(prisma);
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  it('counts a phrase two apps track once on the plan, and leaves paused ones out', async () => {
    const res = await get('/auth/plan', tenantToken).expect(200);

    expect((res.body as AccountPlan).usage.keywordMarkets.used).toBe(4);
  });

  it('gives the support workspace list the number the plan shows', async () => {
    const res = await get(`${SUPPORT}/workspaces`, operatorToken).expect(200);
    const markets = Object.fromEntries(
      (res.body as SupportWorkspaceSummary[]).map((workspace) => [
        workspace.workspaceId,
        workspace.keywordMarkets,
      ]),
    );

    expect(markets[WORKSPACE]).toBe(4);
    expect(markets[NEIGHBOUR]).toBe(1);
  });

  it('gives the support workspace detail the number the plan shows', async () => {
    const res = await get(
      `${SUPPORT}/workspaces/${WORKSPACE}`,
      operatorToken,
    ).expect(200);

    expect((res.body as SupportWorkspaceDetail).keywordMarkets).toBe(4);
  });

  it('sums the workspace counts in the overview, one search serving both', async () => {
    const res = await get(`${SUPPORT}/overview`, operatorToken).expect(200);

    expect((res.body as AdminOverview).keywords).toEqual({
      trackedMarkets: 5,
      searched: 4,
      storefronts: 3,
    });
  });

  it('gives the metrics scrape the number the plan shows', async () => {
    const res = await get(METRICS, operatorToken).expect(200);

    expect(res.text).toContain(
      `asobeast_workspace_keyword_markets{workspace="${WORKSPACE}"} 4`,
    );
    expect(res.text).toContain(
      `asobeast_workspace_keyword_markets{workspace="${NEIGHBOUR}"} 1`,
    );
  });

  it('keeps the per app count as what each app tracks', async () => {
    const res = await get(`${SUPPORT}/apps`, operatorToken)
      .query({ workspaceId: WORKSPACE })
      .expect(200);
    const counts = (res.body as AdminAppList).items.map(
      (item) => `${item.name}:${item.keywordMarkets}`,
    );

    expect(counts.sort()).toEqual([
      'First App:3',
      'Play App:1',
      'Second App:1',
    ]);
  });
});
