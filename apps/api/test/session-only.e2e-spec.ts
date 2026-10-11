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
  WorkspaceInviteCreated,
  WorkspaceTeam,
} from '@asobeast/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { restoreAuthEnv } from './helpers/auth-env';
import {
  mintApiToken,
  seedWorkspace,
  truncateUsers,
} from './helpers/api-tokens';
import { testDb } from './helpers/test-db';
import {
  clearRateLimitCounters,
  obliterateQueues,
  pauseQueues,
} from './obliterate-queues';

const PASSWORD = 'supersecret1';
const SESSION_ONLY_REFUSAL =
  'This needs a signed in session. A personal API token cannot do it.';

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

  const withSession = (
    method: 'post' | 'delete',
    path: string,
    body?: object,
  ): request.Test => {
    const call = request(app.getHttpServer())[method](path);
    return call.set('Cookie', cookie).send(body);
  };

  const refused = (response: request.Response): void => {
    expect(response.status).toBe(403);
    expect((response.body as ApiErrorEnvelope).message).toBe(
      SESSION_ONLY_REFUSAL,
    );
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
    await seedWorkspace(prisma, DEFAULT_WORKSPACE_ID, 'Default');
  }, 60_000);

  beforeEach(async () => {
    await clearRateLimitCounters(app);
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "WorkspaceInvite" RESTART IDENTITY CASCADE',
    );
    await truncateUsers(prisma);
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
    await truncateUsers(prisma);
    await obliterateQueues(app);
    await app.close();
    restoreAuthEnv();
    await prisma.$disconnect();
  });

  it('refuses a write-scoped token that tries to mint another token', async () => {
    refused(await withToken('post', '/auth/tokens', { name: 'successor' }));

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
    await withSession('post', '/account/deletion', {
      confirm: DELETION_CONFIRMATION,
    }).expect(201);

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
    const invited = await withSession('post', '/workspace/invites', {
      email: 'pending@example.com',
    }).expect(201);

    refused(
      await withToken(
        'delete',
        `/workspace/invites/${(invited.body as WorkspaceInviteCreated).id}`,
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
    const minted = await withSession('post', '/auth/tokens', {
      name: 'second',
    }).expect(201);
    await withSession(
      'delete',
      `/auth/tokens/${(minted.body as ApiTokenCreated).id}`,
    ).expect(204);
    const invited = await withSession('post', '/workspace/invites', {
      email: 'pending@example.com',
    }).expect(201);
    await withSession(
      'delete',
      `/workspace/invites/${(invited.body as WorkspaceInviteCreated).id}`,
    ).expect(204);
    await withSession('delete', `/workspace/members/${memberId}`).expect(204);
    await withSession('post', '/account/deletion', {
      confirm: DELETION_CONFIRMATION,
    }).expect(201);
    await withSession('delete', '/account/deletion').expect(200);
    await withSession('post', '/auth/password', {
      current: PASSWORD,
      next: 'brandnewsecret1',
    }).expect(200);

    await expect(prisma.apiToken.count()).resolves.toBe(0);
    await expect(prisma.workspaceInvite.count()).resolves.toBe(0);
    await expect(prisma.user.count()).resolves.toBe(1);
    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { id: DEFAULT_WORKSPACE_ID },
    });
    expect(workspace.deletionDueAt).toBeNull();
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
