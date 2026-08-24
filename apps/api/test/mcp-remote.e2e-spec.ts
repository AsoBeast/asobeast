import './helpers/enable-auth';
import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { API_TOKEN_PREFIX } from '@asobeast/shared';
import { MCP_TOOLS } from '@asobeast/mcp-tools';
import request, { Response } from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { sha256 } from '../src/auth/password-hash';
import { restoreAuthEnv } from './helpers/auth-env';
import { testDb } from './helpers/test-db';
import {
  clearRateLimitCounters,
  obliterateQueues,
  pauseQueues,
} from './obliterate-queues';

const PASSWORD = 'supersecret1';
const TOKEN = `${API_TOKEN_PREFIX}${'d'.repeat(48)}`;
const PROTOCOL_VERSION = '2025-06-18';

interface JsonRpcResponse {
  result?: {
    tools?: { name: string; description: string; annotations?: unknown }[];
    content?: { type: string; text: string }[];
    isError?: boolean;
  };
  error?: { message: string };
}

function sseEnvelope(response: Response): JsonRpcResponse {
  expect(response.headers['content-type']).toContain('text/event-stream');
  const frame = response.text
    .split('\n')
    .find((line) => line.startsWith('data: '));
  expect(frame).toBeDefined();
  return JSON.parse(frame!.slice('data: '.length)) as JsonRpcResponse;
}

describe('Remote MCP transport (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;

  const rpc = (method: string, params: unknown = {}, id = 1) =>
    request(app.getHttpServer())
      .post('/mcp')
      .set('Authorization', `Bearer ${TOKEN}`)
      .set('Accept', 'application/json, text/event-stream')
      .set('Content-Type', 'application/json')
      .send({ jsonrpc: '2.0', id, method, params });

  beforeAll(async () => {
    execSync('pnpm prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'ignore',
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication<App>();
    app.use(cookieParser());
    await app.init();
    await pauseQueues(app);

    prisma = testDb();
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: { suspendedAt: null, suspendedReason: null },
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "User" RESTART IDENTITY CASCADE',
    );

    const owner = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'mcp@example.com', password: PASSWORD })
      .expect(201);
    await prisma.apiToken.create({
      data: {
        userId: (owner.body as { id: string }).id,
        name: 'remote mcp',
        tokenHash: sha256(TOKEN),
        prefix: TOKEN.slice(0, 12),
      },
    });
    await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '555000111',
        country: 'us',
        name: 'Remote Fixture',
      },
    });
  }, 60_000);

  beforeEach(() => clearRateLimitCounters(app));

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "User" RESTART IDENTITY CASCADE',
    );
    await obliterateQueues(app);
    await app.close();
    restoreAuthEnv();
    await prisma.$disconnect();
  });

  it('refuses an unauthenticated connection', async () => {
    await request(app.getHttpServer())
      .post('/mcp')
      .set('Accept', 'application/json, text/event-stream')
      .send({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })
      .expect(401);
  });

  it('refuses a browser session even when it belongs to the owner', async () => {
    const signedIn = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'mcp@example.com', password: PASSWORD })
      .expect(200);
    const cookie = (signedIn.headers['set-cookie'] as unknown as string[])
      .find((entry) => entry.startsWith('asobeast_session='))
      ?.split(';')[0];

    const refused = await request(app.getHttpServer())
      .post('/mcp')
      .set('Cookie', cookie ?? '')
      .set('Accept', 'application/json, text/event-stream')
      .send({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })
      .expect(401);

    expect((refused.body as { message: string }).message).toContain(
      'personal API token only',
    );
  });

  it('initializes and names the server', async () => {
    const response = await rpc('initialize', {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'spec', version: '1.0.0' },
    }).expect(200);

    expect(sseEnvelope(response).error).toBeUndefined();
  });

  it('lists the same read-only tools the stdio server registers', async () => {
    const response = await rpc('tools/list').expect(200);
    const tools = sseEnvelope(response).result?.tools ?? [];

    expect(tools.map((tool) => tool.name).sort()).toEqual(
      MCP_TOOLS.map((tool) => tool.name).sort(),
    );
    for (const tool of tools) {
      expect(tool.annotations).toMatchObject({ readOnlyHint: true });
    }
  });

  it('answers without a session header', async () => {
    const response = await rpc('tools/list').expect(200);

    expect(response.headers['mcp-session-id']).toBeUndefined();
  });

  it('serves a tool call from the workspace the token belongs to', async () => {
    const response = await rpc('tools/call', {
      name: 'list_apps',
      arguments: {},
    }).expect(200);
    const result = sseEnvelope(response).result;

    expect(result?.isError).toBeUndefined();
    const apps = JSON.parse(result?.content?.[0].text ?? '[]') as {
      name: string;
    }[];
    expect(apps.map((entry) => entry.name)).toEqual(['Remote Fixture']);
  });

  it('reports a missing resource as a tool error rather than a crash', async () => {
    const response = await rpc('tools/call', {
      name: 'get_app',
      arguments: { appId: 'missing' },
    }).expect(200);
    const result = sseEnvelope(response).result;

    expect(result?.isError).toBe(true);
    expect(result?.content?.[0].text).toContain('not found');
  });

  it('matches the rest api result for every tool it can call blind', async () => {
    const shared = [
      { tool: 'list_apps', route: '/apps' },
      { tool: 'portfolio', route: '/portfolio' },
      { tool: 'daily_budget', route: '/jobs/budget' },
    ];

    for (const { tool, route } of shared) {
      const [viaMcp, viaRest] = await Promise.all([
        rpc('tools/call', { name: tool, arguments: {} }).expect(200),
        request(app.getHttpServer())
          .get(route)
          .set('Authorization', `Bearer ${TOKEN}`)
          .expect(200),
      ]);
      const payload = JSON.parse(
        sseEnvelope(viaMcp).result?.content?.[0].text ?? 'null',
      ) as unknown;

      expect(payload).toEqual(viaRest.body);
    }
  });

  it('exposes no tool that changes anything', async () => {
    const response = await rpc('tools/list').expect(200);

    for (const tool of sseEnvelope(response).result?.tools ?? []) {
      expect(tool.annotations).toMatchObject({ readOnlyHint: true });
    }
    expect(MCP_TOOLS.every((tool) => tool.request({}).path.length > 0)).toBe(
      true,
    );
  });
});
