import './helpers/enable-billing';
import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { INVITE_PATH, WorkspaceInviteCreated } from '@asobeast/shared';
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

const PASSWORD = 'supersecret1';
const OWNER = 'owner@example.com';
const VICTIM = 'ceo@victim.example';
const TOKEN_SHAPE = /[0-9a-f]{48}/g;

function sessionCookie(res: request.Response): string {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = raw?.find((entry) => entry.startsWith('asobeast_session='));
  if (!cookie) throw new Error('no session cookie set');
  return cookie.split(';')[0];
}

describe('Who receives an invitation link', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let sent: SentMail[];
  let mailEnabled = true;
  let refuseDelivery = false;
  let ownerCookie: string;

  const invite = (email: string) =>
    request(app.getHttpServer())
      .post('/workspace/invites')
      .set('Cookie', ownerCookie)
      .send({ email });

  const accept = (token: string) =>
    request(app.getHttpServer())
      .post('/workspace/invites/accept')
      .send({ token, password: 'attackerchosen1' });

  const tokensIn = (body: unknown): string[] =>
    JSON.stringify(body).match(TOKEN_SHAPE) ?? [];

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
    mailEnabled = true;
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
        plan: 'indie',
        subscriptionId: 'sub_paid',
        subscriptionStatus: 'active',
        billingCustomerId: 'cus_paid',
        planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    const owner = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: OWNER, password: PASSWORD })
      .expect(201);
    ownerCookie = sessionCookie(owner);
    sent.length = 0;
  });

  afterAll(async () => {
    await prisma.workspace.update({
      where: { id: DEFAULT_WORKSPACE_ID },
      data: {
        plan: 'free',
        subscriptionId: null,
        subscriptionStatus: null,
        billingCustomerId: null,
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

  it('leaves the invited address free for its real owner when the mail went out', async () => {
    const invited = await invite(VICTIM).expect(201);

    for (const token of tokensIn(invited.body)) await accept(token);

    await expect(prisma.user.count({ where: { email: VICTIM } })).resolves.toBe(
      0,
    );
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: VICTIM, password: PASSWORD })
      .expect(201);
  });

  it('answers the inviter with the bare invitation page once the mail went out', async () => {
    const invited = await invite(VICTIM).expect(201);

    expect(invited.body).toMatchObject({ email: VICTIM, delivered: true });
    expect((invited.body as WorkspaceInviteCreated).acceptPath).toBe(
      INVITE_PATH,
    );
    expect(tokensIn(invited.body)).toEqual([]);
  });

  it('sends the token only to the invited address, and it accepts there', async () => {
    await invite(VICTIM).expect(201);

    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(VICTIM);
    await accept(tokenFrom(sent[0])).expect(201);
  });

  it('keeps the link from an inviter when the mail could not be sent and anyone may register', async () => {
    refuseDelivery = true;

    const invited = await invite(VICTIM).expect(201);

    expect(invited.body).toMatchObject({ delivered: false });
    expect(tokensIn(invited.body)).toEqual([]);
  });

  it('lets the inviter send a new mail after a failure', async () => {
    refuseDelivery = true;
    await invite(VICTIM).expect(201);
    refuseDelivery = false;

    await invite(VICTIM).expect(201);

    expect(sent).toHaveLength(1);
    await accept(tokenFrom(sent[0])).expect(201);
  });

  it('still hands the link to the inviter when this instance cannot send mail', async () => {
    mailEnabled = false;

    const invited = await invite(VICTIM).expect(201);

    expect(invited.body).toMatchObject({ delivered: false });
    const [token] = tokensIn(invited.body);
    await accept(token).expect(201);
  });
});
