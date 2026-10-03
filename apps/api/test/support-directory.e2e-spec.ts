import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import {
  ADMIN_LIST_LIMIT,
  PLAN_NAMES,
  STORES,
  type AdminAppList,
  type AdminOverview,
  type AdminUserList,
} from '@asobeast/shared';
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
const USERS = '/admin/support/users';
const APPS = '/admin/support/apps';
const SECRET_FIELDS = [
  'passwordHash',
  'verificationHash',
  'resetHash',
  'tokenHash',
  'sessionVersion',
];
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
    await prisma.supportAccess.deleteMany({});
    await prisma.workspace.deleteMany({ where: { id: TENANT_WORKSPACE } });
    await truncateUsers(prisma);
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  const withBearer = (path: string, token: string) =>
    request(app.getHttpServer())
      .get(path)
      .set('Authorization', `Bearer ${token}`);

  const asBearer = (token: string) => withBearer(OVERVIEW, token);

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
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60_000);
      expect(body.users).toEqual({
        total: await prisma.user.count(),
        emailVerified: await prisma.user.count({
          where: { emailVerifiedAt: { not: null } },
        }),
        joinedLast7Days: await prisma.user.count({
          where: { createdAt: { gte: weekAgo } },
        }),
        joinedLast30Days: await prisma.user.count(),
      });
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

  describe.each([USERS, APPS])(
    '%s refuses everyone but the operator',
    (path) => {
      it('is not found without credentials', async () => {
        await request(app.getHttpServer()).get(path).expect(404);
      });

      it('is not found for a member token', async () => {
        await withBearer(path, memberToken).expect(404);
      });

      it('is not found for the owner of another workspace', async () => {
        await withBearer(path, tenantOwnerToken).expect(404);
      });
    },
  );

  describe('GET /admin/support/users', () => {
    it('lists every account newest first with its workspace', async () => {
      const res = await owner.get(USERS).expect(200);
      const body = res.body as AdminUserList;
      const total = await prisma.user.count();
      const created = body.items.map((user) => user.createdAt);

      expect(body.limit).toBe(ADMIN_LIST_LIMIT);
      expect(body.total).toBe(total);
      expect(body.items).toHaveLength(total);
      expect(created).toEqual([...created].sort().reverse());
      expect(
        body.items.find(
          (user) => user.email === 'owner@directory-tenant.example.com',
        ),
      ).toMatchObject({
        workspaceId: TENANT_WORKSPACE,
        workspaceName: 'Directory Tenant',
        workspacePlan: 'free',
        role: 'owner',
        emailVerified: false,
        platformOperator: false,
      });
      expect(
        body.items.find((user) => user.email === 'owner@example.com'),
      ).toMatchObject({
        workspaceId: DEFAULT_WORKSPACE_ID,
        platformOperator: true,
      });
    });

    it('never carries a credential or session field', async () => {
      const res = await owner.get(USERS).expect(200);
      const raw = JSON.stringify(res.body);
      for (const field of SECRET_FIELDS) {
        expect(raw).not.toMatch(field);
      }
    });

    it('narrows to one workspace', async () => {
      const res = await owner
        .get(USERS)
        .query({ workspaceId: TENANT_WORKSPACE })
        .expect(200);
      const body = res.body as AdminUserList;

      expect(body.total).toBe(
        await prisma.user.count({ where: { workspaceId: TENANT_WORKSPACE } }),
      );
      expect(body.items.length).toBeGreaterThan(0);
      expect(
        body.items.every((user) => user.workspaceId === TENANT_WORKSPACE),
      ).toBe(true);
    });

    it('lists nothing for a workspace that does not exist', async () => {
      const res = await owner
        .get(USERS)
        .query({ workspaceId: 'ws_missing' })
        .expect(200);
      expect(res.body).toEqual({
        items: [],
        total: 0,
        limit: ADMIN_LIST_LIMIT,
      });
    });

    it.each([
      ['an overlong workspace id', { workspaceId: 'w'.repeat(65) }],
      ['an empty workspace id', { workspaceId: '' }],
      ['an unknown parameter', { x: '1' }],
    ])('refuses %s', async (_, query) => {
      await owner.get(USERS).query(query).expect(400);
    });
  });

  describe('GET /admin/support/apps', () => {
    it('lists tracked apps only, with competitor and keyword counts', async () => {
      const res = await owner
        .get(APPS)
        .query({ workspaceId: TENANT_WORKSPACE })
        .expect(200);
      const body = res.body as AdminAppList;

      expect(body.total).toBe(2);
      expect(body.limit).toBe(ADMIN_LIST_LIMIT);
      expect(body.items.map((item) => item.name).sort()).toEqual([
        'Tenant Habits',
        'Tenant Habits for Android',
      ]);
      expect(
        body.items.find((item) => item.store === 'APP_STORE'),
      ).toMatchObject({
        workspaceId: TENANT_WORKSPACE,
        workspaceName: 'Directory Tenant',
        storeAppId: '100000001',
        country: 'us',
        competitors: 1,
        keywordMarkets: 2,
      });
      expect(
        body.items.find((item) => item.store === 'GOOGLE_PLAY'),
      ).toMatchObject({ competitors: 0, keywordMarkets: 0 });
    });
  });

  it('writes every directory read to the support audit trail', async () => {
    await prisma.supportAccess.deleteMany({});
    const users = (await owner.get(USERS).expect(200)).body as AdminUserList;
    const apps = (await owner.get(APPS).expect(200)).body as AdminAppList;
    await owner.get(APPS).query({ workspaceId: TENANT_WORKSPACE }).expect(200);

    const trail = await prisma.supportAccess.findMany({
      orderBy: { createdAt: 'asc' },
      select: { action: true, outcome: true, workspaceId: true, detail: true },
    });
    expect(trail).toEqual([
      {
        action: 'list',
        outcome: 'succeeded',
        workspaceId: 'all',
        detail: `listed ${users.items.length} users`,
      },
      {
        action: 'list',
        outcome: 'succeeded',
        workspaceId: 'all',
        detail: `listed ${apps.items.length} apps`,
      },
      {
        action: 'list',
        outcome: 'succeeded',
        workspaceId: TENANT_WORKSPACE,
        detail: 'listed 2 apps',
      },
    ]);
  });
});
