import './helpers/enable-auth';
import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { API_TOKEN_PREFIX } from '@asobeast/shared';
import { MCP_TOOLS } from '@asobeast/mcp-tools';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { sha256 } from '../src/auth/password-hash';
import { urlOf } from '../src/mcp/remote-tools';
import { restoreAuthEnv } from './helpers/auth-env';
import { testDb } from './helpers/test-db';
import {
  clearRateLimitCounters,
  obliterateQueues,
  pauseQueues,
} from './obliterate-queues';

const PASSWORD = 'supersecret1';
const READ_TOKEN = `${API_TOKEN_PREFIX}${'r'.repeat(48)}`;

const TOOL_INPUT = {
  appId: 'app_missing',
  keywordId: 'kw_missing',
  strategy: 'metadata',
};

describe('Read-only token scope (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;

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
      'TRUNCATE TABLE "User" RESTART IDENTITY CASCADE',
    );

    const owner = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'scope@example.com', password: PASSWORD })
      .expect(201);
    await prisma.apiToken.create({
      data: {
        userId: (owner.body as { id: string }).id,
        name: 'read only',
        tokenHash: sha256(READ_TOKEN),
        prefix: READ_TOKEN.slice(0, 12),
        scope: 'read',
      },
    });
  });

  beforeEach(() => clearRateLimitCounters(app));

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "User" RESTART IDENTITY CASCADE',
    );
    await obliterateQueues(app);
    await app.close();
    restoreAuthEnv();
    await prisma.$disconnect();
  });

  it.each(MCP_TOOLS.map((tool) => [tool.name, tool] as const))(
    'lets a read-only token call %s',
    async (_name, tool) => {
      const response = await request(app.getHttpServer())
        .get(urlOf(tool.request(TOOL_INPUT)))
        .set('Authorization', `Bearer ${READ_TOKEN}`);

      expect(response.status).not.toBe(403);
      expect(response.status).not.toBe(401);
    },
  );

  it('still refuses a write from a read-only token', async () => {
    const refused = await request(app.getHttpServer())
      .patch('/actions/missing')
      .set('Authorization', `Bearer ${READ_TOKEN}`)
      .send({ status: 'DONE' })
      .expect(403);

    expect((refused.body as { message: string }).message).toContain(
      'read-only',
    );
  });
});
