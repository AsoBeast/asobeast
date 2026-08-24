import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import {
  SupportActionResult,
  SupportWorkspaceDetail,
  SupportWorkspaceSummary,
} from '@asobeast/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureAdminSurfaces } from '../src/admin-surfaces';
import { AppModule } from '../src/app.module';
import { sha256 } from '../src/auth/password-hash';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { ownerAgent, useCookies } from './helpers/session';
import { obliterateQueues } from './obliterate-queues';
import { testDb } from './helpers/test-db';

const SUPPORT = '/admin/support/workspaces';
const OTHER_WORKSPACE = 'ws_support_target';
const TENANT_WORKSPACE = 'ws_support_tenant';

describe('Support tooling (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let owner: Awaited<ReturnType<typeof ownerAgent>>;

  function truncateUsers(): Promise<number> {
    return prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "User" RESTART IDENTITY CASCADE',
    );
  }

  async function tenantOwnerToken(): Promise<string> {
    const plaintext = `asob_${'supporttenant'.padEnd(48, '3')}`;
    await prisma.workspace.upsert({
      where: { id: TENANT_WORKSPACE },
      update: {},
      create: { id: TENANT_WORKSPACE, name: 'Tenant' },
    });
    const user = await prisma.user.upsert({
      where: { email: 'owner@support-tenant.example.com' },
      update: { role: 'owner', workspaceId: TENANT_WORKSPACE },
      create: {
        workspaceId: TENANT_WORKSPACE,
        email: 'owner@support-tenant.example.com',
        passwordHash: 'password-login-unused',
        role: 'owner',
      },
    });
    await prisma.apiToken.upsert({
      where: { tokenHash: sha256(plaintext) },
      update: {},
      create: {
        userId: user.id,
        name: 'e2e',
        tokenHash: sha256(plaintext),
        prefix: plaintext.slice(0, 12),
      },
    });
    return plaintext;
  }

  async function memberToken(): Promise<string> {
    const plaintext = `asob_${'member'.padEnd(48, '1')}`;
    const user = await prisma.user.upsert({
      where: { email: 'member@support.example.com' },
      update: { role: 'member' },
      create: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        email: 'member@support.example.com',
        passwordHash: 'password-login-unused',
        role: 'member',
      },
    });
    await prisma.apiToken.upsert({
      where: { tokenHash: sha256(plaintext) },
      update: {},
      create: {
        userId: user.id,
        name: 'e2e',
        tokenHash: sha256(plaintext),
        prefix: plaintext.slice(0, 12),
      },
    });
    return plaintext;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    useCookies(app);
    configureAdminSurfaces(app);
    await app.init();

    prisma = testDb();
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: {},
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
    await prisma.workspace.upsert({
      where: { id: OTHER_WORKSPACE },
      update: { suspendedAt: null, suspendedReason: null },
      create: { id: OTHER_WORKSPACE, name: 'Target' },
    });
    await truncateUsers();
    await prisma.supportAccess.deleteMany({});
    owner = await ownerAgent(app);
  });

  afterAll(async () => {
    await prisma.supportAccess.deleteMany({});
    await prisma.workspace.deleteMany({
      where: { id: { in: [OTHER_WORKSPACE, TENANT_WORKSPACE] } },
    });
    await truncateUsers();
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  it('is not found without credentials', async () => {
    await request(app.getHttpServer()).get(SUPPORT).expect(404);
  });

  it('is not found for a member', async () => {
    await request(app.getHttpServer())
      .get(SUPPORT)
      .set('Authorization', `Bearer ${await memberToken()}`)
      .expect(404);
  });

  it('is not found for the owner of another workspace', async () => {
    await request(app.getHttpServer())
      .get(SUPPORT)
      .set('Authorization', `Bearer ${await tenantOwnerToken()}`)
      .expect(404);
  });

  it('refuses a mutation from the owner of another workspace', async () => {
    await request(app.getHttpServer())
      .post(`${SUPPORT}/${OTHER_WORKSPACE}/suspend`)
      .set('Authorization', `Bearer ${await tenantOwnerToken()}`)
      .send({ confirm: true, reason: 'not mine to suspend' })
      .expect(404);

    await expect(
      prisma.workspace.findUnique({ where: { id: OTHER_WORKSPACE } }),
    ).resolves.toMatchObject({ suspendedAt: null });
  });

  it('lists every workspace with operational state only', async () => {
    const response = await owner.get(SUPPORT).expect(200);
    const body = response.body as SupportWorkspaceSummary[];
    const target = body.find(
      (workspace) => workspace.workspaceId === OTHER_WORKSPACE,
    );

    expect(target).toMatchObject({
      name: 'Target',
      apps: 0,
      keywordMarkets: 0,
      suspendedAt: null,
    });
    expect(JSON.stringify(body)).not.toContain('passwordHash');
  });

  it('reports run history, failed jobs and the audit trail for one workspace', async () => {
    const response = await owner
      .get(`${SUPPORT}/${OTHER_WORKSPACE}`)
      .expect(200);
    const body = response.body as SupportWorkspaceDetail;

    expect(body.workspaceId).toBe(OTHER_WORKSPACE);
    expect(Array.isArray(body.runHistory)).toBe(true);
    expect(Array.isArray(body.failedJobs)).toBe(true);
    expect(body.limits).toHaveProperty('keywordMarkets');
  });

  it('answers 404 for a workspace that does not exist', async () => {
    await owner.get(`${SUPPORT}/ws_missing`).expect(404);
  });

  it('refuses a mutation with no confirmation', async () => {
    await owner
      .post(`${SUPPORT}/${OTHER_WORKSPACE}/suspend`)
      .send({ reason: 'abuse investigation' })
      .expect(400);
  });

  it('refuses a mutation with no reason', async () => {
    await owner
      .post(`${SUPPORT}/${OTHER_WORKSPACE}/suspend`)
      .send({ confirm: true })
      .expect(400);
  });

  it('suspends and restores a workspace, recording who and why', async () => {
    const suspended = await owner
      .post(`${SUPPORT}/${OTHER_WORKSPACE}/suspend`)
      .send({ confirm: true, reason: 'sustained rate limit abuse' })
      .expect(201);
    expect((suspended.body as SupportActionResult).action).toBe('suspend');

    await expect(
      prisma.workspace.findUnique({ where: { id: OTHER_WORKSPACE } }),
    ).resolves.toMatchObject({ suspendedReason: 'sustained rate limit abuse' });

    await owner
      .post(`${SUPPORT}/${OTHER_WORKSPACE}/restore`)
      .send({ confirm: true, reason: 'customer fixed their integration' })
      .expect(201);

    const trail = await prisma.supportAccess.findMany({
      where: { workspaceId: OTHER_WORKSPACE },
      orderBy: { createdAt: 'asc' },
    });
    expect(trail.map((entry) => entry.action)).toEqual(
      expect.arrayContaining(['view', 'suspend', 'restore']),
    );
    expect(trail.every((entry) => entry.actorEmail.length > 0)).toBe(true);
  });

  it('records a read of the list as well as a mutation', async () => {
    await owner.get(SUPPORT).expect(200);

    await expect(
      prisma.supportAccess.count({ where: { action: 'list' } }),
    ).resolves.toBeGreaterThan(0);
  });

  it('records a succeeded outcome once the action has run', async () => {
    await owner
      .post(`${SUPPORT}/${OTHER_WORKSPACE}/restore`)
      .send({ confirm: true, reason: 'outcome trail check' })
      .expect(201);

    const [entry] = await prisma.supportAccess.findMany({
      where: { workspaceId: OTHER_WORKSPACE, action: 'restore' },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });
    expect(entry).toMatchObject({ outcome: 'succeeded' });
  });

  it('records a failed outcome instead of implying the action happened', async () => {
    await owner
      .post(`${SUPPORT}/ws_missing/suspend`)
      .send({ confirm: true, reason: 'workspace does not exist' })
      .expect(404);

    const [entry] = await prisma.supportAccess.findMany({
      where: { workspaceId: 'ws_missing', action: 'suspend' },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });
    expect(entry).toMatchObject({ outcome: 'failed' });
    expect(entry.detail).toBeTruthy();
  });
});
