import { INestApplication } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';
import {
  SupportActionResult,
  SupportWorkspaceDetail,
  SupportWorkspaceSummary,
} from '@asobeast/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureAdminSurfaces } from '../src/admin-surfaces';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { JOBS, QUEUES } from '../src/jobs/jobs.types';
import { ownerAgent, useCookies } from './helpers/session';
import { obliterateQueues, pauseQueues } from './obliterate-queues';
import { testDb } from './helpers/test-db';
import {
  seedApiToken,
  seedWorkspace,
  truncateUsers,
} from './helpers/api-tokens';

const SUPPORT = '/admin/support/workspaces';
const OTHER_WORKSPACE = 'ws_support_target';
const TENANT_WORKSPACE = 'ws_support_tenant';
const FAILED_EVENT = 'evt_support_replay';

describe('Support tooling (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let owner: Awaited<ReturnType<typeof ownerAgent>>;

  const tenantOwnerToken = async () => {
    await seedWorkspace(prisma, TENANT_WORKSPACE, 'Tenant');
    return seedApiToken(prisma, {
      seed: 'supporttenant3333',
      email: 'owner@support-tenant.example.com',
      workspaceId: TENANT_WORKSPACE,
      role: 'owner',
    });
  };

  const memberToken = () =>
    seedApiToken(prisma, {
      seed: 'supportmember111',
      email: 'member@support.example.com',
      workspaceId: DEFAULT_WORKSPACE_ID,
      role: 'member',
    });

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
    await truncateUsers(prisma);
    await prisma.supportAccess.deleteMany({});
    owner = await ownerAgent(app);
  });

  afterAll(async () => {
    await prisma.billingEvent.deleteMany({ where: { id: FAILED_EVENT } });
    await prisma.supportAccess.deleteMany({});
    await prisma.workspace.deleteMany({
      where: { id: { in: [OTHER_WORKSPACE, TENANT_WORKSPACE] } },
    });
    await truncateUsers(prisma);
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

  describe('replaying a stored billing event', () => {
    const replay = (eventId = FAILED_EVENT) =>
      `${SUPPORT}/${OTHER_WORKSPACE}/billing-events/${eventId}/replay`;

    beforeEach(async () => {
      await prisma.billingEvent.deleteMany({ where: { id: FAILED_EVENT } });
      await prisma.billingEvent.create({
        data: {
          id: FAILED_EVENT,
          type: 'customer.subscription.updated',
          workspaceId: OTHER_WORKSPACE,
          createdAt: new Date(),
          payload: { id: FAILED_EVENT, data: { object: {} } },
          failure: 'Stripe price price_mystery is not in the price catalog',
        },
      });
    });

    it('clears the failure, queues the event again and records who asked', async () => {
      const queue = app.get<Queue>(getQueueToken(QUEUES.BILLING), {
        strict: false,
      });
      await queue.drain(true);

      const response = await owner
        .post(replay())
        .send({ confirm: true, reason: 'price added to the catalog' })
        .expect(201);

      expect((response.body as SupportActionResult).action).toBe('replay');
      await expect(
        prisma.billingEvent.findUniqueOrThrow({ where: { id: FAILED_EVENT } }),
      ).resolves.toMatchObject({ failure: null, processedAt: null });
      const queued = await queue.getJobs(['waiting', 'paused']);
      expect(
        queued
          .filter((job) => job.name === JOBS.BILLING_EVENT)
          .map((job) => job.data as unknown),
      ).toContainEqual({ eventId: FAILED_EVENT });
      await expect(
        prisma.supportAccess.findFirst({
          where: { workspaceId: OTHER_WORKSPACE, action: 'replay' },
        }),
      ).resolves.toMatchObject({ outcome: 'succeeded' });
    });

    it('is not found for the owner of another workspace', async () => {
      await request(app.getHttpServer())
        .post(replay())
        .set('Authorization', `Bearer ${await tenantOwnerToken()}`)
        .send({ confirm: true, reason: 'not mine to replay' })
        .expect(404);
    });

    it('answers 404 for an event nobody stored', async () => {
      await owner
        .post(replay('evt_nobody_stored'))
        .send({ confirm: true, reason: 'looking for a ghost' })
        .expect(404);
    });

    it('refuses a replay with no confirmation', async () => {
      await owner
        .post(replay())
        .send({ reason: 'price added to the catalog' })
        .expect(400);
    });
  });
});
