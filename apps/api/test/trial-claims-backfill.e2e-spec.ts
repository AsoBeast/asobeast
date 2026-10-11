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
import { AppModule } from '../src/app.module';
import { TrialClaimBackfill } from '../src/auth/trial-claim-backfill';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { restoreAuthEnv } from './helpers/auth-env';
import { testDb } from './helpers/test-db';
import { trialClaimKey } from './helpers/trial-claim-key';
import {
  clearRateLimitCounters,
  obliterateQueues,
  pauseQueues,
} from './obliterate-queues';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('Mailboxes that had a trial before one trial per mailbox existed', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;

  const register = async (email: string): Promise<AuthUser> => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'supersecret1' })
      .expect(201);
    return res.body as AuthUser;
  };

  const seedWorkspace = async (
    id: string,
    owner: string,
    trialStartedAt: Date | null,
    members: string[] = [],
  ) => {
    await prisma.workspace.create({
      data: { id, name: owner, trialStartedAt },
    });
    await prisma.user.create({
      data: { workspaceId: id, email: owner, passwordHash: 'x', role: 'owner' },
    });
    for (const email of members) {
      await prisma.user.create({
        data: { workspaceId: id, email, passwordHash: 'x', role: 'member' },
      });
    }
  };

  beforeAll(async () => {
    execSync('pnpm prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'ignore',
    });

    prisma = testDb();
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "User", "TrialClaim" RESTART IDENTITY CASCADE',
    );
    await prisma.workspace.deleteMany({});
    await prisma.workspace.create({
      data: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
    await seedWorkspace(
      'ws_trialed',
      'grown.up@gmail.com',
      new Date(Date.now() - 30 * DAY_MS),
      ['colleague@example.com'],
    );
    await seedWorkspace('ws_fresh', 'never.tried@example.com', null);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication<App>();
    app.use(cookieParser());
    await app.init();
    await pauseQueues(app);
    await app.get(TrialClaimBackfill).completed();
  }, 60_000);

  beforeEach(async () => {
    await clearRateLimitCounters(app);
  });

  afterAll(async () => {
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
    await obliterateQueues(app);
    await app.close();
    restoreAuthEnv();
    await prisma.$disconnect();
  });

  it('claims the owner of the trialed workspace and nobody else', async () => {
    const keys = (await prisma.trialClaim.findMany()).map(({ key }) => key);

    expect(keys).toEqual([trialClaimKey('grownup@gmail.com')]);
  });

  it('refuses a second trial to a variant of the owner of a trialed workspace', async () => {
    const again = await register('grownup+again@googlemail.com');

    expect(again.entitled).toBe(false);
    expect(again.trialEndsAt).toBeNull();
  });

  it('still offers a trial to a member of that workspace, who never started one', async () => {
    const colleague = await register('colleague+new@example.com');

    expect(colleague.entitled).toBe(true);
  });

  it('still offers a trial to the owner of a workspace that never had one', async () => {
    const owner = await register('never.tried+new@example.com');

    expect(owner.entitled).toBe(true);
  });
});
