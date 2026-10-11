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
import { subscribeDuring } from './helpers/subscribe-during';
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

describe('One trial per mailbox when the address must be confirmed', () => {
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

  it('claims the mailbox when the address is confirmed, not when it registers', async () => {
    await register('farmer+1@example.com');

    await expect(prisma.trialClaim.count()).resolves.toBe(0);

    const confirmed = await confirm('farmer+1@example.com');

    expect(confirmed.plan).toBe('trial');
    await expect(prisma.trialClaim.count()).resolves.toBe(1);
  });

  it('tells a copy of a trialed mailbox that no trial is waiting for it', async () => {
    await register('farmer+1@example.com');
    await confirm('farmer+1@example.com');

    const copy = await register('farmer+2@example.com');

    expect(copy.trialAwaitsConfirmation).toBe(false);
    expect(copy.entitled).toBe(false);
  });

  it('starts no trial when that copy confirms its address', async () => {
    await register('farmer+1@example.com');
    await confirm('farmer+1@example.com');
    await register('farmer+2@example.com');

    const confirmed = await confirm('farmer+2@example.com');

    expect(confirmed.emailVerified).toBe(true);
    expect(confirmed.entitled).toBe(false);
    expect(confirmed.trialEndsAt).toBeNull();
  });

  it('gives the trial to whichever copy confirms first when both registered before either did', async () => {
    const first = await register('farmer+1@example.com');
    const second = await register('farmer+2@example.com');
    expect([first, second].map((a) => a.trialAwaitsConfirmation)).toEqual([
      true,
      true,
    ]);

    const winner = await confirm('farmer+2@example.com');
    const loser = await confirm('farmer+1@example.com');

    expect(winner.entitled).toBe(true);
    expect(loser.entitled).toBe(false);
    expect(loser.trialAwaitsConfirmation).toBe(false);
  });

  it('starts one trial when two copies of a mailbox confirm at the same time', async () => {
    await register('farmer+1@example.com');
    await register('farmer+2@example.com');

    const confirmed = await Promise.all([
      confirm('farmer+1@example.com'),
      confirm('farmer+2@example.com'),
    ]);

    expect(confirmed.filter((account) => account.entitled)).toHaveLength(1);
    await expect(
      prisma.workspace.count({ where: { plan: 'trial' } }),
    ).resolves.toBe(1);
    await expect(prisma.trialClaim.count()).resolves.toBe(1);
  });

  it('does not let an unconfirmed registration use up the mailbox', async () => {
    await register('farmer+1@example.com');

    const copy = await register('farmer+2@example.com');
    const confirmed = await confirm('farmer+2@example.com');

    expect(copy.trialAwaitsConfirmation).toBe(true);
    expect(confirmed.entitled).toBe(true);
  });

  it('tells a throwaway address that no trial is waiting for it', async () => {
    const throwaway = await register('fresh@mailinator.com');

    expect(throwaway.trialAwaitsConfirmation).toBe(false);
  });

  it('starts no trial when a throwaway address confirms', async () => {
    await register('fresh@mailinator.com');

    const confirmed = await confirm('fresh@mailinator.com');

    expect(confirmed.emailVerified).toBe(true);
    expect(confirmed.entitled).toBe(false);
  });

  it('gives the mailbox back when a subscription lands while the address is confirmed', async () => {
    await register('farmer+1@example.com');
    const { workspaceId } = await prisma.user.findUniqueOrThrow({
      where: { email: 'farmer+1@example.com' },
    });

    const confirmed = await subscribeDuring(prisma, workspaceId, () =>
      confirm('farmer+1@example.com'),
    );

    expect(confirmed.plan).toBe('indie');
    await expect(prisma.trialClaim.count()).resolves.toBe(0);
    await register('farmer+2@example.com');
    const copy = await confirm('farmer+2@example.com');
    expect(copy.plan).toBe('trial');
  });
});
