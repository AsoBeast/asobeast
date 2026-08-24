import './helpers/enable-auth';
import { execSync } from 'child_process';
import type { AddressInfo, Server } from 'net';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { API_TOKEN_PREFIX } from '@asobeast/shared';
import { MCP_TOOLS } from '@asobeast/mcp-tools';
import {
  Client,
  StreamableHTTPClientTransport,
  type ClientOptions,
} from '@modelcontextprotocol/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { sha256 } from '../src/auth/password-hash';
import { McpBridge } from '../src/mcp/mcp.bridge';
import { restoreAuthEnv } from './helpers/auth-env';
import { testDb } from './helpers/test-db';
import {
  clearRateLimitCounters,
  obliterateQueues,
  pauseQueues,
} from './obliterate-queues';

const PASSWORD = 'supersecret1';
const TOKEN = `${API_TOKEN_PREFIX}${'f'.repeat(48)}`;
const APP_NAME = 'Modern Fixture';
const MODERN_PROTOCOL_VERSION = '2026-07-28';
const SCHEMA_DIALECT = 'https://json-schema.org/draft/2020-12/schema';

const MODERN_META = {
  'io.modelcontextprotocol/protocolVersion': MODERN_PROTOCOL_VERSION,
  'io.modelcontextprotocol/clientCapabilities': {},
};

const sessionHeaders: (string | null)[] = [];

const recordingFetch = async (
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> => {
  const response = await fetch(input, init);
  sessionHeaders.push(response.headers.get('mcp-session-id'));
  return response;
};

interface ToolResult {
  isError?: boolean;
  content?: { type: string; text: string }[];
}

function dialectOf(schema: unknown): unknown {
  return (schema as { $schema?: unknown }).$schema;
}

function textOf(result: ToolResult): string {
  const [first] = result.content ?? [];
  expect(first.type).toBe('text');
  return first.text;
}

describe('Remote MCP modern era (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let endpoint: URL;
  let modern: Client;
  let legacy: Client;

  const connect = async (options?: ClientOptions): Promise<Client> => {
    const client = new Client(
      { name: 'asobeast-modern-spec', version: '1.0.0' },
      options,
    );
    await client.connect(
      new StreamableHTTPClientTransport(endpoint, {
        requestInit: { headers: { Authorization: `Bearer ${TOKEN}` } },
        fetch: recordingFetch,
      }),
    );
    return client;
  };

  const rawModern = (method: string, params: Record<string, unknown> = {}) => {
    const pending = request(app.getHttpServer())
      .post('/mcp')
      .set('Authorization', `Bearer ${TOKEN}`)
      .set('Accept', 'application/json, text/event-stream')
      .set('Content-Type', 'application/json')
      .set('Mcp-Method', method);
    if (typeof params.name === 'string') pending.set('Mcp-Name', params.name);
    return pending.send({
      jsonrpc: '2.0',
      id: 1,
      method,
      params: { ...params, _meta: MODERN_META },
    });
  };

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
      .send({ email: 'modern@example.com', password: PASSWORD })
      .expect(201);
    await prisma.apiToken.create({
      data: {
        userId: (owner.body as { id: string }).id,
        name: 'modern mcp',
        tokenHash: sha256(TOKEN),
        prefix: TOKEN.slice(0, 12),
      },
    });
    await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: '555000222',
        country: 'us',
        name: APP_NAME,
      },
    });

    await app.listen(0);
    const server = app.getHttpServer() as unknown as Server;
    const { port } = server.address() as AddressInfo;
    endpoint = new URL(`http://127.0.0.1:${port}/mcp`);

    modern = await connect({ versionNegotiation: { mode: 'auto' } });
    legacy = await connect();
  }, 60_000);

  beforeEach(() => clearRateLimitCounters(app));

  afterAll(async () => {
    await Promise.all([modern?.close(), legacy?.close()]);
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "User" RESTART IDENTITY CASCADE',
    );
    await obliterateQueues(app);
    await app.close();
    restoreAuthEnv();
    await prisma.$disconnect();
  });

  it('serves the 2026 protocol to a client that probes for it', () => {
    expect(modern.getProtocolEra()).toBe('modern');
  });

  it('serves the 2025 protocol to a client that does not probe', () => {
    expect(legacy.getProtocolEra()).toBe('legacy');
  });

  it.each([
    ['modern', () => modern],
    ['legacy', () => legacy],
  ])('lists the whole catalog to a %s client', async (_era, clientOf) => {
    const { tools } = await clientOf().listTools();

    expect(tools.map((tool) => tool.name).sort()).toEqual(
      MCP_TOOLS.map((tool) => tool.name).sort(),
    );
    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint).toBe(true);
    }
  });

  it.each([
    ['modern', () => modern],
    ['legacy', () => legacy],
  ])(
    'advertises every input schema in the 2020-12 dialect to a %s client',
    async (_era, clientOf) => {
      const { tools } = await clientOf().listTools();

      for (const tool of tools) {
        expect(dialectOf(tool.inputSchema)).toBe(SCHEMA_DIALECT);
      }
    },
  );

  it('advertises one identical tool contract to both eras', async () => {
    const [served, negotiated] = await Promise.all([
      legacy.listTools(),
      modern.listTools(),
    ]);

    expect(served.tools).toStrictEqual(negotiated.tools);
  });

  it.each([
    ['modern', () => modern],
    ['legacy', () => legacy],
  ])(
    'answers an identical tool call to a %s client',
    async (_era, clientOf) => {
      const result = (await clientOf().callTool({
        name: 'list_apps',
        arguments: {},
      })) as ToolResult;

      expect(result.isError).toBeFalsy();
      const apps = JSON.parse(textOf(result)) as { name: string }[];
      expect(apps.map((entry) => entry.name)).toEqual([APP_NAME]);
    },
  );

  it('reports a rejected argument as a tool error rather than a throw', async () => {
    const result = (await modern.callTool({
      name: 'list_reviews',
      arguments: { appId: 'app-1', score: 99 },
    })) as ToolResult;

    expect(result.isError).toBe(true);
  });

  it('never sends a session header on either era', () => {
    expect(sessionHeaders.length).toBeGreaterThan(0);
    expect(sessionHeaders.every((value) => value === null)).toBe(true);
  });

  it('serves a tool call as the first request a connection ever makes', async () => {
    const response = await rawModern('tools/call', {
      name: 'list_apps',
      arguments: {},
    }).expect(200);
    const { result } = JSON.parse(response.text) as { result: ToolResult };

    expect(result.isError).toBeFalsy();
    expect(response.headers['mcp-session-id']).toBeUndefined();
  });

  it('answers a modern tool call with a single json body', async () => {
    const response = await rawModern('tools/call', {
      name: 'list_apps',
      arguments: {},
    }).expect(200);

    expect(response.headers['content-type']).toContain('application/json');
  });

  it('ignores a session header it never issued', async () => {
    const response = await rawModern('tools/list')
      .set('Mcp-Session-Id', 'invented-session')
      .expect(200);
    const { result } = JSON.parse(response.text) as {
      result: { tools: { name: string }[] };
    };

    expect(result.tools).toHaveLength(MCP_TOOLS.length);
  });

  it('spends one mcp budget request per protocol probe', async () => {
    const admit = jest.spyOn(app.get(McpBridge), 'admit');

    const probing = await connect({ versionNegotiation: { mode: 'auto' } });
    const onConnect = admit.mock.calls.length;
    await probing.listTools();
    await probing.close();
    const afterListing = admit.mock.calls.length;
    admit.mockRestore();

    expect(onConnect).toBe(1);
    expect(afterListing).toBe(2);
  });

  it('re-fetches a constant tool list on every connection', async () => {
    const admit = jest.spyOn(app.get(McpBridge), 'admit');

    for (let connection = 0; connection < 2; connection += 1) {
      const client = await connect({ versionNegotiation: { mode: 'auto' } });
      await client.listTools();
      await client.close();
    }
    const methods = admit.mock.calls.map(
      ([req]) => (req.body as { method?: string }).method,
    );
    admit.mockRestore();

    expect(methods).toEqual([
      'server/discover',
      'tools/list',
      'server/discover',
      'tools/list',
    ]);
  });
});
