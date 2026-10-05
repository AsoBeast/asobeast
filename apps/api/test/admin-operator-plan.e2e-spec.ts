import './helpers/enable-billing';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { AuthUser } from '@asobeast/shared';
import { App } from 'supertest/types';
import { configureAdminSurfaces } from '../src/admin-surfaces';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { restoreAuthEnv } from './helpers/auth-env';
import { ownerAgent, useCookies } from './helpers/session';
import { truncateUsers } from './helpers/api-tokens';
import { testDb } from './helpers/test-db';
import { obliterateQueues, pauseQueues } from './obliterate-queues';

const DAY_MS = 24 * 60 * 60 * 1000;

const SUPPORT_READS = [
  '/admin/support/overview',
  '/admin/support/workspaces',
  '/admin/support/users',
  '/admin/support/apps',
];

const OPERATOR_SURFACES = ['/admin/queues', '/metrics', '/docs'];

describe('Admin area for an operator without a plan (billing mode)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let operator: Awaited<ReturnType<typeof ownerAgent>>;

  const setPlan = (data: {
    plan: string;
    trialEndsAt: Date | null;
    planExpiresAt: Date | null;
  }) =>
    prisma.workspace.update({
      where: { id: DEFAULT_WORKSPACE_ID },
      data,
    });

  const withoutPlan = () =>
    setPlan({ plan: 'free', trialEndsAt: null, planExpiresAt: null });

  const withPlan = () =>
    setPlan({
      plan: 'indie',
      trialEndsAt: null,
      planExpiresAt: new Date(Date.now() + 30 * DAY_MS),
    });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication<App>();
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
    await truncateUsers(prisma);
    operator = await ownerAgent(app);
  });

  afterAll(async () => {
    await truncateUsers(prisma);
    await obliterateQueues(app);
    await app.close();
    restoreAuthEnv();
    await prisma.$disconnect();
  });

  it('is still the platform operator, and says it has no plan', async () => {
    await withoutPlan();

    const me = (await operator.get('/auth/me').expect(200)).body as AuthUser;

    expect(me.platformOperator).toBe(true);
    expect(me.entitled).toBe(false);
  });

  describe('without a plan', () => {
    beforeAll(withoutPlan);

    it.each(SUPPORT_READS)('answers 404 to GET %s', async (path) => {
      await operator.get(path).expect(404);
    });

    it.each(OPERATOR_SURFACES)('answers 404 to GET %s', async (path) => {
      await operator.get(path).expect(404);
    });

    it.each(['/admin/capacity', '/admin/proxy-pool'])(
      'still answers 200 to GET %s, which only the operator gate guards',
      async (path) => {
        await operator.get(path).expect(200);
      },
    );
  });

  describe('with a plan in force', () => {
    beforeAll(withPlan);

    it.each([...SUPPORT_READS, ...OPERATOR_SURFACES])(
      'answers 200 to GET %s',
      async (path) => {
        await operator.get(path).expect(200);
      },
    );
  });
});
