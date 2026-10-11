import './helpers/enable-auth';
import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import {
  ApiErrorEnvelope,
  ApiTokenCreated,
  DELETION_CONFIRMATION,
  WorkspaceTeam,
} from '@asobeast/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { restoreAuthEnv } from './helpers/auth-env';
import { mintApiToken } from './helpers/api-tokens';
import { testDb } from './helpers/test-db';
import {
  clearRateLimitCounters,
  obliterateQueues,
  pauseQueues,
} from './obliterate-queues';

const PASSWORD = 'supersecret1';

function sessionCookie(res: request.Response): string {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = raw?.find((entry) => entry.startsWith('asobeast_session='));
  if (!cookie) throw new Error('no session cookie set');
  return cookie.split(';')[0];
}

describe('Routes that manage credentials, the team and the workspace', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let cookie: string;
  let bearer: string;
  let memberId: string;

  const withToken = (
    method: 'post' | 'delete',
    path: string,
    body?: object,
  ): request.Test => {
    const call = request(app.getHttpServer())[method](path);
    return call.set('Authorization', bearer).send(body);
  };

  const refused = (response: request.Response): string => {
    expect(response.status).toBe(403);
    return (response.body as ApiErrorEnvelope).message;
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
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: { deletionRequestedAt: null, deletionDueAt: null },
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
  }, 60_000);

  beforeEach(async () => {
    await clearRateLimitCounters(app);
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "WorkspaceInvite" RESTART IDENTITY CASCADE',
    );
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "User" RESTART IDENTITY CASCADE',
    );
    await prisma.workspace.update({
      where: { id: DEFAULT_WORKSPACE_ID },
      data: {
        deletionRequestedAt: null,
        deletionRequestedBy: null,
        deletionDueAt: null,
      },
    });
    const owner = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'owner@example.com', password: PASSWORD })
      .expect(201);
    cookie = sessionCookie(owner);
    bearer = `Bearer ${await mintApiToken(app, owner, 'write')}`;
    const member = await prisma.user.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        email: 'member@example.com',
        passwordHash: 'unused',
        role: 'member',
      },
    });
    memberId = member.id;
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

  it('refuses a write-scoped token that tries to mint another token', async () => {
    const message = refused(
      await withToken('post', '/auth/tokens', { name: 'successor' }),
    );

    expect(message).toContain('signed in session');
    await expect(prisma.apiToken.count()).resolves.toBe(1);
  });

  it('refuses a write-scoped token that tries to revoke a token', async () => {
    const [{ id }] = await prisma.apiToken.findMany();

    refused(await withToken('delete', `/auth/tokens/${id}`));

    await expect(prisma.apiToken.count()).resolves.toBe(1);
  });

  it('refuses a write-scoped token that tries to schedule the workspace for deletion', async () => {
    refused(
      await withToken('post', '/account/deletion', {
        confirm: DELETION_CONFIRMATION,
      }),
    );

    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { id: DEFAULT_WORKSPACE_ID },
    });
    expect(workspace.deletionDueAt).toBeNull();
  });

  it('refuses a write-scoped token that tries to cancel a scheduled deletion', async () => {
    await request(app.getHttpServer())
      .post('/account/deletion')
      .set('Cookie', cookie)
      .send({ confirm: DELETION_CONFIRMATION })
      .expect(201);

    refused(await withToken('delete', '/account/deletion'));

    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { id: DEFAULT_WORKSPACE_ID },
    });
    expect(workspace.deletionDueAt).not.toBeNull();
  });

  it('refuses a write-scoped token that tries to invite somebody', async () => {
    refused(
      await withToken('post', '/workspace/invites', {
        email: 'stranger@example.com',
      }),
    );

    await expect(prisma.workspaceInvite.count()).resolves.toBe(0);
  });

  it('refuses a write-scoped token that tries to revoke an invitation', async () => {
    const invited = await request(app.getHttpServer())
      .post('/workspace/invites')
      .set('Cookie', cookie)
      .send({ email: 'pending@example.com' })
      .expect(201);

    refused(
      await withToken(
        'delete',
        `/workspace/invites/${(invited.body as { id: string }).id}`,
      ),
    );

    await expect(prisma.workspaceInvite.count()).resolves.toBe(1);
  });

  it('refuses a write-scoped token that tries to remove a member', async () => {
    refused(await withToken('delete', `/workspace/members/${memberId}`));

    await expect(prisma.user.count({ where: { id: memberId } })).resolves.toBe(
      1,
    );
  });

  it('refuses a write-scoped token that tries to change the password', async () => {
    refused(
      await withToken('post', '/auth/password', {
        current: PASSWORD,
        next: 'attackerchosen1',
      }),
    );

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'owner@example.com', password: PASSWORD })
      .expect(200);
  });

  it('still lets the signed in owner do every one of those things', async () => {
    const minted = await request(app.getHttpServer())
      .post('/auth/tokens')
      .set('Cookie', cookie)
      .send({ name: 'second' })
      .expect(201);
    await request(app.getHttpServer())
      .delete(`/auth/tokens/${(minted.body as ApiTokenCreated).id}`)
      .set('Cookie', cookie)
      .expect(204);
    await request(app.getHttpServer())
      .delete(`/workspace/members/${memberId}`)
      .set('Cookie', cookie)
      .expect(204);
  });

  it('still lets a write-scoped token read the team and the token list', async () => {
    const team = await request(app.getHttpServer())
      .get('/workspace/team')
      .set('Authorization', bearer)
      .expect(200);
    expect((team.body as WorkspaceTeam).members).toHaveLength(2);
    await request(app.getHttpServer())
      .get('/auth/tokens')
      .set('Authorization', bearer)
      .expect(200);
  });
});
