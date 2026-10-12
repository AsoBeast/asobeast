import './helpers/enable-billing';
import { execSync } from 'child_process';
import { createHash } from 'crypto';
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
import { subscribeDuring } from './helpers/subscribe-during';
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

  const register = async (email: string): Promise<AuthUser> => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'supersecret1' })
      .expect(201);
    return res.body as AuthUser;
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

  it('starts a trial for the first address and none for a plus tagged copy of it', async () => {
    const first = await register('farmer+1@example.com');
    const second = await register('farmer+2@example.com');

    expect(first.entitled).toBe(true);
    expect(first.plan).toBe('trial');
    expect(second.entitled).toBe(false);
    expect(second.trialEndsAt).toBeNull();
  });

  it('records the refusal on the workspace so nothing offers the trial again', async () => {
    await register('farmer+1@example.com');
    await register('farmer+2@example.com');

    const refused = await prisma.workspace.findFirstOrThrow({
      where: { name: 'farmer+2@example.com' },
    });
    expect(refused.trialStartedAt).toBeNull();
    expect(refused.trialDeclinedAt).not.toBeNull();
  });

  it('still creates the refused account, which signs in and sees the paywall', async () => {
    await register('farmer+1@example.com');
    const second = await register('farmer+2@example.com');

    expect(second.email).toBe('farmer+2@example.com');
    expect(second.trialAwaitsConfirmation).toBe(false);
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'farmer+2@example.com', password: 'supersecret1' })
      .expect(200);
  });

  it('reports a refused workspace as unentitled with no capacity until it pays', async () => {
    await register('farmer+1@example.com');
    const cookie = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'farmer+2@example.com', password: 'supersecret1' })
      .expect(201)
      .then((res) => {
        const raw = res.headers['set-cookie'] as unknown as string[];
        return raw[0].split(';')[0];
      });

    const plan = await request(app.getHttpServer())
      .get('/auth/plan')
      .set('Cookie', cookie)
      .expect(200);

    expect(plan.body).toMatchObject({ plan: 'free', entitled: false });
    expect((plan.body as AccountPlan).limits.apps).toBe(0);
  });

  it('treats gmail dots, tags and googlemail as one mailbox', async () => {
    const first = await register('first.last@gmail.com');
    const dotted = await register('f.i.r.s.t.l.a.s.t@gmail.com');
    const tagged = await register('firstlast+promo@gmail.com');
    const alias = await register('FirstLast@googlemail.com');

    expect(first.entitled).toBe(true);
    expect([dotted, tagged, alias].map((account) => account.entitled)).toEqual([
      false,
      false,
      false,
    ]);
  });

  it('keeps dots significant where the provider counts them', async () => {
    const first = await register('first.last@outlook.com');
    const second = await register('firstlast@outlook.com');

    expect(first.entitled).toBe(true);
    expect(second.entitled).toBe(true);
  });

  it('remembers a mailbox after its workspace is erased', async () => {
    await register('returning@example.com');
    await prisma.workspace.deleteMany({
      where: { name: 'returning@example.com' },
    });
    await expect(
      prisma.user.count({ where: { email: 'returning@example.com' } }),
    ).resolves.toBe(0);

    const again = await register('returning@example.com');

    expect(again.entitled).toBe(false);
    expect(again.trialEndsAt).toBeNull();
  });

  it('stores a keyed fingerprint that holds neither the address nor a plain hash of it', async () => {
    await register('returning@example.com');

    const keys = (await prisma.trialClaim.findMany()).map(({ key }) => key);
    const plain = createHash('sha256').update('returning@example.com');

    expect(keys.sort()).toEqual(
      [
        trialClaimKey('operator@example.com'),
        trialClaimKey('returning@example.com'),
      ].sort(),
    );
    expect(keys.join()).not.toContain('returning');
    expect(keys).not.toContain(plain.copy().digest('hex'));
    expect(keys).not.toContain(plain.copy().digest('base64url'));
  });

  it('counts the operator account too, since it also took a trial', async () => {
    const operator = await register('operator+again@example.com');

    expect(operator.entitled).toBe(false);
  });

  it('starts no trial for an address on a throwaway domain', async () => {
    const throwaway = await register('fresh@mailinator.com');

    expect(throwaway.entitled).toBe(false);
    expect(throwaway.trialEndsAt).toBeNull();
    const workspace = await prisma.workspace.findFirstOrThrow({
      where: { name: 'fresh@mailinator.com' },
    });
    expect(workspace.trialStartedAt).toBeNull();
    expect(workspace.trialDeclinedAt).not.toBeNull();
  });

  it('keeps a throwaway domain from using up any mailbox', async () => {
    await register('fresh@mailinator.com');

    const keys = (await prisma.trialClaim.findMany()).map(({ key }) => key);
    expect(keys).toEqual([trialClaimKey('operator@example.com')]);
  });

  it('still starts a trial on a provider that is not throwaway', async () => {
    const account = await register('fresh@gmail.com');

    expect(account.entitled).toBe(true);
  });

  it('gives the mailbox back when a subscription lands before the first account gets its trial', async () => {
    await resetAccounts();

    const operator = await subscribeDuring(prisma, DEFAULT_WORKSPACE_ID, () =>
      register('operator@example.com'),
    );

    expect(operator.plan).toBe('indie');
    await expect(prisma.trialClaim.count()).resolves.toBe(0);
    const again = await register('operator+again@example.com');
    expect(again.entitled).toBe(true);
    expect(again.plan).toBe('trial');
  });
});
