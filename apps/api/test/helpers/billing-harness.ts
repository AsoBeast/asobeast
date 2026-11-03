import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, PrismaClient } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { MailerService } from '../../src/alerts/mailer.service';
import { AppModule } from '../../src/app.module';
import { sha256 } from '../../src/auth/password-hash';
import { STRIPE_CLIENT } from '../../src/billing/stripe.client';
import { DEFAULT_WORKSPACE_ID } from '../../src/common/tenancy/default-workspace';
import { restoreAuthEnv } from './auth-env';
import { fakeStripe, type FakeStripe } from './fake-stripe';
import { ownerAgent, useCookies } from './session';
import { testDb } from './test-db';
import {
  clearRateLimitCounters,
  obliterateQueues,
  pauseQueues,
} from '../obliterate-queues';

const DAY_MS = 24 * 60 * 60 * 1000;

const MEMBER_TOKEN = `asob_${'billingmember'.padEnd(48, '7')}`;

export const WORKSPACE = DEFAULT_WORKSPACE_ID;

export interface SentMail {
  to: string;
  subject: string;
  text: string;
}

export interface RecordingMailer extends Pick<
  MailerService,
  'enabled' | 'origin' | 'send' | 'sendAccountMail'
> {
  sent: SentMail[];
}

export function recordingMailer(): RecordingMailer {
  const sent: SentMail[] = [];
  const record = ({ to, subject, text }: SentMail) => {
    sent.push({ to, subject, text });
    return Promise.resolve();
  };
  return {
    enabled: true,
    origin: process.env.WEB_PUBLIC_URL ?? null,
    sent,
    send: record,
    sendAccountMail: record,
  };
}

export interface BillingHarness {
  app: INestApplication<App>;
  prisma: PrismaClient;
  fake: FakeStripe;
  owner: Awaited<ReturnType<typeof ownerAgent>>;
  memberToken: string;
}

export async function startBillingHarness(
  configured = true,
  prepare: (fake: FakeStripe) => void = () => undefined,
  mailer?: RecordingMailer,
): Promise<BillingHarness> {
  execSync('pnpm prisma migrate deploy', {
    cwd: join(__dirname, '..', '..'),
    env: process.env,
    stdio: 'ignore',
  });

  const fake = fakeStripe();
  prepare(fake);
  const builder = Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(STRIPE_CLIENT)
    .useValue(configured ? fake : null);
  const moduleFixture: TestingModule = await (
    mailer ? builder.overrideProvider(MailerService).useValue(mailer) : builder
  ).compile();
  const app: INestApplication<App> = moduleFixture.createNestApplication();
  useCookies(app);
  await app.init();
  await pauseQueues(app);

  const prisma = testDb();
  await prisma.workspace.upsert({
    where: { id: WORKSPACE },
    update: {},
    create: { id: WORKSPACE, name: 'Default' },
  });
  await truncateUsers(prisma);
  const owner = await ownerAgent(app);
  const memberToken = await seedMember(prisma);

  return { app, prisma, fake, owner, memberToken };
}

export async function resetBillingState(
  harness: BillingHarness,
  data: Prisma.WorkspaceUpdateInput = {},
): Promise<void> {
  harness.fake.reset();
  await clearRateLimitCounters(harness.app);
  await harness.prisma.$executeRawUnsafe('TRUNCATE TABLE "TrialClaim"');
  await harness.prisma.workspace.update({
    where: { id: WORKSPACE },
    data: {
      plan: 'free',
      trialStartedAt: null,
      trialDeclinedAt: null,
      trialClaimedAt: null,
      firstPaidAt: null,
      billingInterval: null,
      subscriptionEventAt: null,
      trialEndsAt: new Date(Date.now() + 7 * DAY_MS),
      planExpiresAt: null,
      billingCustomerId: null,
      subscriptionId: null,
      subscriptionStatus: null,
      cancelAtPeriodEnd: false,
      checkoutSessionId: null,
      checkoutClaimedAt: null,
      checkoutClaimToken: null,
      ...data,
    },
  });
}

export async function stopBillingHarness(
  harness: BillingHarness,
): Promise<void> {
  await truncateUsers(harness.prisma);
  await obliterateQueues(harness.app);
  await harness.app.close();
  restoreAuthEnv();
  await harness.prisma.$disconnect();
}

export function workspaceRow(harness: BillingHarness) {
  return harness.prisma.workspace.findUniqueOrThrow({
    where: { id: WORKSPACE },
  });
}

export function asMember(harness: BillingHarness, path: string): request.Test {
  return request(harness.app.getHttpServer())
    .post(path)
    .set('Authorization', `Bearer ${harness.memberToken}`);
}

export function anonymously(
  harness: BillingHarness,
  path: string,
): request.Test {
  return request(harness.app.getHttpServer()).post(path);
}

function truncateUsers(prisma: PrismaClient): Promise<number> {
  return prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "User" RESTART IDENTITY CASCADE',
  );
}

async function seedMember(prisma: PrismaClient): Promise<string> {
  const member = await prisma.user.create({
    data: {
      workspaceId: WORKSPACE,
      email: 'member@billing.example.com',
      passwordHash: 'password-login-unused',
      role: 'member',
    },
  });
  await prisma.apiToken.create({
    data: {
      userId: member.id,
      name: 'billing e2e',
      tokenHash: sha256(MEMBER_TOKEN),
      prefix: MEMBER_TOKEN.slice(0, 12),
    },
  });
  return MEMBER_TOKEN;
}
