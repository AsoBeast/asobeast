import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { CapacityReport, ProxyPoolHealth } from '@asobeast/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureAdminSurfaces } from '../src/admin-surfaces';
import { configureSecurityHeaders } from '../src/security-headers';
import { AppModule } from '../src/app.module';
import { testDb } from './helpers/test-db';
import { sha256 } from '../src/auth/password-hash';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { QUEUES as QUEUE_NAMES } from '../src/jobs/jobs.types';
import { ownerAgent, useCookies } from './helpers/session';
import { obliterateQueues } from './obliterate-queues';

const TENANT_WORKSPACE = 'ws_tenant_owner';
const QUEUES = '/admin/queues';
const DOCS = '/docs';
const METRICS = '/metrics';
const SURFACES = [QUEUES, DOCS, '/docs-json', '/docs-yaml', METRICS];

interface OpenApiSurface {
  servers: Array<{ url: string; description: string }>;
  components: { securitySchemes: Record<string, unknown> };
  security: Array<Record<string, string[]>>;
}

describe('Admin surfaces (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let owner: Awaited<ReturnType<typeof ownerAgent>>;

  function truncateUsers(): Promise<number> {
    return prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "User" RESTART IDENTITY CASCADE',
    );
  }

  async function tenantOwnerToken(): Promise<string> {
    const plaintext = `asob_${'tenantowner'.padEnd(48, '2')}`;
    await prisma.workspace.upsert({
      where: { id: TENANT_WORKSPACE },
      update: {},
      create: { id: TENANT_WORKSPACE, name: 'Tenant' },
    });
    const user = await prisma.user.upsert({
      where: { email: 'owner@tenant.example.com' },
      update: { role: 'owner', workspaceId: TENANT_WORKSPACE },
      create: {
        workspaceId: TENANT_WORKSPACE,
        email: 'owner@tenant.example.com',
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

  async function tokenFor(role: string, scope = 'read'): Promise<string> {
    const plaintext = `asob_${`${role}${scope}`.padEnd(48, '0')}`;
    const user = await prisma.user.upsert({
      where: { email: `${role}@tokens.example.com` },
      update: { role },
      create: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        email: `${role}@tokens.example.com`,
        passwordHash: 'password-login-unused',
        role,
      },
    });
    await prisma.apiToken.upsert({
      where: { tokenHash: sha256(plaintext) },
      update: { scope },
      create: {
        userId: user.id,
        name: 'e2e',
        tokenHash: sha256(plaintext),
        prefix: plaintext.slice(0, 12),
        scope,
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
    configureSecurityHeaders(app);
    configureAdminSurfaces(app);
    await app.init();

    prisma = testDb();
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: {},
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
    await truncateUsers();
    owner = await ownerAgent(app);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await truncateUsers();
    await obliterateQueues(app);
    await app.close();
  });

  describe.each(SURFACES)('%s', (surface) => {
    it('is not found without credentials', async () => {
      const res = await request(app.getHttpServer()).get(surface).expect(404);
      expect(res.headers['x-robots-tag']).toBe('noindex, nofollow');
      expect(res.headers['cache-control']).toBe('no-store');
    });

    it('is not found for a member', async () => {
      await request(app.getHttpServer())
        .get(surface)
        .set('Authorization', `Bearer ${await tokenFor('member')}`)
        .expect(404);
    });

    it('is served to an owner session', async () => {
      await owner.get(surface).expect(200);
    });

    it('is served to an owner api token', async () => {
      await request(app.getHttpServer())
        .get(surface)
        .set('Authorization', `Bearer ${await tokenFor('owner')}`)
        .expect(200);
    });

    it('is not found for the owner of another workspace', async () => {
      await request(app.getHttpServer())
        .get(surface)
        .set('Authorization', `Bearer ${await tenantOwnerToken()}`)
        .expect(404);
    });
  });

  it('describes servers and bearer auth in the openapi document', async () => {
    const response = await owner.get('/docs-json').expect(200);
    const document = response.body as OpenApiSurface;

    expect(document.servers).toEqual([
      {
        url: 'http://localhost:3000/api/backend',
        description: 'Web origin proxy',
      },
      { url: 'http://localhost:4000', description: 'Direct API' },
    ]);
    expect(document.components.securitySchemes.personalApiToken).toEqual({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'asob',
    });
    expect(document.security).toEqual([{ personalApiToken: [] }]);
  });

  it('serves the queue dashboard assets to an owner', async () => {
    await owner.get(`${QUEUES}/api/queues`).expect(200);
  });

  describe('queue mutations', () => {
    const PAUSE_ALL = `${QUEUES}/api/queues/pause`;
    const RESUME_ALL = `${QUEUES}/api/queues/resume`;
    const pipeline = () =>
      app.get<Queue>(getQueueToken(QUEUE_NAMES.PIPELINE), { strict: false });

    afterEach(async () => {
      await owner.put(RESUME_ALL);
    });

    it('refuses a read-only owner token and leaves the queue running', async () => {
      await request(app.getHttpServer())
        .put(PAUSE_ALL)
        .set('Authorization', `Bearer ${await tokenFor('owner', 'read')}`)
        .expect(404);

      expect(await pipeline().isPaused()).toBe(false);
    });

    it('still lets a read-only owner token read the dashboard api', async () => {
      await request(app.getHttpServer())
        .get(`${QUEUES}/api/queues`)
        .set('Authorization', `Bearer ${await tokenFor('owner', 'read')}`)
        .expect(200);
    });

    it('lets a write-scoped owner token pause the queues', async () => {
      await request(app.getHttpServer())
        .put(PAUSE_ALL)
        .set('Authorization', `Bearer ${await tokenFor('owner', 'write')}`)
        .expect(200);

      expect(await pipeline().isPaused()).toBe(true);
    });

    it('lets an owner session pause the queues', async () => {
      await owner.put(PAUSE_ALL).expect(200);

      expect(await pipeline().isPaused()).toBe(true);
    });
  });

  describe('while the workspace is suspended', () => {
    const suspend = (suspendedAt: Date | null) =>
      prisma.workspace.update({
        where: { id: DEFAULT_WORKSPACE_ID },
        data: { suspendedAt, suspendedReason: suspendedAt ? 'abuse' : null },
      });

    beforeAll(() => suspend(new Date()));
    afterAll(() => suspend(null));

    it('hides the queue dashboard from an owner session', async () => {
      await owner.get(QUEUES).expect(404);
    });

    it('hides the queue dashboard api from an owner session', async () => {
      await owner.get(`${QUEUES}/api/queues`).expect(404);
    });

    it('keeps the openapi surface readable by an owner session', async () => {
      await owner.get(DOCS).expect(200);
    });

    it.each(SURFACES)('hides %s from an owner api token', async (surface) => {
      await request(app.getHttpServer())
        .get(surface)
        .set('Authorization', `Bearer ${await tokenFor('owner')}`)
        .expect(404);
    });
  });

  it('hides the queue dashboard assets without credentials', async () => {
    await request(app.getHttpServer()).get(`${QUEUES}/api/queues`).expect(404);
  });

  describe(METRICS, () => {
    it('exposes per-workspace series in the scrape format to an owner', async () => {
      const response = await owner.get(METRICS).expect(200);

      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.text).toContain(
        `asobeast_workspace_apps{workspace="${DEFAULT_WORKSPACE_ID}"}`,
      );
      expect(response.text).toContain('# TYPE asobeast_billing_trials_active');
      expect(response.text).toContain(
        `asobeast_workspace_plan_info{workspace="${DEFAULT_WORKSPACE_ID}",plan=`,
      );
    });
  });

  describe('/admin/proxy-pool', () => {
    it('reports the pool to an owner', async () => {
      const response = await owner.get('/admin/proxy-pool').expect(200);
      const body = response.body as ProxyPoolHealth;

      expect(body.enabled).toBe(false);
      expect(body.stores.map((store) => store.store).sort()).toEqual([
        'APP_STORE',
        'GOOGLE_PLAY',
      ]);
      expect(body.residential.configured).toBe(false);
      expect(body.alerts).toEqual([]);
    });

    it('is not found for a member', async () => {
      await request(app.getHttpServer())
        .get('/admin/proxy-pool')
        .set('Authorization', `Bearer ${await tokenFor('member')}`)
        .expect(404);
    });

    it('is unauthorized without credentials', async () => {
      await request(app.getHttpServer()).get('/admin/proxy-pool').expect(401);
    });

    it('is not found for the owner of another workspace', async () => {
      await request(app.getHttpServer())
        .get('/admin/proxy-pool')
        .set('Authorization', `Bearer ${await tenantOwnerToken()}`)
        .expect(404);
    });
  });

  describe('/admin/capacity', () => {
    it('reports demand against capacity to an owner', async () => {
      const response = await owner.get('/admin/capacity').expect(200);
      const body = response.body as CapacityReport;

      expect(body.requestsPerDay).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(body.workspaces)).toBe(true);
    });

    it('is not found for a member', async () => {
      await request(app.getHttpServer())
        .get('/admin/capacity')
        .set('Authorization', `Bearer ${await tokenFor('member')}`)
        .expect(404);
    });

    it('is not found for the owner of another workspace', async () => {
      await request(app.getHttpServer())
        .get('/admin/capacity')
        .set('Authorization', `Bearer ${await tenantOwnerToken()}`)
        .expect(404);
    });
  });
});
