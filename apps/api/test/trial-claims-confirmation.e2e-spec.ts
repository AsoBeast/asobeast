import './helpers/enable-billing';
import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { AuthUser } from '@asobeast/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { MailerService } from '../src/alerts/mailer.service';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { restoreAuthEnv } from './helpers/auth-env';
import { trialClaimKey } from './helpers/trial-claim-key';
import { testDb } from './helpers/test-db';
import {
  clearRateLimitCounters,
  obliterateQueues,
  pauseQueues,
} from './obliterate-queues';

interface SentMail {
  to: string;
  text: string;
}

describe('One trial per mailbox when the address is confirmed', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let sent: SentMail[];

  const register = async (email: string): Promise<AuthUser> => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'supersecret1' })
      .expect(201);
    return res.body as AuthUser;
  };

  const confirm = async (email: string): Promise<AuthUser> => {
    const mail = sent.filter(({ to }) => to === email).at(-1);
    expect(mail).toBeDefined();
    const token = /token=([0-9a-f]+)/.exec(mail?.text ?? '')?.[1];
    expect(token).toBeDefined();
    const res = await request(app.getHttpServer())
      .post('/auth/verify')
      .send({ token })
      .expect(200);
    return res.body as AuthUser;
  };

  beforeAll(async () => {
    execSync('pnpm prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'ignore',
    });

    sent = [];
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailerService)
      .useValue({
        enabled: true,
        sendAccountMail: ({ to, text }: SentMail) => {
          sent.push({ to, text });
          return Promise.resolve();
        },
      })
      .compile();
    app = moduleFixture.createNestApplication<App>();
    app.use(cookieParser());
    await app.init();
    await pauseQueues(app);

    prisma = testDb();
  }, 60_000);

  beforeEach(async () => {
    await clearRateLimitCounters(app);
    sent.length = 0;
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

  it('claims no mailbox at registration or at confirmation', async () => {
    await register('farmer+1@example.com');

    const confirmed = await confirm('farmer+1@example.com');

    expect(confirmed.emailVerified).toBe(true);
    expect(confirmed.entitled).toBe(false);
    expect(confirmed.trialEndsAt).toBeNull();
    await expect(prisma.trialClaim.count()).resolves.toBe(0);
  });

  it('declines a mailbox that already had a trial at registration and keeps the table on confirmation', async () => {
    await prisma.trialClaim.create({
      data: { key: trialClaimKey('farmer@example.com') },
    });

    const copy = await register('farmer+2@example.com');
    const confirmed = await confirm('farmer+2@example.com');

    expect(copy.trialAwaitsConfirmation).toBe(false);
    expect(confirmed.emailVerified).toBe(true);
    expect(confirmed.entitled).toBe(false);
    await expect(
      prisma.workspace.findFirstOrThrow({
        where: { name: 'farmer+2@example.com' },
        select: { trialDeclinedAt: true, trialStartedAt: true },
      }),
    ).resolves.toMatchObject({
      trialDeclinedAt: expect.any(Date) as Date,
      trialStartedAt: null,
    });
    await expect(
      prisma.trialClaim.findMany({ select: { key: true } }),
    ).resolves.toEqual([{ key: trialClaimKey('farmer@example.com') }]);
  });

  it('tells a throwaway address that no confirmation waits on a trial', async () => {
    const throwaway = await register('fresh@mailinator.com');

    expect(throwaway.trialAwaitsConfirmation).toBe(false);
    const confirmed = await confirm('fresh@mailinator.com');
    expect(confirmed.emailVerified).toBe(true);
    expect(confirmed.entitled).toBe(false);
  });
});
