import './helpers/enable-billing';
import { execSync } from 'child_process';
import { createHash } from 'crypto';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { AuthUser } from '@asobeast/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { MailerService } from '../src/alerts/mailer.service';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { restoreAuthEnv } from './helpers/auth-env';
import { testDb } from './helpers/test-db';
import {
  clearRateLimitCounters,
  obliterateQueues,
  pauseQueues,
} from './obliterate-queues';

interface SentMail {
  to: string;
  subject: string;
  text: string;
}

function sessionCookie(res: request.Response): string {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = raw?.find((entry) => entry.startsWith('asobeast_session='));
  if (!cookie) throw new Error('no session cookie set');
  return cookie.split(';')[0];
}

describe('Email verification before the trial starts', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let sent: SentMail[];
  let refuseDelivery = false;

  const register = (email: string) =>
    request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'supersecret1' });

  const tokenFrom = (mail: SentMail): string =>
    new URLSearchParams(mail.text.split('?')[1]).get('token') ?? '';

  beforeAll(async () => {
    execSync('pnpm prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'ignore',
    });

    sent = [];
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailerService)
      .useValue({
        enabled: true,
        sendAccountMail: ({ to, subject, text }: SentMail) => {
          if (refuseDelivery) {
            return Promise.reject(new Error('smtp is unreachable'));
          }
          sent.push({ to, subject, text });
          return Promise.resolve();
        },
      })
      .compile();
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
  }, 60_000);

  beforeEach(async () => {
    await clearRateLimitCounters(app);
    sent.length = 0;
    refuseDelivery = false;
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "User" RESTART IDENTITY CASCADE',
    );
    await prisma.workspace.deleteMany({
      where: { id: { not: DEFAULT_WORKSPACE_ID } },
    });
    await prisma.workspace.update({
      where: { id: DEFAULT_WORKSPACE_ID },
      data: {
        plan: 'free',
        trialStartedAt: null,
        trialEndsAt: null,
        planExpiresAt: null,
      },
    });
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

  it('withholds the trial until the address is confirmed', async () => {
    const created = await register('owner@example.com').expect(201);
    const account = created.body as AuthUser;

    expect(account.emailVerified).toBe(false);
    expect(account.entitled).toBe(false);
    expect(account.trialEndsAt).toBeNull();

    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { id: DEFAULT_WORKSPACE_ID },
    });
    expect(workspace.trialStartedAt).toBeNull();
  });

  it('emails a confirmation link to the address that registered', async () => {
    await register('owner@example.com').expect(201);

    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('owner@example.com');
    expect(tokenFrom(sent[0])).toHaveLength(48);
  });

  it('stores only a hash of the confirmation token', async () => {
    await register('owner@example.com').expect(201);
    const token = tokenFrom(sent[0]);

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: 'owner@example.com' },
      select: { verificationHash: true },
    });
    expect(user.verificationHash).toBe(
      createHash('sha256').update(token).digest('hex'),
    );
  });

  it('starts the trial the moment the address is confirmed', async () => {
    await register('owner@example.com').expect(201);

    const confirmed = await request(app.getHttpServer())
      .post('/auth/verify')
      .send({ token: tokenFrom(sent[0]) })
      .expect(200);
    const account = confirmed.body as AuthUser;

    expect(account.emailVerified).toBe(true);
    expect(account.entitled).toBe(true);
    expect(account.plan).toBe('trial');

    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { id: DEFAULT_WORKSPACE_ID },
    });
    expect(workspace.trialStartedAt).not.toBeNull();
  });

  it('spends the confirmation token exactly once', async () => {
    await register('owner@example.com').expect(201);
    const token = tokenFrom(sent[0]);

    await request(app.getHttpServer())
      .post('/auth/verify')
      .send({ token })
      .expect(200);
    await request(app.getHttpServer())
      .post('/auth/verify')
      .send({ token })
      .expect(404);
  });

  it('refuses a link past its expiry', async () => {
    await register('owner@example.com').expect(201);
    await prisma.user.update({
      where: { email: 'owner@example.com' },
      data: { verificationExpiresAt: new Date(Date.now() - 1000) },
    });

    await request(app.getHttpServer())
      .post('/auth/verify')
      .send({ token: tokenFrom(sent[0]) })
      .expect(410);
  });

  it('refuses to swap the session of someone already signed in', async () => {
    await register('owner@example.com').expect(201);
    const ownerToken = tokenFrom(sent[0]);

    sent.length = 0;
    const tenant = await register('tenant@example.com').expect(201);
    const tenantCookie = (
      tenant.headers['set-cookie'] as unknown as string[]
    )[0].split(';')[0];

    await request(app.getHttpServer())
      .post('/auth/verify')
      .set('Cookie', tenantCookie)
      .send({ token: ownerToken })
      .expect(409);

    const owner = await prisma.user.findUniqueOrThrow({
      where: { email: 'owner@example.com' },
      include: { workspace: true },
    });
    expect(owner.emailVerifiedAt).toBeNull();
    expect(owner.verificationHash).not.toBeNull();
    expect(owner.workspace.trialStartedAt).toBeNull();

    await request(app.getHttpServer())
      .post('/auth/verify')
      .send({ token: ownerToken })
      .expect(200);
  });

  it('keeps the account when the confirmation email cannot be sent', async () => {
    refuseDelivery = true;

    const registered = await register('stranded@example.com').expect(201);
    expect(sent).toHaveLength(0);

    refuseDelivery = false;
    await request(app.getHttpServer())
      .post('/auth/verify/resend')
      .set('Cookie', sessionCookie(registered))
      .expect(204);

    expect(sent).toHaveLength(1);
    await request(app.getHttpServer())
      .post('/auth/verify')
      .send({ token: tokenFrom(sent[0]) })
      .expect(200);
  });

  it('retires the previous link when a new one is sent', async () => {
    const registered = await register('owner@example.com').expect(201);
    const first = tokenFrom(sent[0]);

    await request(app.getHttpServer())
      .post('/auth/verify/resend')
      .set('Cookie', sessionCookie(registered))
      .expect(204);

    expect(sent).toHaveLength(2);
    await request(app.getHttpServer())
      .post('/auth/verify')
      .send({ token: first })
      .expect(404);
    await request(app.getHttpServer())
      .post('/auth/verify')
      .send({ token: tokenFrom(sent[1]) })
      .expect(200);
  });

  it('reports a resend that could not be delivered', async () => {
    const registered = await register('owner@example.com').expect(201);
    refuseDelivery = true;

    await request(app.getHttpServer())
      .post('/auth/verify/resend')
      .set('Cookie', sessionCookie(registered))
      .expect(500);
  });

  it('refuses an anonymous resend', async () => {
    await request(app.getHttpServer()).post('/auth/verify/resend').expect(401);
  });

  it('refuses a token it never issued', async () => {
    await request(app.getHttpServer())
      .post('/auth/verify')
      .send({ token: 'a'.repeat(48) })
      .expect(404);
  });

  it('never grants a second trial on a later confirmation', async () => {
    await register('owner@example.com').expect(201);
    await request(app.getHttpServer())
      .post('/auth/verify')
      .send({ token: tokenFrom(sent[0]) })
      .expect(200);
    const first = await prisma.workspace.findUniqueOrThrow({
      where: { id: DEFAULT_WORKSPACE_ID },
      select: { trialStartedAt: true },
    });

    sent.length = 0;
    const tenant = await register('tenant@example.com').expect(201);
    const tenantWorkspace = await prisma.user.findUniqueOrThrow({
      where: { id: (tenant.body as AuthUser).id },
      select: { workspaceId: true },
    });
    await request(app.getHttpServer())
      .post('/auth/verify')
      .send({ token: tokenFrom(sent[0]) })
      .expect(200);

    await expect(
      prisma.workspace.findUniqueOrThrow({
        where: { id: DEFAULT_WORKSPACE_ID },
        select: { trialStartedAt: true },
      }),
    ).resolves.toEqual(first);
    await expect(
      prisma.workspace.findUniqueOrThrow({
        where: { id: tenantWorkspace.workspaceId },
        select: { trialStartedAt: true },
      }),
    ).resolves.not.toEqual({ trialStartedAt: null });
  });
});
