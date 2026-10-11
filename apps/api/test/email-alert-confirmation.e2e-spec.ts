import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  ApiErrorEnvelope,
  EmailAlertItem,
  WebhookTestResult,
} from '@asobeast/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { AccountMail } from '../src/alerts/mailer.service';
import {
  CONFIRMATION_DAYS,
  confirmationToken,
} from '../src/alerts/confirmation-token';
import { CONFIRMATION_RESEND_COOLDOWN_SECONDS } from '../src/alerts/email-alerts.service';
import { unsubscribeToken } from '../src/alerts/unsubscribe-token';
import { TEST_AUTH_SECRET } from './helpers/auth-env';
import { EmailAlertApp, startEmailAlertApp } from './helpers/email-alert-app';
import { TEST_WEB_PUBLIC_URL } from './helpers/enable-public-url';
import { OWNER } from './helpers/session';

const STRANGER = 'stranger@example.net';
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const TOKEN_IN_LINK =
  /\/confirm-alert\?alert=([^&\s]+)&token=([A-Za-z0-9_-]{43})/;

describe('Email alert recipient confirmation (e2e)', () => {
  let fixture: EmailAlertApp;
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let api: EmailAlertApp['api'];
  let send: jest.Mock;
  let sendAccountMail: jest.Mock;

  beforeAll(async () => {
    fixture = await startEmailAlertApp();
    ({ app, prisma, api, send, sendAccountMail } = fixture);
  });

  beforeEach(() => fixture.reset());

  afterAll(() => fixture.close());

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

  const unsubscribe = (alert: EmailAlertItem, email = STRANGER) =>
    request(app.getHttpServer())
      .post(`/email-alerts/${alert.id}/unsubscribe`)
      .query({
        token: unsubscribeToken(TEST_AUTH_SECRET, { alertId: alert.id, email }),
      })
      .expect(204);

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

  it('says the confirmation email went out', async () => {
    const alert = await addAlert(STRANGER);

    expect(alert.confirmationSent).toBe(true);
  });

  it('says when the confirmation email could not be sent', async () => {
    sendAccountMail.mockRejectedValueOnce(new Error('relay refused'));

    const alert = await addAlert(STRANGER);

    expect(alert.confirmed).toBe(false);
    expect(alert.confirmationSent).toBe(false);
  });

  it('says whether the new address was asked to confirm', async () => {
    const alert = await addAlert(STRANGER);
    sendAccountMail.mockRejectedValueOnce(new Error('relay refused'));

    const patched = await api
      .patch(`/email-alerts/${alert.id}`)
      .send({ email: 'new@example.net' })
      .expect(200);

    expect((patched.body as EmailAlertItem).confirmationSent).toBe(false);
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

  it('keeps the confirmation and unsubscribe links to their own purpose', async () => {
    const alert = await addAlert(STRANGER);
    const confirmationLink = tokenOf(sentConfirmation());

    await confirm(
      alert,
      unsubscribeToken(TEST_AUTH_SECRET, {
        alertId: alert.id,
        email: STRANGER,
      }),
    ).expect(404);
    await request(app.getHttpServer())
      .post(`/email-alerts/${alert.id}/unsubscribe`)
      .query({ token: confirmationLink })
      .expect(404);

    const stored = await prisma.emailAlert.findUniqueOrThrow({
      where: { id: alert.id },
    });
    expect(stored.confirmedAt).toBeNull();
    expect(stored.active).toBe(true);
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

  const sentHoursAgo = (alert: EmailAlertItem, hours: number) =>
    prisma.emailAlert.update({
      where: { id: alert.id },
      data: { confirmationSentAt: new Date(Date.now() - hours * HOUR_MS) },
    });

  it('sends the confirmation again on request', async () => {
    const alert = await addAlert(STRANGER);
    await sentHoursAgo(alert, 2);
    sendAccountMail.mockClear();

    await api.post(`/email-alerts/${alert.id}/resend-confirmation`).expect(204);

    expect(sentConfirmation().to).toBe(STRANGER);
  });

  it('waits an hour before sending the confirmation again', async () => {
    const alert = await addAlert(STRANGER);
    sendAccountMail.mockClear();

    const refused = await api
      .post(`/email-alerts/${alert.id}/resend-confirmation`)
      .expect(429);

    const retryAfter = Number(refused.headers['retry-after']);
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(
      CONFIRMATION_RESEND_COOLDOWN_SECONDS,
    );
    expect(sendAccountMail).not.toHaveBeenCalled();
  });

  it('sends one confirmation when two resends race each other', async () => {
    const alert = await addAlert(STRANGER);
    await sentHoursAgo(alert, 2);
    sendAccountMail.mockClear();

    const answers = await Promise.all(
      [0, 1, 2, 3, 4].map(() =>
        api.post(`/email-alerts/${alert.id}/resend-confirmation`),
      ),
    );

    expect(answers.map(({ status }) => status).sort()).toEqual([
      204, 429, 429, 429, 429,
    ]);
    expect(sendAccountMail).toHaveBeenCalledTimes(1);
  });

  it('resends at once when the first confirmation never left', async () => {
    sendAccountMail.mockRejectedValueOnce(new Error('relay refused'));
    const alert = await addAlert(STRANGER);

    await api.post(`/email-alerts/${alert.id}/resend-confirmation`).expect(204);
  });

  it('keeps the earlier link working when a resend cannot be sent', async () => {
    const alert = await addAlert(STRANGER);
    const sentAt = new Date(Date.now() - 2 * HOUR_MS);
    await prisma.emailAlert.update({
      where: { id: alert.id },
      data: { confirmationSentAt: sentAt },
    });
    sendAccountMail.mockRejectedValueOnce(new Error('relay refused'));

    await api.post(`/email-alerts/${alert.id}/resend-confirmation`).expect(503);

    await confirm(
      alert,
      confirmationToken(TEST_AUTH_SECRET, {
        alertId: alert.id,
        email: STRANGER,
        sentAt,
      }),
    ).expect(204);
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

    await unsubscribe(alert);
    await api
      .patch(`/email-alerts/${alert.id}`)
      .send({ active: true })
      .expect(200);

    expect(await sendTest(alert)).toEqual({ delivered: false, status: null });
    expect(send).not.toHaveBeenCalled();
  });

  it('does not resend a confirmation to a recipient who unsubscribed', async () => {
    const alert = await addAlert(STRANGER);
    await confirm(alert, tokenOf(sentConfirmation())).expect(204);
    await unsubscribe(alert);
    sendAccountMail.mockClear();

    const refused = await api
      .post(`/email-alerts/${alert.id}/resend-confirmation`)
      .expect(409);

    expect((refused.body as ApiErrorEnvelope).message).toContain(
      'unsubscribed',
    );
    expect(sendAccountMail).not.toHaveBeenCalled();
  });

  it('asks a new address to confirm after the old one unsubscribed', async () => {
    const alert = await addAlert(STRANGER);
    await unsubscribe(alert);
    sendAccountMail.mockClear();

    const patched = await api
      .patch(`/email-alerts/${alert.id}`)
      .send({ email: 'new@example.net' })
      .expect(200);

    expect((patched.body as EmailAlertItem).confirmationSent).toBe(true);
    expect(sentConfirmation().to).toBe('new@example.net');
  });

  it('answers gone for a link older than a week', async () => {
    const alert = await addAlert(STRANGER);
    const sentAt = new Date(Date.now() - (CONFIRMATION_DAYS + 1) * DAY_MS);
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
