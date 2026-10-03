import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { PLAN_NAMES, STORES, type AdminOverview } from '@asobeast/shared';
import * as argon2 from 'argon2';
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
import { ownerAgent, useCookies } from './helpers/session';
import { testDb } from './helpers/test-db';
import { obliterateQueues, pauseQueues } from './obliterate-queues';

const OVERVIEW = '/admin/support/overview';
const TENANT_WORKSPACE = 'ws_directory_tenant';
const MEMBER = {
  email: 'member@directory.example.com',
  password: 'membersecret1',
};

describe('Support directory (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let owner: Awaited<ReturnType<typeof ownerAgent>>;
  let tenantOwnerToken: string;
  let memberToken: string;
  let operatorToken: string;

  async function seedTenant(): Promise<void> {
    await seedWorkspace(prisma, TENANT_WORKSPACE, 'Directory Tenant');
    const appStore = await prisma.app.create({
      data: {
        workspaceId: TENANT_WORKSPACE,
        store: 'APP_STORE',
        storeAppId: '100000001',
        name: 'Tenant Habits',
      },
    });
    await prisma.app.create({
      data: {
        workspaceId: TENANT_WORKSPACE,
        store: 'GOOGLE_PLAY',
        storeAppId: 'com.tenant.habits',
        name: 'Tenant Habits for Android',
      },
    });
    await prisma.app.create({
      data: {
        workspaceId: TENANT_WORKSPACE,
        store: 'APP_STORE',
        storeAppId: '100000002',
        name: 'Rival Habits',
        isCompetitor: true,
        primaryAppId: appStore.id,
      },
    });
    for (const country of ['us', 'gb']) {
      const keyword = await prisma.keyword.create({
        data: { text: 'habit tracker', store: 'APP_STORE', country },
      });
      await prisma.trackedKeyword.create({
        data: { appId: appStore.id, keywordId: keyword.id, source: 'MANUAL' },
      });
    }
  }

  async function memberSession() {
    await prisma.user.upsert({
      where: { email: MEMBER.email },
      update: {},
      create: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        email: MEMBER.email,
        passwordHash: await argon2.hash(MEMBER.password),
        role: 'member',
      },
    });
    const agent = request.agent(app.getHttpServer());
    await agent.post('/auth/login').send(MEMBER).expect(200);
    return agent;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    useCookies(app);
    configureAdminSurfaces(app);
    await app.init();
    await pauseQueues(app);

    prisma = testDb();
    await seedWorkspace(prisma, DEFAULT_WORKSPACE_ID, 'Default');
    await truncateUsers(prisma);
    owner = await ownerAgent(app);
    await seedTenant();
    tenantOwnerToken = await seedApiToken(prisma, {
      seed: 'directorytenant',
      email: 'owner@directory-tenant.example.com',
      workspaceId: TENANT_WORKSPACE,
      role: 'owner',
    });
    memberToken = await seedApiToken(prisma, {
      seed: 'directorymember',
      email: 'member-token@directory.example.com',
      workspaceId: DEFAULT_WORKSPACE_ID,
      role: 'member',
    });
    operatorToken = await seedApiToken(prisma, {
      seed: 'directoryoperator',
      email: 'operator-token@directory.example.com',
      workspaceId: DEFAULT_WORKSPACE_ID,
      role: 'owner',
    });
  });

  afterAll(async () => {
    await prisma.workspace.deleteMany({ where: { id: TENANT_WORKSPACE } });
    await truncateUsers(prisma);
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  const asBearer = (token: string) =>
    request(app.getHttpServer())
      .get(OVERVIEW)
      .set('Authorization', `Bearer ${token}`);

  describe('GET /admin/support/overview', () => {
    it('is not found without credentials, with hardened headers', async () => {
      const res = await request(app.getHttpServer()).get(OVERVIEW).expect(404);
      expect(res.headers['x-robots-tag']).toBe('noindex, nofollow');
      expect(res.headers['cache-control']).toBe('no-store');
    });

    it('is not found for a member token', async () => {
      await asBearer(memberToken).expect(404);
    });

    it('is not found for the owner of another workspace', async () => {
      await asBearer(tenantOwnerToken).expect(404);
    });

    it('is not found for a member session', async () => {
      const member = await memberSession();
      await member.get(OVERVIEW).expect(404);
    });

    it('counts every workspace for the operator session', async () => {
      const res = await owner.get(OVERVIEW).expect(200);
      const body = res.body as AdminOverview;
      const today = new Date().toISOString().slice(0, 10);

      expect(body.billing).toBe(false);
      expect(body.workspaces.total).toBeGreaterThanOrEqual(2);
      expect(body.workspaces.byPlan.map((row) => row.key)).toEqual([
        ...PLAN_NAMES,
      ]);
      expect(body.users.total).toBe(await prisma.user.count());
      expect(body.apps).toEqual({
        tracked: 2,
        competitors: 1,
        byStore: STORES.map((key) => ({ key, count: 1 })),
      });
      expect(body.keywords).toEqual({
        trackedMarkets: 2,
        searched: 2,
        storefronts: 2,
      });
      expect(body.aiCallsThisMonth).toBeGreaterThanOrEqual(0);
      expect(body.signups).toHaveLength(30);
      expect(body.signups.at(-1)?.date).toBe(today);
      expect(body.signups.at(-1)?.users).toBeGreaterThanOrEqual(1);
    });

    it('answers the operator read token', async () => {
      await asBearer(operatorToken).expect(200);
    });
  });
});
