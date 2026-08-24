import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { restoreAuthEnv, TEST_AUTH_SECRET } from './helpers/auth-env';
import { testDb } from './helpers/test-db';
import {
  clearRateLimitCounters,
  obliterateQueues,
  pauseQueues,
} from './obliterate-queues';

const OWNER = 'owner@example.com';
const PASSWORD = 'supersecret1';

const TOUCHED = [
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_SECURE',
  'SMTP_FROM',
  'WEB_PUBLIC_URL',
] as const;

const saved = new Map(TOUCHED.map((key) => [key, process.env[key]]));

process.env.AUTH_SECRET = TEST_AUTH_SECRET;
process.env.BILLING_ENABLED = 'false';
process.env.SMTP_HOST = '127.0.0.1';
process.env.SMTP_PORT = '1';
process.env.SMTP_SECURE = 'false';
process.env.SMTP_FROM = 'asobeast <alerts@example.test>';
delete process.env.WEB_PUBLIC_URL;

describe('Account recovery on an instance that has a relay but no public address', () => {
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
      update: {},
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
  }, 60_000);

  beforeEach(async () => {
    await clearRateLimitCounters(app);
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "User" RESTART IDENTITY CASCADE',
    );
    await prisma.workspace.deleteMany({
      where: { id: { not: DEFAULT_WORKSPACE_ID } },
    });
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: OWNER, password: PASSWORD })
      .expect(201);
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "User" RESTART IDENTITY CASCADE',
    );
    await obliterateQueues(app);
    await app.close();
    restoreAuthEnv();
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await prisma.$disconnect();
  });

  it('refuses the request rather than promising a link it cannot build', async () => {
    const refused = await request(app.getHttpServer())
      .post('/auth/password/forgot')
      .send({ email: OWNER })
      .expect(503);

    expect((refused.body as { message: string }).message).toContain(
      'email transport',
    );
  });

  it('mints no token for a request it refused', async () => {
    await request(app.getHttpServer())
      .post('/auth/password/forgot')
      .send({ email: OWNER })
      .expect(503);

    const account = await prisma.user.findUniqueOrThrow({
      where: { email: OWNER },
      select: { resetHash: true, resetExpiresAt: true },
    });
    expect(account.resetHash).toBeNull();
    expect(account.resetExpiresAt).toBeNull();
  });
});
