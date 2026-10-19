import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import {
  API_TOKEN_PREFIX,
  ApiErrorEnvelope,
  CapacityReport,
  ProxyPoolHealth,
} from '@asobeast/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureAdminSurfaces } from '../src/admin-surfaces';
import { configureSecurityHeaders } from '../src/security-headers';
import { AppModule } from '../src/app.module';
import { testDb } from './helpers/test-db';
import {
  seedApiToken,
  seedWorkspace,
  truncateUsers,
} from './helpers/api-tokens';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { QUEUES as QUEUE_NAMES } from '../src/jobs/jobs.types';
import {
  awaitBurnHeadroom,
  SHORT_BURN_HEADROOM_SECONDS,
} from './helpers/burn-headroom';
import { ownerAgent, useCookies } from './helpers/session';
import { CREDENTIAL_FAILURES_PER_MINUTE } from '../src/auth/rate-limit/credential-rate.limiter';
import {
  clearRateLimitCounters,
  obliterateQueues,
  spendCredentialBudget,
} from './obliterate-queues';

const TENANT_WORKSPACE = 'ws_tenant_owner';
const REFUSED_TOKEN = `${API_TOKEN_PREFIX}${'7'.repeat(48)}`;
const QUEUES = '/admin/queues';
const DOCS = '/docs';
const METRICS = '/metrics';
const SUPPORT = '/admin/support';
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

  const tenantOwnerToken = async () => {
    await seedWorkspace(prisma, TENANT_WORKSPACE, 'Tenant');
    return seedApiToken(prisma, {
      seed: 'tenantowner2222',
      email: 'owner@tenant.example.com',
      workspaceId: TENANT_WORKSPACE,
      role: 'owner',
    });
  };

  const tokenFor = (role: string, scope = 'read') =>
    seedApiToken(prisma, {
      seed: `${role}${scope}`,
      email: `${role}@tokens.example.com`,
      workspaceId: DEFAULT_WORKSPACE_ID,
      role,
      scope,
    });

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
    await truncateUsers(prisma);
    owner = await ownerAgent(app);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await truncateUsers(prisma);
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

  describe('every method on every admin route', () => {
    const AREA = [
      '/admin/capacity',
      '/admin/capacity/',
      '/ADMIN/CAPACITY',
      '/admin/proxy-pool',
      '/admin/proxy-pool/',
      '/admin/does-not-exist',
    ];
    const ROUTES = [
      ...SURFACES,
      `${QUEUES}/api/queues`,
      `${SUPPORT}/workspaces`,
      `${SUPPORT}/overview`,
      ...AREA,
    ];
    const METHODS = [
      'get',
      'head',
      'post',
      'put',
      'patch',
      'delete',
      'options',
    ] as const;

    describe.each(ROUTES)('%s', (route) => {
      it.each(METHODS)(
        'answers an anonymous %s with not found',
        async (method) => {
          const res = await request(app.getHttpServer())
            [method](route)
            .expect(404);

          expect(res.headers['x-robots-tag']).toBe('noindex, nofollow');
          expect(res.headers['cache-control']).toBe('no-store');
        },
      );

      it.each(METHODS)(
        'answers a member token %s with not found',
        async (method) => {
          await request(app.getHttpServer())
            [method](route)
            .set('Authorization', `Bearer ${await tokenFor('member')}`)
            .expect(404);
        },
      );

      it.each(['get', 'post'] as const)(
        'answers the owner of another workspace %s with not found',
        async (method) => {
          await request(app.getHttpServer())
            [method](route)
            .set('Authorization', `Bearer ${await tenantOwnerToken()}`)
            .expect(404);
        },
      );
    });

    it('serves the operator an admin route whatever its case, as the gate covers it', async () => {
      await owner.get('/ADMIN/CAPACITY').expect(200);
    });

    it('answers a read token the methods that change state with not found, and still serves its reads', async () => {
      const token = await tokenFor('owner', 'read');

      await request(app.getHttpServer())
        .post('/admin/capacity')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
      await request(app.getHttpServer())
        .get('/admin/capacity')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
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

  describe('rejected credentials', () => {
    const present = (path: string, authorization: string) =>
      request(app.getHttpServer())
        .get(path)
        .set('Authorization', authorization);

    beforeEach(async () => {
      await clearRateLimitCounters(app);
      await awaitBurnHeadroom(SHORT_BURN_HEADROOM_SECONDS);
    });
    afterAll(() => clearRateLimitCounters(app));

    const COUNTED = [
      ...SURFACES,
      `${SUPPORT}/workspaces`,
      '/admin/capacity',
      '/admin/proxy-pool',
    ];

    it.each(COUNTED)(
      'counts a refused token presented to %s against its address',
      async (surface) => {
        await present(surface, `Bearer ${REFUSED_TOKEN}`).expect(404);

        expect(
          await spendCredentialBudget(app, CREDENTIAL_FAILURES_PER_MINUTE),
        ).toBe(1);
        await present('/apps', `Bearer ${REFUSED_TOKEN}`).expect(429);
      },
    );

    it('does not echo the query string of a refused admin request', async () => {
      const response = await present(
        `${DOCS}-json?token=${REFUSED_TOKEN}`,
        `Bearer ${REFUSED_TOKEN}`,
      ).expect(404);

      expect((response.body as ApiErrorEnvelope).path).toBe('/docs-json');
      expect(JSON.stringify(response.body)).not.toContain(REFUSED_TOKEN);
    });

    it.each(['/admin/capacity', '/admin/proxy-pool'])(
      'answers a spent budget at %s with the same not found',
      async (route) => {
        await present(route, `Bearer ${REFUSED_TOKEN}`).expect(404);
        expect(
          await spendCredentialBudget(app, CREDENTIAL_FAILURES_PER_MINUTE),
        ).toBe(1);

        await present(route, `Bearer ${REFUSED_TOKEN}`).expect(404);
        await owner.get(route).expect(200);
      },
    );

    it.each(['/admin/capacity', '/admin/proxy-pool'])(
      'never counts an accepted credential that is not the operator at %s',
      async (route) => {
        await present(route, `Bearer ${await tokenFor('member')}`).expect(404);
        await present(route, `Bearer ${await tenantOwnerToken()}`).expect(404);

        expect(
          await spendCredentialBudget(app, CREDENTIAL_FAILURES_PER_MINUTE),
        ).toBe(0);
      },
    );

    it('answers a spent budget with the same not found', async () => {
      await present(DOCS, `Bearer ${REFUSED_TOKEN}`).expect(404);
      expect(
        await spendCredentialBudget(app, CREDENTIAL_FAILURES_PER_MINUTE),
      ).toBe(1);

      await present(DOCS, `Bearer ${REFUSED_TOKEN}`).expect(404);
      await owner.get(DOCS).expect(200);
    });

    it('never counts an accepted credential that is not the operator', async () => {
      await present(DOCS, `Bearer ${await tokenFor('member')}`).expect(404);
      await present(DOCS, `Bearer ${await tenantOwnerToken()}`).expect(404);

      expect(
        await spendCredentialBudget(app, CREDENTIAL_FAILURES_PER_MINUTE),
      ).toBe(0);
    });
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

  it.each(['/admin/capacity', '/admin/proxy-pool'])(
    '%s is never stored by a browser or a proxy',
    async (path) => {
      const response = await owner.get(path).expect(200);

      expect(response.headers['cache-control']).toBe('no-store');
    },
  );

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

    it('is not found without credentials', async () => {
      await request(app.getHttpServer()).get('/admin/proxy-pool').expect(404);
    });

    it('is not found for the owner of another workspace', async () => {
      await request(app.getHttpServer())
        .get('/admin/proxy-pool')
        .set('Authorization', `Bearer ${await tenantOwnerToken()}`)
        .expect(404);
    });
  });

  describe('/admin/capacity', () => {
    it('is not found without credentials', async () => {
      await request(app.getHttpServer()).get('/admin/capacity').expect(404);
    });

    it('reports demand against capacity to an owner', async () => {
      const response = await owner.get('/admin/capacity').expect(200);
      const body = response.body as CapacityReport;

      expect(body.requestsPerDay).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(body.workspaces)).toBe(true);
    });

    it('breaks demand down by store without naming the consumers', async () => {
      await prisma.app.create({
        data: {
          workspaceId: DEFAULT_WORKSPACE_ID,
          store: 'APP_STORE',
          storeAppId: '200000001',
          name: 'Capacity Probe',
        },
      });

      const response = await owner.get('/admin/capacity').expect(200);
      const body = response.body as CapacityReport;

      expect(body.stores?.length).toBeGreaterThan(0);
      for (const store of body.stores ?? []) {
        expect(store).toEqual({
          store: expect.any(String) as string,
          requestsPerDay: expect.any(Number) as number,
          capacityPerDay: expect.any(Number) as number,
          utilization: expect.any(Number) as number,
        });
      }
      expect(body.workspaces.length).toBeGreaterThan(0);
      for (const consumer of body.workspaces) {
        expect(consumer).not.toHaveProperty('name');
      }
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
