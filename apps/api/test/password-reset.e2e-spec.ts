import './helpers/enable-billing';
import { execSync } from 'child_process';
import { createHash } from 'crypto';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { MailerService } from '../src/alerts/mailer.service';
import { AppModule } from '../src/app.module';
import { RECOVERY_REQUESTS_PER_HOUR } from '../src/auth/rate-limit/recovery-rate.limiter';
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

const PASSWORD = 'supersecret1';
const NEW_PASSWORD = 'brandnewsecret2';
const KNOWN = 'owner@example.com';
const UNKNOWN = 'stranger@example.com';

describe('Account recovery for a customer who forgot their password', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let sent: SentMail[];
  let mailEnabled = true;
  let mailLatencyMs = 0;

  const pause = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

  const delivered = async (count: number): Promise<void> => {
    const deadline = Date.now() + 5_000;
    while (sent.length < count && Date.now() < deadline) await pause(25);
    await pause(50);
    expect(sent).toHaveLength(count);
  };

  const timed = async (work: () => Promise<unknown>): Promise<number> => {
    const started = Date.now();
    await work();
    return Date.now() - started;
  };

  const register = (email: string) =>
    request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: PASSWORD });

  const forgot = (email: string) =>
    request(app.getHttpServer()).post('/auth/password/forgot').send({ email });

  const reset = (token: string, password = NEW_PASSWORD) =>
    request(app.getHttpServer())
      .post('/auth/password/reset')
      .send({ token, password });

  const signIn = (password: string) =>
    request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: KNOWN, password });

  const issuedToken = async (): Promise<string> => {
    const before = sent.length;
    await forgot(KNOWN).expect(204);
    await delivered(before + 1);
    return tokenFrom(sent[sent.length - 1]);
  };

  const tokenFrom = (mail: SentMail): string =>
    /token=([0-9a-f]+)/.exec(mail.text)?.[1] ?? '';

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
        get enabled() {
          return mailEnabled;
        },
        sendAccountMail: async ({ to, subject, text }: SentMail) => {
          if (mailLatencyMs > 0) await pause(mailLatencyMs);
          sent.push({ to, subject, text });
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
    mailEnabled = true;
    mailLatencyMs = 0;
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "User" RESTART IDENTITY CASCADE',
    );
    await prisma.workspace.deleteMany({
      where: { id: { not: DEFAULT_WORKSPACE_ID } },
    });
    await register(KNOWN).expect(201);
    sent.length = 0;
  });

  afterAll(async () => {
    await prisma.workspace.update({
      where: { id: DEFAULT_WORKSPACE_ID },
      data: {
        plan: 'free',
        trialStartedAt: null,
        trialEndsAt: null,
        planExpiresAt: null,
      },
    });
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "User" RESTART IDENTITY CASCADE',
    );
    await obliterateQueues(app);
    await app.close();
    restoreAuthEnv();
    await prisma.$disconnect();
  });

  it('answers an unknown address exactly as it answers a known one', async () => {
    const known = await forgot(KNOWN).expect(204);
    const unknown = await forgot(UNKNOWN).expect(204);

    expect(unknown.status).toBe(known.status);
    expect(unknown.text).toBe(known.text);
    expect(unknown.headers['content-type']).toBe(known.headers['content-type']);
  });

  it('emails a recovery link only to an address that has an account', async () => {
    await forgot(UNKNOWN).expect(204);
    await delivered(0);

    await forgot(KNOWN).expect(204);
    await delivered(1);
    expect(sent[0].to).toBe(KNOWN);
    expect(tokenFrom(sent[0])).toHaveLength(48);
  });

  it('finds the account whatever case the address was typed in', async () => {
    await forgot('Owner@Example.COM').expect(204);

    await delivered(1);
    expect(sent[0].to).toBe(KNOWN);
  });

  it('stores only a hash of the recovery token', async () => {
    await forgot(KNOWN).expect(204);
    await delivered(1);

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: KNOWN },
      select: { resetHash: true, resetExpiresAt: true },
    });
    expect(user.resetHash).toBe(
      createHash('sha256').update(tokenFrom(sent[0])).digest('hex'),
    );
    expect(user.resetExpiresAt).not.toBeNull();
  });

  it('stops emailing an account past its hourly allowance, without saying so', async () => {
    for (let attempt = 0; attempt < RECOVERY_REQUESTS_PER_HOUR; attempt += 1) {
      await forgot(KNOWN).expect(204);
    }
    await delivered(RECOVERY_REQUESTS_PER_HOUR);

    await forgot(KNOWN).expect(204);
    await delivered(RECOVERY_REQUESTS_PER_HOUR);
  });

  it('counts the allowance per account rather than across all of them', async () => {
    for (let attempt = 0; attempt < RECOVERY_REQUESTS_PER_HOUR; attempt += 1) {
      await forgot(KNOWN).expect(204);
    }
    await delivered(RECOVERY_REQUESTS_PER_HOUR);

    await register('second@example.com').expect(201);
    sent.length = 0;
    await forgot('second@example.com').expect(204);

    await delivered(1);
  });

  it('refuses the request when the instance has no mail transport', async () => {
    mailEnabled = false;

    const refused = await forgot(KNOWN).expect(503);

    expect((refused.body as { message: string }).message).toContain(
      'email transport',
    );
    await delivered(0);
  });

  it('recovers an account whose entitlement has lapsed', async () => {
    await prisma.workspace.update({
      where: { id: DEFAULT_WORKSPACE_ID },
      data: {
        plan: 'free',
        trialEndsAt: new Date(Date.now() - 1000),
        planExpiresAt: new Date(Date.now() - 1000),
      },
    });

    await forgot(KNOWN).expect(204);
    await delivered(1);
  });

  it('refuses a body that is not an email address', async () => {
    await forgot('not-an-address').expect(400);
    await delivered(0);
  });

  it('answers a known address as quickly as an unknown one, whatever the relay costs', async () => {
    mailLatencyMs = 1_500;

    const known = await timed(() => forgot(KNOWN).expect(204));
    await delivered(1);
    const unknown = await timed(() => forgot(UNKNOWN).expect(204));

    expect(known).toBeLessThan(mailLatencyMs / 2);
    expect(Math.abs(known - unknown)).toBeLessThan(mailLatencyMs / 2);
  });

  it('lets the new password sign the account in and retires the old one', async () => {
    await reset(await issuedToken()).expect(204);

    await signIn(NEW_PASSWORD).expect(200);
    await signIn(PASSWORD).expect(401);
  });

  it('spends the recovery token exactly once', async () => {
    const token = await issuedToken();

    await reset(token).expect(204);
    await reset(token, 'thirdsecret3').expect(404);
    await signIn(NEW_PASSWORD).expect(200);
  });

  it('lets exactly one of two simultaneous redemptions spend the token', async () => {
    const token = await issuedToken();
    const first = 'firstwinner11';
    const second = 'secondwinner2';

    const outcomes = await Promise.all([
      reset(token, first),
      reset(token, second),
    ]);

    const accepted = outcomes.filter((outcome) => outcome.status === 204);
    expect(accepted).toHaveLength(1);
    expect(outcomes.map((outcome) => outcome.status).sort()).toEqual([
      204, 404,
    ]);

    const winner = outcomes[0].status === 204 ? first : second;
    const loser = winner === first ? second : first;
    await signIn(winner).expect(200);
    await signIn(loser).expect(401);

    const account = await prisma.user.findUniqueOrThrow({
      where: { email: KNOWN },
      select: { sessionVersion: true },
    });
    expect(account.sessionVersion).toBe(1);
  });

  it('refuses a link past its expiry and leaves the password alone', async () => {
    const token = await issuedToken();
    await prisma.user.update({
      where: { email: KNOWN },
      data: { resetExpiresAt: new Date(Date.now() - 1000) },
    });

    await reset(token).expect(410);
    await signIn(PASSWORD).expect(200);
  });

  it('refuses a token it never issued', async () => {
    await reset('a'.repeat(48)).expect(404);
  });

  it('ends every session the account had open', async () => {
    const signedIn = await signIn(PASSWORD).expect(200);
    const cookie = (
      signedIn.headers['set-cookie'] as unknown as string[]
    )[0].split(';')[0];
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', cookie)
      .expect(200);

    await reset(await issuedToken()).expect(204);

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', cookie)
      .expect(401);
  });

  it('refuses a new password shorter than the account rules allow', async () => {
    const token = await issuedToken();

    await reset(token, 'short').expect(400);
    await signIn(PASSWORD).expect(200);
  });

  it('clears the token from the account once it is spent', async () => {
    await reset(await issuedToken()).expect(204);

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: KNOWN },
      select: { resetHash: true, resetExpiresAt: true },
    });
    expect(user.resetHash).toBeNull();
    expect(user.resetExpiresAt).toBeNull();
  });
});
