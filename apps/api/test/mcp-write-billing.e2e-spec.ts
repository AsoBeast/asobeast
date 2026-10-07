import './helpers/enable-billing';
import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { MINUTE_SECONDS, PLAN_LIMITS } from '@asobeast/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { RequestRateLimiter } from '../src/auth/rate-limit/request-rate.limiter';
import { secondsUntilReset } from '../src/auth/rate-limit/window';
import { StoreProviderRegistry } from '../src/store-providers/store-provider.registry';
import { mintApiToken } from './helpers/api-tokens';
import { restoreAuthEnv } from './helpers/auth-env';
import { FakeRegistry, RIVAL_URL } from './helpers/mcp-fixtures';
import { mcpAs, textOf } from './helpers/mcp-rpc';
import { testDb } from './helpers/test-db';
import {
  clearRateLimitCounters,
  obliterateQueues,
  pauseQueues,
} from './obliterate-queues';

const PASSWORD = 'supersecret1';
const DAY_MS = 24 * 60 * 60 * 1000;
const WRITES_PER_MINUTE = PLAN_LIMITS.indie.apiWritesPerMinute as number;
const BURN_HEADROOM_SECONDS = 15;

async function awaitBurnHeadroom(): Promise<void> {
  const remaining = secondsUntilReset(MINUTE_SECONDS, new Date());
  if (remaining >= BURN_HEADROOM_SECONDS) return;
  await new Promise((resolve) => setTimeout(resolve, remaining * 1000 + 100));
}

describe('Remote MCP write tools with billing (e2e)', () => {
  jest.setTimeout(45_000);

  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let token: string;
  let mcp: ReturnType<typeof mcpAs>;

  const seedApp = () =>
    prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '555000111',
        country: 'us',
        name: 'Billing Fixture',
      },
    });

  beforeAll(async () => {
    execSync('pnpm prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'ignore',
    });
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(StoreProviderRegistry)
      .useValue(new FakeRegistry())
      .compile();
    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    await app.init();
    await pauseQueues(app);
    prisma = testDb();
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: {},
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
  }, 60_000);

  beforeEach(async () => {
    await clearRateLimitCounters(app);
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword", "User" RESTART IDENTITY CASCADE',
    );
    await prisma.workspace.update({
      where: { id: DEFAULT_WORKSPACE_ID },
      data: {
        plan: 'indie',
        planExpiresAt: new Date(Date.now() + 30 * DAY_MS),
        suspendedAt: null,
      },
    });
    const owner = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'agent-writes@example.com', password: PASSWORD })
      .expect(201);
    token = await mintApiToken(app, owner, 'write');
    mcp = mcpAs(app, token);
    await clearRateLimitCounters(app);
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "Keyword", "User" RESTART IDENTITY CASCADE',
    );
    await prisma.workspace.update({
      where: { id: DEFAULT_WORKSPACE_ID },
      data: { plan: 'free', planExpiresAt: null, trialEndsAt: null },
    });
    await obliterateQueues(app);
    await app.close();
    restoreAuthEnv();
    await prisma.$disconnect();
  });

  it('refuses a change from an unentitled workspace and names the upgrade path', async () => {
    await prisma.workspace.update({
      where: { id: DEFAULT_WORKSPACE_ID },
      data: { plan: 'free', planExpiresAt: null, trialEndsAt: null },
    });

    const response = await mcp.rpc('tools/call', {
      name: 'track_keywords',
      arguments: { appId: 'app-1', keywords: ['habit'] },
    });

    expect(response.status).toBe(402);
    expect(await prisma.keyword.count()).toBe(0);
  });

  it('refuses a competitor past the plan limit with the quota message', async () => {
    const primary = await seedApp();
    await prisma.app.createMany({
      data: Array.from(
        { length: PLAN_LIMITS.indie.competitorsPerApp as number },
        (_, index) => ({
          workspaceId: DEFAULT_WORKSPACE_ID,
          store: Store.APP_STORE,
          storeAppId: `77700${index}`,
          country: 'us',
          name: `Rival ${index}`,
          isCompetitor: true,
          primaryAppId: primary.id,
        }),
      ),
    });

    const result = await mcp.callTool('add_competitor', {
      appId: primary.id,
      url: RIVAL_URL,
    });

    expect(result.result?.isError).toBe(true);
    expect(textOf(result)).toContain('competitors limit reached');
    expect(textOf(result)).toContain('retrying will not help');
  });

  it('spends the write budget on the inner route and the read budget on a read', async () => {
    const primary = await seedApp();
    const consume = jest.spyOn(app.get(RequestRateLimiter), 'consume');

    await mcp.callTool('list_keywords', { appId: primary.id });
    await mcp.callTool('untrack_keyword', {
      appId: primary.id,
      keywordId: 'kw-missing',
    });
    const classes = consume.mock.calls.map(([, rateClass]) => rateClass);
    consume.mockRestore();

    expect(classes).toEqual(['read', 'write']);
  });

  it('stops a runaway agent at the plan write budget', async () => {
    const primary = await seedApp();
    await awaitBurnHeadroom();
    for (let spent = 0; spent < WRITES_PER_MINUTE; spent += 1) {
      await request(app.getHttpServer())
        .patch('/actions/missing')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'DONE' })
        .expect(404);
    }

    const result = await mcp.callTool('untrack_keyword', {
      appId: primary.id,
      keywordId: 'kw-missing',
    });

    expect(result.result?.isError).toBe(true);
    expect(textOf(result)).toContain('per minute');
    expect(textOf(result)).toContain('rather than retrying in a loop');
  });
});
