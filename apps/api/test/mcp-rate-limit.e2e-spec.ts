import './helpers/enable-billing';
import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { PLAN_LIMITS, type ApiErrorEnvelope } from '@asobeast/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { InProcessGateway } from '../src/mcp/in-process.gateway';
import { mintApiToken } from './helpers/api-tokens';
import { restoreAuthEnv } from './helpers/auth-env';
import { awaitBurnHeadroom } from './helpers/burn-headroom';
import { mcpAs } from './helpers/mcp-rpc';
import { testDb } from './helpers/test-db';
import {
  clearRateLimitCounters,
  obliterateQueues,
  pauseQueues,
} from './obliterate-queues';

const PASSWORD = 'supersecret1';
const DAY_MS = 24 * 60 * 60 * 1000;
const MCP_REQUESTS_PER_MINUTE = PLAN_LIMITS.indie
  .mcpRequestsPerMinute as number;

const messages = (count: number, method: string, params: unknown = {}) =>
  Array.from({ length: count }, (_, index) => ({
    jsonrpc: '2.0',
    id: index + 1,
    method,
    params,
  }));

describe('Remote MCP request allowance with billing (e2e)', () => {
  jest.setTimeout(45_000);

  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let mcp: ReturnType<typeof mcpAs>;

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
      'TRUNCATE TABLE "User" RESTART IDENTITY CASCADE',
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
      .send({ email: 'agent-batches@example.com', password: PASSWORD })
      .expect(201);
    mcp = mcpAs(app, await mintApiToken(app, owner, 'read'));
    await clearRateLimitCounters(app);
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "User" RESTART IDENTITY CASCADE',
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

  it('refuses a batch larger than the allowance without spending it', async () => {
    const dispatch = jest.spyOn(app.get(InProcessGateway), 'send');
    await awaitBurnHeadroom();

    const refused = await mcp
      .send(
        messages(MCP_REQUESTS_PER_MINUTE + 1, 'tools/call', {
          name: 'list_apps',
          arguments: {},
        }),
      )
      .expect(429);
    const envelope = refused.body as ApiErrorEnvelope;
    const dispatched = dispatch.mock.calls.length;
    dispatch.mockRestore();
    await mcp.rpc('ping').expect(200);

    expect(envelope.rateLimit).toMatchObject({
      window: 'minute',
      rateClass: 'read',
      plan: 'indie',
      limit: MCP_REQUESTS_PER_MINUTE,
      upgradeTo: 'ultimate',
    });
    expect(refused.headers['retry-after']).toBe(
      String(envelope.rateLimit?.resetSeconds),
    );
    expect(envelope.message).toContain('Split it into requests');
    expect(dispatched).toBe(0);
  });

  it('charges every message of a batch against the allowance', async () => {
    await awaitBurnHeadroom();

    await mcp.send(messages(MCP_REQUESTS_PER_MINUTE, 'ping')).expect(200);

    await mcp.rpc('ping').expect(429);
  });

  it('charges a single request one unit', async () => {
    await awaitBurnHeadroom();
    for (let spent = 1; spent <= MCP_REQUESTS_PER_MINUTE; spent += 1) {
      await mcp.rpc('ping').expect(200);
    }

    await mcp.rpc('ping').expect(429);
  });

  it('charges a notification posted alone one unit', async () => {
    await awaitBurnHeadroom();
    const notification = {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    };
    for (let spent = 1; spent <= MCP_REQUESTS_PER_MINUTE; spent += 1) {
      await mcp.send(notification).expect(202);
    }

    await mcp.send(notification).expect(429);
  });
});
