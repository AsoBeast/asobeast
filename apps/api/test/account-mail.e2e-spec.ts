import './helpers/enable-billing';
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
import { restoreAuthEnv } from './helpers/auth-env';
import { testDb } from './helpers/test-db';
import {
  clearRateLimitCounters,
  obliterateQueues,
  pauseQueues,
} from './obliterate-queues';

const RELAY_PASSWORD = 'relay-password-nobody-should-see';
const SMTP_KEYS = [
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_SECURE',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'SMTP_FROM',
] as const;

const savedSmtp = new Map(SMTP_KEYS.map((key) => [key, process.env[key]]));

process.env.SMTP_HOST = '127.0.0.1';
process.env.SMTP_PORT = '1';
process.env.SMTP_SECURE = 'false';
process.env.SMTP_USER = 'relay-user';
process.env.SMTP_PASSWORD = RELAY_PASSWORD;
process.env.SMTP_FROM = 'asobeast <alerts@example.test>';

describe('Account email that the relay never accepted (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;

  const register = (email: string) =>
    request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'supersecret1' });

  const deliveries = () =>
    prisma.alertDelivery.findMany({
      where: { channel: 'account' },
      orderBy: { createdAt: 'asc' },
    });

  const recorded = async (count: number) => {
    const deadline = Date.now() + 10_000;
    let rows = await deliveries();
    while (rows.length < count && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      rows = await deliveries();
    }
    expect(rows).toHaveLength(count);
    return rows;
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
      update: {},
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
  }, 60_000);

  beforeEach(async () => {
    await clearRateLimitCounters(app);
    await prisma.alertDelivery.deleteMany({ where: { channel: 'account' } });
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "User" RESTART IDENTITY CASCADE',
    );
    await prisma.workspace.deleteMany({
      where: { id: { not: DEFAULT_WORKSPACE_ID } },
    });
  });

  afterAll(async () => {
    await prisma.alertDelivery.deleteMany({ where: { channel: 'account' } });
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "User" RESTART IDENTITY CASCADE',
    );
    await obliterateQueues(app);
    await app.close();
    restoreAuthEnv();
    for (const [key, value] of savedSmtp) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await prisma.$disconnect();
  });

  it('records a confirmation email the relay never accepted', async () => {
    await register('owner@example.com').expect(201);

    const [delivery] = await recorded(1);
    expect(delivery).toMatchObject({
      channel: 'account',
      event: 'verification',
      status: 'failed',
    });
    expect(delivery.detail).not.toBeNull();
  });

  it('records a recovery email the relay never accepted', async () => {
    await register('owner@example.com').expect(201);
    await prisma.alertDelivery.deleteMany({ where: { channel: 'account' } });

    await request(app.getHttpServer())
      .post('/auth/password/forgot')
      .send({ email: 'owner@example.com' })
      .expect(204);

    const [delivery] = await recorded(1);
    expect(delivery).toMatchObject({ event: 'recovery', status: 'failed' });
  });

  it('never writes the relay password into the delivery log', async () => {
    await register('owner@example.com').expect(201);

    for (const delivery of await deliveries()) {
      expect(delivery.detail ?? '').not.toContain(RELAY_PASSWORD);
    }
  });

  it('keeps the account when its confirmation email could not be sent', async () => {
    const created = await register('owner@example.com').expect(201);

    expect(created.body).toMatchObject({ email: 'owner@example.com' });
    await expect(
      prisma.user.findUnique({ where: { email: 'owner@example.com' } }),
    ).resolves.not.toBeNull();
  });
});
