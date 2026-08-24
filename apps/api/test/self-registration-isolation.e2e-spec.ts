import './helpers/enable-open-registration';
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
const STRANGER = { email: 'stranger@example.com', password: 'supersecret2' };

function sessionCookie(res: request.Response): string {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = raw?.find((entry) => entry.startsWith('asobeast_session='));
  if (!cookie) throw new Error('no session cookie set');
  return cookie.split(';')[0];
}

describe('Self registration never joins an existing workspace', () => {
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

  const trackApp = async (workspaceId: string): Promise<void> => {
    await prisma.app.create({
      data: {
        workspaceId,
        store: Store.APP_STORE,
        storeAppId: 'owner-only-app',
        country: 'us',
        name: 'Owner only app',
      },
    });
  };

  const workspaceOf = async (email: string): Promise<string> => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    return user.workspaceId;
  };

  it('keeps a stranger who registers out of the owner workspace apps', async () => {
    await register(OWNER);
    await trackApp(await workspaceOf(OWNER.email));

    const stranger = await register(STRANGER);
    const apps = await request(app.getHttpServer())
      .get('/apps')
      .set('Cookie', stranger)
      .expect(200);

    expect(apps.body as AppListItem[]).toEqual([]);
  });

  it('gives a self registered account a workspace of its own', async () => {
    await register(OWNER);
    await register(STRANGER);

    const ownerWorkspace = await workspaceOf(OWNER.email);
    const strangerWorkspace = await workspaceOf(STRANGER.email);

    expect(ownerWorkspace).toBe(DEFAULT_WORKSPACE_ID);
    expect(strangerWorkspace).not.toBe(ownerWorkspace);
  });

  it('leaves the new workspace fully usable on a self hosted instance', async () => {
    await register(OWNER);
    const stranger = await register(STRANGER);

    await request(app.getHttpServer())
      .post('/auth/tokens')
      .set('Cookie', stranger)
      .send({ name: 'stranger token' })
      .expect(201);
  });

  it('still lets an invited member share the inviting workspace', async () => {
    const owner = await register(OWNER);
    const invited = await request(app.getHttpServer())
      .post('/workspace/invites')
      .set('Cookie', owner)
      .send({ email: STRANGER.email })
      .expect(201);

    const token = new URLSearchParams(
      (invited.body as { acceptPath: string }).acceptPath.split('?')[1],
    ).get('token');

    await request(app.getHttpServer())
      .post('/workspace/invites/accept')
      .send({ token, password: STRANGER.password })
      .expect(201);

    await expect(workspaceOf(STRANGER.email)).resolves.toBe(
      await workspaceOf(OWNER.email),
    );
  });
});
