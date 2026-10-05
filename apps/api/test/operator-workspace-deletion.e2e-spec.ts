import './helpers/enable-open-registration';
import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication, Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import type { AuthUser, WorkspaceDeletionStatus } from '@asobeast/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AccountDeletionService } from '../src/account/account-deletion.service';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { restoreAuthEnv } from './helpers/auth-env';
import { testDb } from './helpers/test-db';
import {
  clearRateLimitCounters,
  obliterateQueues,
  pauseQueues,
} from './obliterate-queues';

const OPERATOR = { email: 'operator@example.com', password: 'supersecret1' };
const TENANT = { email: 'tenant@example.com', password: 'supersecret2' };
const MEMBER = { email: 'member@example.com', password: 'supersecret3' };
const LATER = { email: 'later@example.com', password: 'supersecret4' };

const REFUSED =
  'This workspace holds the platform operator, so it cannot be deleted while other accounts exist. Deleting it would leave the instance without an operator.';

function sessionCookie(res: request.Response): string {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = raw?.find((entry) => entry.startsWith('asobeast_session='));
  if (!cookie) throw new Error('no session cookie set');
  return cookie.split(';')[0];
}

describe('Deleting the operator workspace (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let deletion: AccountDeletionService;

  beforeAll(async () => {
    execSync('pnpm prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'ignore',
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    await app.init();
    await pauseQueues(app);

    deletion = app.get(AccountDeletionService);
    prisma = testDb();
  });

  afterAll(async () => {
    await resetAccounts();
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
    restoreAuthEnv();
  });

  beforeEach(async () => {
    await clearRateLimitCounters(app);
    await resetAccounts();
  });

  async function resetAccounts(): Promise<void> {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "App" CASCADE');
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "User" RESTART IDENTITY CASCADE',
    );
    await prisma.workspace.deleteMany({
      where: { id: { not: DEFAULT_WORKSPACE_ID } },
    });
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: {
        deletionRequestedAt: null,
        deletionRequestedBy: null,
        deletionDueAt: null,
        erasureClaimedAt: null,
      },
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
  }

  const register = async (account: typeof OPERATOR): Promise<string> => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send(account)
      .expect(201);
    return sessionCookie(res);
  };

  const me = async (cookie: string): Promise<AuthUser> => {
    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', cookie)
      .expect(200);
    return res.body as AuthUser;
  };

  const schedule = (cookie: string) =>
    request(app.getHttpServer())
      .post('/account/deletion')
      .set('Cookie', cookie)
      .send({ confirm: 'DELETE' });

  const statusOf = async (cookie: string): Promise<WorkspaceDeletionStatus> => {
    const res = await request(app.getHttpServer())
      .get('/account/deletion')
      .set('Cookie', cookie)
      .expect(200);
    return res.body as WorkspaceDeletionStatus;
  };

  const makeDue = (workspaceId: string) =>
    prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        deletionRequestedAt: new Date(Date.now() - 8 * 86_400_000),
        deletionRequestedBy: OPERATOR.email,
        deletionDueAt: new Date(Date.now() - 1_000),
      },
    });

  const operatorWorkspaceCount = () =>
    prisma.workspace.count({ where: { id: DEFAULT_WORKSPACE_ID } });

  it('refuses to schedule the operator workspace while another account exists', async () => {
    const operator = await register(OPERATOR);
    await register(TENANT);

    const res = await schedule(operator).expect(409);

    expect((res.body as { message: string }).message).toBe(REFUSED);
    await expect(statusOf(operator)).resolves.toMatchObject({
      scheduled: false,
    });
  });

  it('answers a member of the operator workspace with the owner refusal first', async () => {
    const operator = await register(OPERATOR);
    await register(TENANT);
    const invited = await request(app.getHttpServer())
      .post('/workspace/invites')
      .set('Cookie', operator)
      .send({ email: MEMBER.email })
      .expect(201);
    const token = new URLSearchParams(
      (invited.body as { acceptPath: string }).acceptPath.split('?')[1],
    ).get('token');
    const accepted = await request(app.getHttpServer())
      .post('/workspace/invites/accept')
      .send({ token, password: MEMBER.password })
      .expect(201);

    await schedule(sessionCookie(accepted)).expect(403);
  });

  it('still lets a tenant owner schedule and cancel their own deletion', async () => {
    await register(OPERATOR);
    const tenant = await register(TENANT);

    await schedule(tenant).expect(201);
    await expect(statusOf(tenant)).resolves.toMatchObject({ scheduled: true });
    await request(app.getHttpServer())
      .delete('/account/deletion')
      .set('Cookie', tenant)
      .expect(200);
    await expect(statusOf(tenant)).resolves.toMatchObject({
      scheduled: false,
    });
  });

  it('keeps the operator when a deletion scheduled earlier comes due', async () => {
    const operator = await register(OPERATOR);
    await register(TENANT);
    const logged = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    await makeDue(DEFAULT_WORKSPACE_ID);

    await expect(deletion.eraseDue()).resolves.toEqual([]);

    expect(logged).toHaveBeenCalledWith(
      expect.stringContaining(`workspace ${DEFAULT_WORKSPACE_ID}`),
    );
    logged.mockRestore();
    await expect(operatorWorkspaceCount()).resolves.toBe(1);
    await expect(me(operator)).resolves.toMatchObject({
      platformOperator: true,
    });
    await expect(statusOf(operator)).resolves.toMatchObject({
      scheduled: false,
    });
  });

  it('refuses at erasure when an account registered during the grace period', async () => {
    const operator = await register(OPERATOR);
    await schedule(operator).expect(201);
    await register(TENANT);
    await makeDue(DEFAULT_WORKSPACE_ID);

    await expect(deletion.eraseDue()).resolves.toEqual([]);

    await expect(operatorWorkspaceCount()).resolves.toBe(1);
    await expect(statusOf(operator)).resolves.toMatchObject({
      scheduled: false,
    });
  });

  it('still erases the operator workspace of an instance with no other account', async () => {
    const operator = await register(OPERATOR);
    await schedule(operator).expect(201);
    await makeDue(DEFAULT_WORKSPACE_ID);

    await expect(deletion.eraseDue()).resolves.toEqual([DEFAULT_WORKSPACE_ID]);

    await expect(prisma.user.count()).resolves.toBe(0);
    const later = await register(LATER);
    await expect(me(later)).resolves.toMatchObject({
      role: 'owner',
      platformOperator: true,
    });
  });

  it('counts members of the operator workspace as erased with it', async () => {
    const operator = await register(OPERATOR);
    const invited = await request(app.getHttpServer())
      .post('/workspace/invites')
      .set('Cookie', operator)
      .send({ email: MEMBER.email })
      .expect(201);
    const token = new URLSearchParams(
      (invited.body as { acceptPath: string }).acceptPath.split('?')[1],
    ).get('token');
    await request(app.getHttpServer())
      .post('/workspace/invites/accept')
      .send({ token, password: MEMBER.password })
      .expect(201);

    await schedule(operator).expect(201);
    await makeDue(DEFAULT_WORKSPACE_ID);

    await expect(deletion.eraseDue()).resolves.toEqual([DEFAULT_WORKSPACE_ID]);
    await expect(prisma.user.count()).resolves.toBe(0);
  });
});
