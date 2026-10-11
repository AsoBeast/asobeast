import './helpers/enable-public-url';
import { execSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { EmailAlertItem, WebhookTestResult } from '@asobeast/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { AccountMail, MailerService } from '../src/alerts/mailer.service';
import { confirmationToken } from '../src/alerts/confirmation-token';
import { unsubscribeToken } from '../src/alerts/unsubscribe-token';
import { AppModule } from '../src/app.module';
import { DEFAULT_WORKSPACE_ID } from '../src/common/tenancy/default-workspace';
import { TEST_AUTH_SECRET } from './helpers/auth-env';
import { TEST_WEB_PUBLIC_URL } from './helpers/enable-public-url';
import { OWNER, ownerAgent, useCookies } from './helpers/session';
import {
  clearRateLimitCounters,
  obliterateQueues,
  settleBootRegistration,
} from './obliterate-queues';
import { testDb } from './helpers/test-db';

const STRANGER = 'stranger@example.net';
const TOKEN_IN_LINK =
  /\/confirm-alert\?alert=([^&\s]+)&token=([A-Za-z0-9_-]{43})/;

function migrate(): void {
  execSync('pnpm prisma migrate deploy', {
    cwd: join(__dirname, '..'),
    env: process.env,
    stdio: 'ignore',
  });
}

describe('Email alert recipient confirmation (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let api: Awaited<ReturnType<typeof ownerAgent>>;
  const send = jest.fn().mockResolvedValue(undefined);
  const sendAccountMail = jest.fn().mockResolvedValue(undefined);

  beforeAll(async () => {
    migrate();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailerService)
      .useValue({
        enabled: true,
        origin: TEST_WEB_PUBLIC_URL,
        send,
        sendAccountMail,
      })
      .compile();

    app = moduleFixture.createNestApplication();
    useCookies(app);
    await app.init();
    await settleBootRegistration(app);
    prisma = testDb();
    await prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: {},
      create: { id: DEFAULT_WORKSPACE_ID, name: 'Default' },
    });
    api = await ownerAgent(app);
  });

  beforeEach(async () => {
    send.mockClear();
    sendAccountMail.mockClear();
    await clearRateLimitCounters(app);
    await prisma.user.updateMany({ data: { emailVerifiedAt: null } });
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "EmailAlert", "AlertDelivery" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await obliterateQueues(app);
    await app.close();
  });

  const addAlert = async (email: string): Promise<EmailAlertItem> => {
    const created = await api
      .post('/email-alerts')
      .send({ email, events: ['metadata.changed'] })
      .expect(201);
    return created.body as EmailAlertItem;
  };

  const sentConfirmation = (): AccountMail => {
    expect(sendAccountMail).toHaveBeenCalledTimes(1);
    return (sendAccountMail.mock.calls[0] as [AccountMail])[0];
  };

  const tokenOf = (mail: AccountMail): string => {
    const match = TOKEN_IN_LINK.exec(mail.text);
    if (!match) throw new Error('the confirmation mail carries no link');
    return match[2];
  };

  const confirm = (alert: EmailAlertItem, token: string) =>
    request(app.getHttpServer())
      .post(`/email-alerts/${alert.id}/confirm`)
      .query({ token });

  const sendTest = async (alert: EmailAlertItem): Promise<WebhookTestResult> =>
    (await api.post(`/email-alerts/${alert.id}/test`).expect(201))
      .body as WebhookTestResult;

  it('does not send a test email to an address nobody confirmed', async () => {
    const alert = await addAlert(STRANGER);

    expect(await sendTest(alert)).toEqual({ delivered: false, status: null });
    expect(send).not.toHaveBeenCalled();
  });

  it('asks the recipient to confirm with a link to the web app', async () => {
    const alert = await addAlert(STRANGER);

    const mail = sentConfirmation();
    expect(mail.kind).toBe('alert-confirmation');
    expect(mail.to).toBe(STRANGER);
    expect(mail.text).toContain(OWNER.email);
    expect(mail.text).toContain(
      `${TEST_WEB_PUBLIC_URL}/confirm-alert?alert=${alert.id}&token=`,
    );
    expect(alert.confirmed).toBe(false);
  });

  it('delivers to the recipient once they follow the link', async () => {
    const alert = await addAlert(STRANGER);

    await confirm(alert, tokenOf(sentConfirmation())).expect(204);

    const listed = await api.get('/email-alerts').expect(200);
    expect((listed.body as EmailAlertItem[])[0].confirmed).toBe(true);
    expect(await sendTest(alert)).toEqual({ delivered: true, status: null });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('confirms again without error when the link is opened twice', async () => {
    const alert = await addAlert(STRANGER);
    const token = tokenOf(sentConfirmation());

    await confirm(alert, token).expect(204);
    await confirm(alert, token).expect(204);
  });

  it('refuses a token minted for another alert', async () => {
    const stranger = await addAlert(STRANGER);
    await addAlert('other@example.net');
    const otherToken = tokenOf(
      (sendAccountMail.mock.calls[1] as [AccountMail])[0],
    );

    await confirm(stranger, otherToken).expect(404);

    const stored = await prisma.emailAlert.findUniqueOrThrow({
      where: { id: stranger.id },
    });
    expect(stored.confirmedAt).toBeNull();
  });

  it('asks the new address to confirm when the address changes', async () => {
    const alert = await addAlert(STRANGER);
    const staleToken = tokenOf(sentConfirmation());
    await confirm(alert, staleToken).expect(204);
    sendAccountMail.mockClear();

    const patched = await api
      .patch(`/email-alerts/${alert.id}`)
      .send({ email: 'new@example.net' })
      .expect(200);

    expect((patched.body as EmailAlertItem).confirmed).toBe(false);
    expect(sentConfirmation().to).toBe('new@example.net');
    expect(await sendTest(alert)).toEqual({ delivered: false, status: null });
    await confirm(alert, staleToken).expect(404);
  });

  it('keeps the confirmation when only the events change', async () => {
    const alert = await addAlert(STRANGER);
    await confirm(alert, tokenOf(sentConfirmation())).expect(204);
    sendAccountMail.mockClear();

    const patched = await api
      .patch(`/email-alerts/${alert.id}`)
      .send({ events: ['rank.dropped'] })
      .expect(200);

    expect((patched.body as EmailAlertItem).confirmed).toBe(true);
    expect(sendAccountMail).not.toHaveBeenCalled();
  });

  it('trusts the verified address of a member of the workspace', async () => {
    await prisma.user.updateMany({
      where: { email: OWNER.email },
      data: { emailVerifiedAt: new Date() },
    });

    const alert = await addAlert(OWNER.email.toUpperCase());

    expect(alert.confirmed).toBe(true);
    expect(sendAccountMail).not.toHaveBeenCalled();
    expect(await sendTest(alert)).toEqual({ delivered: true, status: null });
  });

  it('does not trust the unverified address of a member', async () => {
    const alert = await addAlert(OWNER.email);

    expect(alert.confirmed).toBe(false);
    expect(sendAccountMail).toHaveBeenCalledTimes(1);
  });

  it('sends the confirmation again on request, once the first one is not enough', async () => {
    const alert = await addAlert(STRANGER);
    sendAccountMail.mockClear();

    await api.post(`/email-alerts/${alert.id}/resend-confirmation`).expect(204);

    expect(sentConfirmation().to).toBe(STRANGER);
  });

  it('does not resend to a recipient who already confirmed', async () => {
    const alert = await addAlert(STRANGER);
    await confirm(alert, tokenOf(sentConfirmation())).expect(204);
    sendAccountMail.mockClear();

    await api.post(`/email-alerts/${alert.id}/resend-confirmation`).expect(409);

    expect(sendAccountMail).not.toHaveBeenCalled();
  });

  it('takes the confirmation back when the recipient unsubscribes', async () => {
    const alert = await addAlert(STRANGER);
    await confirm(alert, tokenOf(sentConfirmation())).expect(204);

    await request(app.getHttpServer())
      .post(`/email-alerts/${alert.id}/unsubscribe`)
      .query({
        token: unsubscribeToken(TEST_AUTH_SECRET, {
          alertId: alert.id,
          email: STRANGER,
        }),
      })
      .expect(204);
    await api
      .patch(`/email-alerts/${alert.id}`)
      .send({ active: true })
      .expect(200);

    expect(await sendTest(alert)).toEqual({ delivered: false, status: null });
    expect(send).not.toHaveBeenCalled();
  });

  it('answers gone for a link older than a week', async () => {
    const alert = await addAlert(STRANGER);
    const sentAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    await prisma.emailAlert.update({
      where: { id: alert.id },
      data: { confirmationSentAt: sentAt },
    });

    await confirm(
      alert,
      confirmationToken(TEST_AUTH_SECRET, {
        alertId: alert.id,
        email: STRANGER,
        sentAt,
      }),
    ).expect(410);
  });
});
