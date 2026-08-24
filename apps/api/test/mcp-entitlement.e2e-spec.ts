import './helpers/enable-billing';
import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { API_TOKEN_PREFIX, type ApiErrorEnvelope } from '@asobeast/shared';
import request from 'supertest';
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
const TOKEN = `${API_TOKEN_PREFIX}${'e'.repeat(48)}`;
const DAY_MS = 24 * 60 * 60 * 1000;

describe('Remote MCP entitlement (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;

  const call = (token: string) =>
    request(app.getHttpServer())
      .post('/mcp')
      .set('Authorization', `Bearer ${token}`)
      .set('Accept', 'application/json, text/event-stream')
      .set('Content-Type', 'application/json')
      .send({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} });

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
      .send({ email: 'agent@example.com', password: PASSWORD })
      .expect(201);
    await prisma.apiToken.create({
      data: {
        userId: (owner.body as { id: string }).id,
        name: 'agent',
        tokenHash: sha256(TOKEN),
        prefix: TOKEN.slice(0, 12),
      },
    });
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "User" RESTART IDENTITY CASCADE',
    );
    await prisma.workspace.update({
      where: { id: DEFAULT_WORKSPACE_ID },
      data: {
        plan: 'free',
        planExpiresAt: null,
        trialEndsAt: null,
        suspendedAt: null,
        suspendedReason: null,
      },
    });
    await obliterateQueues(app);
    await app.close();
    restoreAuthEnv();
    await prisma.$disconnect();
  });

  it('serves an entitled workspace with a read-only token', async () => {
    await call(TOKEN).expect(200);
  });

  it('refuses an unentitled workspace and names the upgrade path', async () => {
    await prisma.workspace.update({
      where: { id: DEFAULT_WORKSPACE_ID },
      data: { plan: 'free', planExpiresAt: null, trialEndsAt: null },
    });

    const refused = await call(TOKEN).expect(402);
    const envelope = refused.body as ApiErrorEnvelope;

    expect(envelope.entitlement?.upgradePath).toBeTruthy();
  });

  it('refuses a revoked token immediately', async () => {
    await prisma.apiToken.deleteMany({});

    await call(TOKEN).expect(401);
  });

  it('refuses an expired token', async () => {
    await prisma.apiToken.updateMany({
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await call(TOKEN).expect(401);
  });

  it('refuses a suspended workspace', async () => {
    await prisma.workspace.update({
      where: { id: DEFAULT_WORKSPACE_ID },
      data: { suspendedAt: new Date(), suspendedReason: 'abuse' },
    });

    await call(TOKEN).expect(403);
  });
});
