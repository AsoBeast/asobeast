import './helpers/enable-auth';
import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { API_TOKEN_PREFIX } from '@asobeast/shared';
import type { AuthUser } from '@asobeast/shared';
import { MCP_TOOLS, MCP_WRITE_TOOLS, requestOf } from '@asobeast/mcp-tools';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { sha256 } from '../src/auth/password-hash';
import { urlOf } from '../src/mcp/remote-tools';
import { mintApiToken } from './helpers/api-tokens';
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
  actionId: 'act_missing',
  strategy: 'metadata',
};

const WRITE_INPUT = {
  appId: 'app_missing',
  keywordId: 'kw_missing',
  competitorId: 'app_missing',
  actionId: 'act_missing',
  keywords: ['habit tracker'],
  url: 'https://apps.apple.com/us/app/rival/id1',
  status: 'DONE',
};

describe('Read-only token scope (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let writeToken: string;

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
    writeToken = await mintApiToken(app, owner, 'write');
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

  it('refuses a bulk action update from a read-only token', async () => {
    await request(app.getHttpServer())
      .patch('/actions')
      .set('Authorization', `Bearer ${READ_TOKEN}`)
      .send({ ids: ['missing'], status: 'DONE' })
      .expect(403);
  });

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

  describe('the scope a token reports about itself', () => {
    it('tells a read-only token it is read-only', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${READ_TOKEN}`)
        .expect(200);

      expect((response.body as AuthUser).tokenScope).toBe('read');
    });

    it('tells a write token it can write', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${writeToken}`)
        .expect(200);

      expect((response.body as AuthUser).tokenScope).toBe('write');
    });

    it('reports no scope to a signed in browser session', async () => {
      const agent = request.agent(app.getHttpServer());
      await agent
        .post('/auth/login')
        .send({ email: 'scope@example.com', password: PASSWORD })
        .expect(200);

      const response = await agent.get('/auth/me').expect(200);

      expect(response.body).not.toHaveProperty('tokenScope');
    });

    it('leaves the sign in response as it was', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'scope@example.com', password: PASSWORD })
        .expect(200);

      expect(response.body).not.toHaveProperty('tokenScope');
    });
  });

  describe('what each scope may change through the write routes', () => {
    it.each(MCP_WRITE_TOOLS.map((tool) => [tool.name, tool] as const))(
      'refuses %s to a read-only token',
      async (_name, tool) => {
        const { method, path, body } = requestOf(tool, WRITE_INPUT);

        const response = await request(app.getHttpServer())
          [method.toLowerCase() as 'post' | 'patch' | 'delete'](urlOf({ path }))
          .set('Authorization', `Bearer ${READ_TOKEN}`)
          .send(body);

        expect(response.status).toBe(403);
      },
    );

    it.each(MCP_WRITE_TOOLS.map((tool) => [tool.name, tool] as const))(
      'lets a write token reach the route of %s',
      async (_name, tool) => {
        const { method, path, body } = requestOf(tool, WRITE_INPUT);

        const response = await request(app.getHttpServer())
          [method.toLowerCase() as 'post' | 'patch' | 'delete'](urlOf({ path }))
          .set('Authorization', `Bearer ${writeToken}`)
          .send(body);

        expect(response.status).not.toBe(403);
        expect(response.status).not.toBe(401);
      },
    );
  });
});
