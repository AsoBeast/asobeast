import './helpers/enable-auth';
import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { API_TOKEN_PREFIX } from '@asobeast/shared';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import {
  CREDENTIAL_FAILURES_PER_MINUTE,
  CredentialRateLimiter,
} from '../src/auth/rate-limit/credential-rate.limiter';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import {
  InProcessGateway,
  InProcessResponse,
} from '../src/mcp/in-process.gateway';
import {
  seedApiToken,
  seedWorkspace,
  truncateUsers,
} from './helpers/api-tokens';
import { restoreAuthEnv } from './helpers/auth-env';
import { mcpAs, textOf } from './helpers/mcp-rpc';
import { testDb } from './helpers/test-db';
import {
  clearRateLimitCounters,
  obliterateQueues,
  pauseQueues,
} from './obliterate-queues';

const NEIGHBOUR = 'ws_mcp_neighbour';
const UNKNOWN_TOKEN = `${API_TOKEN_PREFIX}${'9'.repeat(48)}`;

describe('Remote MCP credential isolation (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let neighbourToken: string;

  const dispatchUnknown = (): Promise<InProcessResponse> =>
    app.get(InProcessGateway).send({
      method: 'GET',
      url: '/apps',
      headers: { authorization: `Bearer ${UNKNOWN_TOKEN}` },
    });

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
    await seedWorkspace(prisma, DEFAULT_WORKSPACE_ID, 'Default');
    await seedWorkspace(prisma, NEIGHBOUR, 'Neighbour');
    await truncateUsers(prisma);
    neighbourToken = await seedApiToken(prisma, {
      seed: 'neighbour',
      email: 'neighbour@example.com',
      workspaceId: NEIGHBOUR,
      role: 'owner',
    });
  }, 60_000);

  beforeEach(() => clearRateLimitCounters(app));

  afterAll(async () => {
    await truncateUsers(prisma);
    await prisma.workspace.deleteMany({ where: { id: NEIGHBOUR } });
    await obliterateQueues(app);
    await app.close();
    restoreAuthEnv();
    await prisma.$disconnect();
  });

  it('keeps one workspace rejected tool calls from refusing another workspace', async () => {
    for (let call = 0; call <= CREDENTIAL_FAILURES_PER_MINUTE + 10; call += 1) {
      await dispatchUnknown();
    }

    const answer = await mcpAs(app, neighbourToken).callTool('list_apps', {});

    expect(answer.error).toBeUndefined();
    expect(answer.result).toBeDefined();
    expect(answer.result?.isError).toBeFalsy();
    expect(textOf(answer)).not.toContain('rejected credentials');
  });

  it('never counts a rejected tool call against an address', async () => {
    const recorded = jest.spyOn(
      app.get(CredentialRateLimiter),
      'recordRejection',
    );
    try {
      expect(await dispatchUnknown()).toMatchObject({ status: 401 });
      expect(recorded).not.toHaveBeenCalled();
    } finally {
      recorded.mockRestore();
    }
  });
});
