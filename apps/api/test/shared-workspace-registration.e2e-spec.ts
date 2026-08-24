import './helpers/enable-shared-workspace';
import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Store } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { AppListItem } from '@asobeast/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { testDb } from './helpers/test-db';
import { restoreAuthEnv } from './helpers/auth-env';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import {
  clearRateLimitCounters,
  obliterateQueues,
  pauseQueues,
} from './obliterate-queues';

const OWNER = { email: 'owner@example.com', password: 'supersecret1' };
const JOINER = { email: 'joiner@example.com', password: 'supersecret2' };

function sessionCookie(res: request.Response): string {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = raw?.find((entry) => entry.startsWith('asobeast_session='));
  if (!cookie) throw new Error('no session cookie set');
  return cookie.split(';')[0];
}

describe('The shared workspace opt-in', () => {
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
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "App" CASCADE');
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "User" RESTART IDENTITY CASCADE',
    );
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
    restoreAuthEnv();
  });

  beforeEach(async () => {
    await clearRateLimitCounters(app);
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "App" CASCADE');
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "User" RESTART IDENTITY CASCADE',
    );
    await prisma.workspace.deleteMany({
      where: { id: { not: DEFAULT_WORKSPACE_ID } },
    });
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: {},
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
  });

  const register = async (account: typeof OWNER): Promise<string> => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send(account)
      .expect(201);
    return sessionCookie(res);
  };

  it('still puts a later registration in the bootstrap workspace', async () => {
    await register(OWNER);
    await prisma.app.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        store: Store.APP_STORE,
        storeAppId: 'shared-app',
        country: 'us',
        name: 'Shared app',
      },
    });

    const joiner = await register(JOINER);
    const apps = await request(app.getHttpServer())
      .get('/apps')
      .set('Cookie', joiner)
      .expect(200);

    expect((apps.body as AppListItem[]).map((row) => row.name)).toEqual([
      'Shared app',
    ]);
  });

  it('joins that workspace as a member rather than an owner', async () => {
    await register(OWNER);
    await register(JOINER);

    const joiner = await prisma.user.findUniqueOrThrow({
      where: { email: JOINER.email },
    });
    expect(joiner.workspaceId).toBe(DEFAULT_WORKSPACE_ID);
    expect(joiner.role).toBe('member');
  });
});
