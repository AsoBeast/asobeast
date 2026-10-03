import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { ownerAgent, useCookies } from './helpers/session';
import { testDb } from './helpers/test-db';
import { obliterateQueues } from './obliterate-queues';

describe('AI call ledger (e2e)', () => {
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
    }).compile();
    app = moduleFixture.createNestApplication();
    useCookies(app);
    await app.init();
    prisma = testDb();
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: {},
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
    api = await ownerAgent(app);
  });

  beforeEach(async () => {
    await prisma.aiCall.deleteMany();
  });

  afterAll(async () => {
    await prisma.aiCall.deleteMany();
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  const seedApp = () =>
    prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: 'ledger-app',
        country: 'us',
        name: 'Ledger App',
      },
    });

  const seedMember = () =>
    prisma.user.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        email: 'ledger-member@example.com',
        passwordHash: 'login-unused',
        role: 'member',
      },
    });

  it('keeps the calls an app spent after the app is deleted', async () => {
    const owned = await seedApp();
    await prisma.aiCall.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        appId: owned.id,
        feature: 'metadataDrafts',
        model: 'gpt-test',
        status: 'counted',
      },
    });

    await api.delete(`/apps/${owned.id}`).expect(204);

    await expect(
      prisma.aiCall.count({ where: { appId: owned.id } }),
    ).resolves.toBe(1);
  });

  it("keeps a removed member's calls without their user", async () => {
    const member = await seedMember();
    const call = await prisma.aiCall.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        userId: member.id,
        feature: 'actionExplanation',
        model: 'gpt-test',
        status: 'counted',
      },
    });

    await prisma.user.delete({ where: { id: member.id } });

    await expect(
      prisma.aiCall.findUnique({ where: { id: call.id } }),
    ).resolves.toMatchObject({ userId: null });
  });
});
