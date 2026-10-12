import './enable-public-url';
import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { App } from 'supertest/types';
import { MailerService } from '../../src/alerts/mailer.service';
import { AppModule } from '../../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../../src/common/tenancy/default-workspace';
import {
  clearRateLimitCounters,
  obliterateQueues,
  settleBootRegistration,
} from '../obliterate-queues';
import { TEST_WEB_PUBLIC_URL } from './enable-public-url';
import { ownerAgent, useCookies } from './session';
import { testDb } from './test-db';

export interface EmailAlertApp {
  app: INestApplication<App>;
  prisma: PrismaClient;
  api: Awaited<ReturnType<typeof ownerAgent>>;
  send: jest.Mock;
  sendAccountMail: jest.Mock;
  reset: () => Promise<void>;
  close: () => Promise<void>;
}

export async function startEmailAlertApp(): Promise<EmailAlertApp> {
  execSync('pnpm prisma migrate deploy', {
    cwd: join(__dirname, '..', '..'),
    env: process.env,
    stdio: 'ignore',
  });
  const send = jest.fn().mockResolvedValue(undefined);
  const sendAccountMail = jest.fn().mockResolvedValue(undefined);
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(MailerService)
    .useValue({
      enabled: true,
      origin: TEST_WEB_PUBLIC_URL,
      send,
      sendAccountMail,
    })
    .compile();

  const app = moduleFixture.createNestApplication<INestApplication<App>>();
  useCookies(app);
  await app.init();
  await settleBootRegistration(app);
  const prisma = testDb();
  await prisma.workspace.upsert({
    where: { id: DEFAULT_WORKSPACE_ID },
    update: {},
    create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
  });
  const api = await ownerAgent(app);

  return {
    app,
    prisma,
    api,
    send,
    sendAccountMail,
    reset: async () => {
      send.mockReset().mockResolvedValue(undefined);
      sendAccountMail.mockReset().mockResolvedValue(undefined);
      await clearRateLimitCounters(app);
      await prisma.user.updateMany({ data: { emailVerifiedAt: null } });
      await prisma.$executeRawUnsafe(
        'TRUNCATE TABLE "EmailAlert", "AlertDelivery" RESTART IDENTITY CASCADE',
      );
    },
    close: async () => {
      await prisma.$disconnect();
      await obliterateQueues(app);
      await app.close();
    },
  };
}
