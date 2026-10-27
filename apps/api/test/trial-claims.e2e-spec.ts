import './helpers/enable-billing';
import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { AccountPlan, AuthUser } from '@asobeast/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { restoreAuthEnv } from './helpers/auth-env';
import { testDb } from './helpers/test-db';
import { trialClaimKey } from './helpers/trial-claim-key';
import {
  clearRateLimitCounters,
  obliterateQueues,
  pauseQueues,
} from './obliterate-queues';

describe('One trial per mailbox', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;

  const registered = (email: string) =>
    request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'supersecret1' })
      .expect(201);

  const register = async (email: string): Promise<AuthUser> =>
    (await registered(email)).body as AuthUser;

  const cookieOf = (res: request.Response): string =>
    (res.headers['set-cookie'] as unknown as string[])[0].split(';')[0];

  const claimed = (mailbox: string) =>
    prisma.trialClaim.create({ data: { key: trialClaimKey(mailbox) } });

  const declinedAt = async (email: string) =>
    (
      await prisma.workspace.findFirstOrThrow({
        where: { name: email },
        select: { trialDeclinedAt: true },
      })
    ).trialDeclinedAt;

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
  }, 60_000);

  const resetAccounts = async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "User", "TrialClaim" RESTART IDENTITY CASCADE',
    );
    await prisma.workspace.deleteMany({
      where: { id: { not: DEFAULT_WORKSPACE_ID } },
    });
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: {
        plan: 'free',
        trialStartedAt: null,
        trialDeclinedAt: null,
        trialEndsAt: null,
        planExpiresAt: null,
        subscriptionId: null,
      },
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
  };

  beforeEach(async () => {
    await clearRateLimitCounters(app);
    await resetAccounts();
    await register('operator@example.com');
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "User", "TrialClaim" RESTART IDENTITY CASCADE',
    );
    await obliterateQueues(app);
    await app.close();
    restoreAuthEnv();
    await prisma.$disconnect();
  });

  it('declines a registration whose mailbox already had a trial', async () => {
    await claimed('farmer@example.com');

    const copy = await register('farmer+2@example.com');

    expect(copy.entitled).toBe(false);
    expect(copy.trialEndsAt).toBeNull();
    const refused = await prisma.workspace.findFirstOrThrow({
      where: { name: 'farmer+2@example.com' },
    });
    expect(refused.trialStartedAt).toBeNull();
    expect(refused.trialDeclinedAt).not.toBeNull();
  });

  it('still creates the refused account, which signs in and sees the paywall', async () => {
    await claimed('farmer@example.com');
    const res = await registered('farmer+2@example.com');

    expect((res.body as AuthUser).email).toBe('farmer+2@example.com');
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'farmer+2@example.com', password: 'supersecret1' })
      .expect(200);
    const plan = await request(app.getHttpServer())
      .get('/auth/plan')
      .set('Cookie', cookieOf(res))
      .expect(200);
    expect(plan.body).toMatchObject({ plan: 'free', entitled: false });
    expect((plan.body as AccountPlan).limits.apps).toBe(0);
  });

  it('treats gmail dots, tags and googlemail as one mailbox', async () => {
    await claimed('firstlast@gmail.com');

    for (const email of [
      'f.i.r.s.t.l.a.s.t@gmail.com',
      'firstlast+promo@gmail.com',
      'FirstLast@googlemail.com',
    ]) {
      await register(email);
      await expect(declinedAt(email.toLowerCase())).resolves.not.toBeNull();
    }
  });

  it('keeps dots significant where the provider counts them', async () => {
    await claimed('first.last@outlook.com');

    await register('firstlast@outlook.com');

    await expect(declinedAt('firstlast@outlook.com')).resolves.toBeNull();
  });

  it('declines an address on a throwaway domain', async () => {
    const throwaway = await register('fresh@mailinator.com');

    expect(throwaway.trialEndsAt).toBeNull();
    await expect(declinedAt('fresh@mailinator.com')).resolves.not.toBeNull();
  });

  it('declines nothing on a provider that is not throwaway', async () => {
    await register('fresh@gmail.com');

    await expect(declinedAt('fresh@gmail.com')).resolves.toBeNull();
  });

  it('claims no mailbox at registration and starts no trial for anyone', async () => {
    await claimed('farmer@example.com');
    const responses = await Promise.all(
      ['fresh@gmail.com', 'fresh@mailinator.com', 'farmer+2@example.com'].map(
        (email) => registered(email),
      ),
    );

    await expect(prisma.trialClaim.count()).resolves.toBe(1);
    for (const res of responses) {
      const me = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', cookieOf(res))
        .expect(200);
      expect(me.body as AuthUser).toMatchObject({
        entitled: false,
        trialAwaitsConfirmation: false,
      });
    }
  });
});
