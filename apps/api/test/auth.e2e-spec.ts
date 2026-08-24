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
  ApiTokenItem,
  AuthUser,
  WorkspaceInviteCreated,
  WorkspaceTeam,
} from '@asobeast/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { testDb } from './helpers/test-db';
import {
  clearRateLimitCounters,
  obliterateQueues,
  pauseQueues,
} from './obliterate-queues';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { restoreAuthEnv } from './helpers/auth-env';

function sessionCookie(res: request.Response): string {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = raw?.find((entry) => entry.startsWith('asobeast_session='));
  if (!cookie) throw new Error('no session cookie set');
  return cookie.split(';')[0];
}

describe('Auth (enabled, self-hosted)', () => {
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
    await clearRateLimitCounters(app);
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "WorkspaceInvite" RESTART IDENTITY CASCADE',
    );
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "User" RESTART IDENTITY CASCADE',
    );
  });

  const registerOwner = async (): Promise<string> => {
    const register = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'owner@example.com', password: 'supersecret1' })
      .expect(201);
    return sessionCookie(register);
  };

  const inviteMember = async (
    cookie: string,
    email: string,
  ): Promise<WorkspaceInviteCreated> => {
    const invited = await request(app.getHttpServer())
      .post('/workspace/invites')
      .set('Cookie', cookie)
      .send({ email })
      .expect(201);
    return invited.body as WorkspaceInviteCreated;
  };

  const tokenOf = (invite: WorkspaceInviteCreated): string =>
    new URLSearchParams(invite.acceptPath.split('?')[1]).get('token') ?? '';

  it('invites a member who joins the same workspace', async () => {
    const cookie = await registerOwner();
    const invite = await inviteMember(cookie, 'Teammate@Example.com');
    expect(invite.email).toBe('teammate@example.com');
    expect(invite.delivered).toBe(false);

    const accepted = await request(app.getHttpServer())
      .post('/workspace/invites/accept')
      .send({ token: tokenOf(invite), password: 'anothersecret1' })
      .expect(201);
    const member = accepted.body as AuthUser;
    expect(member.email).toBe('teammate@example.com');
    expect(member.role).toBe('member');
    expect(member.platformOperator).toBe(false);

    const rows = await prisma.user.findMany({ select: { workspaceId: true } });
    expect(new Set(rows.map((row) => row.workspaceId)).size).toBe(1);

    const team = await request(app.getHttpServer())
      .get('/workspace/team')
      .set('Cookie', cookie)
      .expect(200);
    expect((team.body as WorkspaceTeam).members).toHaveLength(2);
    expect((team.body as WorkspaceTeam).invites).toEqual([]);
  });

  it('refuses a token that was already spent', async () => {
    const cookie = await registerOwner();
    const invite = await inviteMember(cookie, 'once@example.com');
    const accept = () =>
      request(app.getHttpServer())
        .post('/workspace/invites/accept')
        .send({ token: tokenOf(invite), password: 'anothersecret1' });

    await accept().expect(201);
    await accept().expect(404);
  });

  it('refuses a signed-in caller without spending the invitation', async () => {
    const cookie = await registerOwner();
    const invite = await inviteMember(cookie, 'joiner@example.com');

    await request(app.getHttpServer())
      .post('/workspace/invites/accept')
      .set('Cookie', cookie)
      .send({ token: tokenOf(invite), password: 'anothersecret1' })
      .expect(409);

    await expect(
      prisma.workspaceInvite.count({ where: { id: invite.id } }),
    ).resolves.toBe(1);
    await expect(
      prisma.user.count({ where: { email: 'joiner@example.com' } }),
    ).resolves.toBe(0);

    await request(app.getHttpServer())
      .post('/workspace/invites/accept')
      .send({ token: tokenOf(invite), password: 'anothersecret1' })
      .expect(201);
  });

  it('refuses an expired invitation', async () => {
    const cookie = await registerOwner();
    const invite = await inviteMember(cookie, 'late@example.com');
    await prisma.workspaceInvite.update({
      where: { id: invite.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await request(app.getHttpServer())
      .post('/workspace/invites/accept')
      .send({ token: tokenOf(invite), password: 'anothersecret1' })
      .expect(404);
  });

  it('keeps invitations and member removal to the owner', async () => {
    const cookie = await registerOwner();
    const invite = await inviteMember(cookie, 'member@example.com');
    const accepted = await request(app.getHttpServer())
      .post('/workspace/invites/accept')
      .send({ token: tokenOf(invite), password: 'anothersecret1' })
      .expect(201);
    const memberCookie = sessionCookie(accepted);
    const memberId = (accepted.body as AuthUser).id;

    await request(app.getHttpServer())
      .post('/workspace/invites')
      .set('Cookie', memberCookie)
      .send({ email: 'another@example.com' })
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/workspace/members/${memberId}`)
      .set('Cookie', memberCookie)
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/workspace/members/${memberId}`)
      .set('Cookie', cookie)
      .expect(204);

    await expect(prisma.user.count()).resolves.toBe(1);
  });

  it('refuses to remove the owner and revokes a pending invitation', async () => {
    const cookie = await registerOwner();
    const owner = await prisma.user.findUniqueOrThrow({
      where: { email: 'owner@example.com' },
      select: { id: true },
    });

    await request(app.getHttpServer())
      .delete(`/workspace/members/${owner.id}`)
      .set('Cookie', cookie)
      .expect(403);

    const invite = await inviteMember(cookie, 'revoked@example.com');
    await request(app.getHttpServer())
      .delete(`/workspace/invites/${invite.id}`)
      .set('Cookie', cookie)
      .expect(204);

    await expect(prisma.workspaceInvite.count()).resolves.toBe(0);
  });

  it('refuses to invite an email that already has an account', async () => {
    const cookie = await registerOwner();

    await request(app.getHttpServer())
      .post('/workspace/invites')
      .set('Cookie', cookie)
      .send({ email: 'owner@example.com' })
      .expect(409);
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

  it('bootstraps the first account, sets a cookie and resolves me', async () => {
    const register = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'Owner@Example.com', password: 'supersecret1' })
      .expect(201);
    const created = register.body as AuthUser;
    expect(created.email).toBe('owner@example.com');
    expect(created.role).toBe('owner');
    expect(created.entitled).toBe(true);
    expect(created.platformOperator).toBe(true);

    const cookie = sessionCookie(register);
    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', cookie)
      .expect(200);
    expect((me.body as AuthUser).email).toBe('owner@example.com');

    const owner = await prisma.user.findUniqueOrThrow({
      where: { email: 'owner@example.com' },
      select: { workspaceId: true },
    });
    expect(owner.workspaceId).toBe(DEFAULT_WORKSPACE_ID);
  });

  it('closes registration after the first user', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'first@example.com', password: 'supersecret1' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'second@example.com', password: 'supersecret1' })
      .expect(403);
  });

  it('returns a uniform 401 for a wrong password', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'login@example.com', password: 'supersecret1' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'login@example.com', password: 'wrongpassword' })
      .expect(401);
  });

  it('logout drops the session so me is unauthorized', async () => {
    const register = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'logout@example.com', password: 'supersecret1' })
      .expect(201);
    const cookie = sessionCookie(register);

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', cookie)
      .expect(200);

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', cookie)
      .expect(204);

    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('changes the password and resets other sessions', async () => {
    const register = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'change@example.com', password: 'supersecret1' })
      .expect(201);
    const oldCookie = sessionCookie(register);

    await request(app.getHttpServer())
      .post('/auth/password')
      .set('Cookie', oldCookie)
      .send({ current: 'wrongpassword', next: 'brandnewsecret1' })
      .expect(401);

    const changed = await request(app.getHttpServer())
      .post('/auth/password')
      .set('Cookie', oldCookie)
      .send({ current: 'supersecret1', next: 'brandnewsecret1' })
      .expect(200);
    const newCookie = sessionCookie(changed);

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', oldCookie)
      .expect(401);

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', newCookie)
      .expect(200);
  });

  it('creates, uses and revokes a personal api token', async () => {
    const register = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'token@example.com', password: 'supersecret1' })
      .expect(201);
    const cookie = sessionCookie(register);

    const create = await request(app.getHttpServer())
      .post('/auth/tokens')
      .set('Cookie', cookie)
      .send({ name: 'ci' })
      .expect(201);
    const created = create.body as ApiTokenCreated;
    expect(created.token).toMatch(/^asob_[0-9a-f]{48}$/);
    expect(created.prefix).toBe(created.token.slice(0, 12));

    const list = await request(app.getHttpServer())
      .get('/auth/tokens')
      .set('Cookie', cookie)
      .expect(200);
    const items = list.body as ApiTokenItem[];
    expect(items).toHaveLength(1);
    expect(items[0]).not.toHaveProperty('tokenHash');
    expect(items[0]).not.toHaveProperty('token');

    await request(app.getHttpServer())
      .get('/apps')
      .set('Authorization', `Bearer ${created.token}`)
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/auth/tokens/${created.id}`)
      .set('Cookie', cookie)
      .expect(204);

    await request(app.getHttpServer())
      .get('/apps')
      .set('Authorization', `Bearer ${created.token}`)
      .expect(401);
  });

  it('mints a read-only token by default and refuses writes with it', async () => {
    const register = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'scoped@example.com', password: 'supersecret1' })
      .expect(201);
    const cookie = sessionCookie(register);

    const create = await request(app.getHttpServer())
      .post('/auth/tokens')
      .set('Cookie', cookie)
      .send({ name: 'agent' })
      .expect(201);
    const created = create.body as ApiTokenCreated;
    expect(created.scope).toBe('read');
    expect(created.expiresAt).toBeNull();

    await request(app.getHttpServer())
      .get('/apps')
      .set('Authorization', `Bearer ${created.token}`)
      .expect(200);

    const refused = await request(app.getHttpServer())
      .post('/apps')
      .set('Authorization', `Bearer ${created.token}`)
      .send({ url: 'https://apps.apple.com/us/app/thing/id123' })
      .expect(403);
    expect((refused.body as ApiErrorEnvelope).message).toContain('read-only');
  });

  it('lets a write-scoped token change things and counts its usage', async () => {
    const register = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'writescope@example.com', password: 'supersecret1' })
      .expect(201);
    const cookie = sessionCookie(register);

    const create = await request(app.getHttpServer())
      .post('/auth/tokens')
      .set('Cookie', cookie)
      .send({ name: 'deploy', scope: 'write', expiresInDays: 30 })
      .expect(201);
    const created = create.body as ApiTokenCreated;
    expect(created.scope).toBe('write');
    expect(created.expiresAt).not.toBeNull();

    await request(app.getHttpServer())
      .delete('/apps/missing')
      .set('Authorization', `Bearer ${created.token}`)
      .expect(404);

    const list = await request(app.getHttpServer())
      .get('/auth/tokens')
      .set('Cookie', cookie)
      .expect(200);
    const [item] = list.body as ApiTokenItem[];
    expect(item.usageCount).toBe(1);
    expect(item.expired).toBe(false);
  });

  it('stops accepting a token once it has expired', async () => {
    const register = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'expiring@example.com', password: 'supersecret1' })
      .expect(201);
    const cookie = sessionCookie(register);

    const create = await request(app.getHttpServer())
      .post('/auth/tokens')
      .set('Cookie', cookie)
      .send({ name: 'short lived', expiresInDays: 1 })
      .expect(201);
    const created = create.body as ApiTokenCreated;

    await prisma.apiToken.update({
      where: { id: created.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await request(app.getHttpServer())
      .get('/apps')
      .set('Authorization', `Bearer ${created.token}`)
      .expect(401);

    const list = await request(app.getHttpServer())
      .get('/auth/tokens')
      .set('Cookie', cookie)
      .expect(200);
    expect((list.body as ApiTokenItem[])[0].expired).toBe(true);
  });

  it('refuses an expiry beyond a year', async () => {
    const register = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'forever@example.com', password: 'supersecret1' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/tokens')
      .set('Cookie', sessionCookie(register))
      .send({ name: 'too long', expiresInDays: 400 })
      .expect(400);
  });

  it('reports whether first-run setup is required', async () => {
    const before = await request(app.getHttpServer())
      .get('/auth/status')
      .expect(200);
    expect(before.body).toEqual({
      billing: false,
      registrationOpen: true,
      setupRequired: true,
      authenticated: false,
    });

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'owner@example.com', password: 'supersecret1' })
      .expect(201);

    const after = await request(app.getHttpServer())
      .get('/auth/status')
      .expect(200);
    expect(after.body).toEqual({
      billing: false,
      registrationOpen: false,
      setupRequired: false,
      authenticated: false,
    });
  });

  it('throttles repeated login attempts', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'hammer@example.com', password: 'supersecret1' })
      .expect(201);

    let last = 200;
    for (let i = 0; i < 12; i += 1) {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'hammer@example.com', password: 'supersecret1' });
      last = res.status;
    }
    expect(last).toBe(429);
  });
});
