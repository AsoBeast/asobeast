import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../../src/common/tenancy/default-workspace';
import { StoreProviderRegistry } from '../../src/store-providers/store-provider.registry';
import {
  clearOnDemandCounters,
  clearRateLimitCounters,
  obliterateQueues,
  pauseQueues,
} from '../obliterate-queues';
import { restoreAuthEnv } from './auth-env';
import { FakeRegistry } from './mcp-fixtures';
import { ownerAgent, useCookies } from './session';
import { testDb } from './test-db';

const DAY_MS = 24 * 60 * 60 * 1000;

const TRUNCATE_TRACKED_DATA =
  'TRUNCATE TABLE "App", "Keyword", "User" RESTART IDENTITY CASCADE';

export type OwnerAgent = Awaited<ReturnType<typeof ownerAgent>>;

export interface CapacityHarness {
  app: INestApplication<App>;
  prisma: PrismaClient;
}

export async function startCapacityHarness(): Promise<CapacityHarness> {
  execSync('pnpm prisma migrate deploy', {
    cwd: join(__dirname, '..', '..'),
    env: process.env,
    stdio: 'ignore',
  });
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(StoreProviderRegistry)
    .useValue(new FakeRegistry())
    .compile();
  const app: INestApplication<App> = moduleFixture.createNestApplication();
  useCookies(app);
  await app.init();
  await pauseQueues(app);
  const prisma = testDb();
  await prisma.workspace.upsert({
    where: { id: DEFAULT_WORKSPACE_ID },
    update: {},
    create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
  });
  return { app, prisma };
}

export async function resetCapacity({
  app,
  prisma,
}: CapacityHarness): Promise<OwnerAgent> {
  await prisma.$executeRawUnsafe(TRUNCATE_TRACKED_DATA);
  await prisma.workspace.update({
    where: { id: DEFAULT_WORKSPACE_ID },
    data: {
      plan: 'indie',
      planExpiresAt: new Date(Date.now() + 30 * DAY_MS),
      trialEndsAt: null,
      suspendedAt: null,
    },
  });
  await obliterateQueues(app);
  await clearOnDemandCounters(app);
  const owner = await ownerAgent(app);
  await clearRateLimitCounters(app);
  return owner;
}

export async function stopCapacityHarness({
  app,
  prisma,
}: CapacityHarness): Promise<void> {
  await prisma.$executeRawUnsafe(TRUNCATE_TRACKED_DATA);
  await prisma.workspace.update({
    where: { id: DEFAULT_WORKSPACE_ID },
    data: { plan: 'free', planExpiresAt: null, trialEndsAt: null },
  });
  await obliterateQueues(app);
  await app.close();
  restoreAuthEnv();
  await prisma.$disconnect();
}
