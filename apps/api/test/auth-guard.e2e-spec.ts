import './helpers/enable-auth';
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
import { testDb } from './helpers/test-db';
import { obliterateQueues, pauseQueues } from './obliterate-queues';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { sha256 } from '../src/auth/password-hash';
import { restoreAuthEnv } from './helpers/auth-env';

function sessionCookie(res: request.Response): string {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = raw?.find((entry) => entry.startsWith('asobeast_session='));
  if (!cookie) throw new Error('no session cookie set');
  return cookie.split(';')[0];
}

async function registerOwner(
  app: INestApplication<App>,
): Promise<{ cookie: string; user: AuthUser }> {
  const res = await request(app.getHttpServer())
    .post('/auth/register')
    .send({ email: 'owner@example.com', password: 'supersecret1' })
    .expect(201);
  return { cookie: sessionCookie(res), user: res.body as AuthUser };
}

describe('AuthGuard (e2e)', () => {
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
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: {},
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "App", "User" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "User" RESTART IDENTITY CASCADE',
    );
    await obliterateQueues(app);
    await app.close();
    restoreAuthEnv();
    await prisma.$disconnect();
  });

  it('rejects a protected route without credentials by default', async () => {
    await request(app.getHttpServer()).get('/apps').expect(401);
  });

  it('accepts a protected route with a session cookie', async () => {
    const { cookie } = await registerOwner(app);
    await request(app.getHttpServer())
      .get('/apps')
      .set('Cookie', cookie)
      .expect(200);
  });

  it('accepts a protected route with an api token', async () => {
    const { user } = await registerOwner(app);
    const plaintext = `asob_${'a'.repeat(48)}`;
    await prisma.apiToken.create({
      data: {
        userId: user.id,
        name: 'ci',
        tokenHash: sha256(plaintext),
        prefix: plaintext.slice(0, 12),
      },
    });

    await request(app.getHttpServer())
      .get('/apps')
      .set('Authorization', `Bearer ${plaintext}`)
      .expect(200);
  });

  it('rejects a stale session after a version bump', async () => {
    const { cookie, user } = await registerOwner(app);
    await prisma.user.update({
      where: { id: user.id },
      data: { sessionVersion: { increment: 1 } },
    });

    await request(app.getHttpServer())
      .get('/apps')
      .set('Cookie', cookie)
      .expect(401);
  });

  it('leaves public routes open', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
  });
});
