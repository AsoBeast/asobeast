import './helpers/enable-auth';
import './helpers/enable-trusted-proxy';
import { execSync } from 'child_process';
import { join } from 'path';
import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';
import cookieParser from 'cookie-parser';
import { API_TOKEN_PREFIX } from '@asobeast/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import type { Env } from '../src/config/env';
import { applyTrustedProxy } from '../src/config/trusted-proxy';
import { QUEUES } from '../src/jobs/jobs.types';
import { restoreAuthEnv } from './helpers/auth-env';
import { testDb } from './helpers/test-db';
import {
  clearRateLimitCounters,
  obliterateQueues,
  pauseQueues,
} from './obliterate-queues';

const LOGIN_ATTEMPTS_PER_MINUTE = 10;
const PROXY_OBSERVED_CLIENT = '198.51.100.20';
const REJECTED_TOKEN = `${API_TOKEN_PREFIX}${'2'.repeat(48)}`;

function forgedChain(attempt: number): string {
  return `203.0.113.${attempt}, ${PROXY_OBSERVED_CLIENT}`;
}

async function credentialCounterAddresses(
  app: INestApplication,
): Promise<string[]> {
  const queue = app.get<Queue>(getQueueToken(QUEUES.PIPELINE), {
    strict: false,
  });
  const client = (await queue.getBackend().client) as unknown as {
    keys(pattern: string): Promise<string[]>;
  };
  const keys = await client.keys('asobeast:credentials:*:rejected:*');
  return keys
    .map((key) => key.split(':').slice(2, -2).join(':'))
    .filter((address) => address.length > 0);
}

describe('Trusted proxy hop count (e2e)', () => {
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
    const nest = moduleFixture.createNestApplication<NestExpressApplication>();
    nest.use(cookieParser());
    applyTrustedProxy(
      nest,
      nest.get(ConfigService<Env, true>).get('TRUST_PROXY', { infer: true }),
    );
    await nest.init();
    app = nest;
    await pauseQueues(app);

    prisma = testDb();
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: {},
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
  });

  beforeEach(async () => {
    await clearRateLimitCounters(app);
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "User" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await obliterateQueues(app);
    await app?.close();
    await prisma?.$disconnect();
    delete process.env.TRUST_PROXY;
    restoreAuthEnv();
  });

  const login = (forwardedFor: string) =>
    request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Forwarded-For', forwardedFor)
      .send({ email: 'victim@example.com', password: 'guess' });

  const presentRejectedToken = (forwardedFor: string) =>
    request(app.getHttpServer())
      .get('/apps')
      .set('X-Forwarded-For', forwardedFor)
      .set('Authorization', `Bearer ${REJECTED_TOKEN}`);

  it('refuses login attempts past the window when the forged prefix rotates', async () => {
    for (let attempt = 0; attempt < LOGIN_ATTEMPTS_PER_MINUTE; attempt += 1) {
      await login(forgedChain(attempt)).expect(401);
    }

    await login(forgedChain(LOGIN_ATTEMPTS_PER_MINUTE)).expect(429);
  });

  it('shares one window between a forged prefix and the bare observed address', async () => {
    for (let attempt = 0; attempt < LOGIN_ATTEMPTS_PER_MINUTE; attempt += 1) {
      await login(forgedChain(attempt)).expect(401);
    }

    await login(PROXY_OBSERVED_CLIENT).expect(429);
  });

  it('ignores a forged chain padded deeper than the trusted hop count', async () => {
    const padded = [
      '203.0.113.1',
      '203.0.113.2',
      '203.0.113.3',
      '203.0.113.4',
      PROXY_OBSERVED_CLIENT,
    ].join(', ');

    await presentRejectedToken(padded).expect(401);

    await expect(credentialCounterAddresses(app)).resolves.toEqual([
      `ip:${PROXY_OBSERVED_CLIENT}`,
    ]);
  });

  it('keys a rejected credential on the observed connection', async () => {
    await presentRejectedToken(forgedChain(1)).expect(401);

    await expect(credentialCounterAddresses(app)).resolves.toEqual([
      `ip:${PROXY_OBSERVED_CLIENT}`,
    ]);
  });
});
