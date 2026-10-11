import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { ConfirmationMailLimiter } from './confirmation-mail.limiter';
import { confirmationToken } from './confirmation-token';
import { EmailAlertConfirmation } from './email-alert-confirmation.service';
import { MailerService } from './mailer.service';

const SECRET = 's'.repeat(32);
const ORIGIN = 'https://aso.example.com';

const build = (mailer: Partial<MailerService>) => {
  const updateMany = jest.fn().mockResolvedValue({ count: 1 });
  const findFirst = jest.fn().mockResolvedValue(null);
  const send = jest.fn().mockResolvedValue(undefined);
  const claim = jest.fn().mockResolvedValue(undefined);
  const service = new EmailAlertConfirmation(
    { get: jest.fn(() => SECRET) } as unknown as ConfigService<Env, true>,
    { sendAccountMail: send, ...mailer } as MailerService,
    {
      emailAlert: { updateMany },
      user: { findFirst },
    } as unknown as PrismaService,
    { claim } as unknown as ConfirmationMailLimiter,
    { require: jest.fn(() => 'ws_1') } as unknown as WorkspaceContext,
  );
  return { service, updateMany, findFirst, send, claim };
};

describe('EmailAlertConfirmation', () => {
  describe('canSend', () => {
    it.each([
      [true, ORIGIN, true],
      [true, null, false],
      [false, ORIGIN, false],
    ])(
      'with email enabled %s and origin %s it is %s',
      (enabled, origin, canSend) => {
        expect(build({ enabled, origin }).service.canSend).toBe(canSend);
      },
    );
  });

  describe('confirmationFor', () => {
    it('still waits for the recipient when the instance cannot send a link', async () => {
      const { service } = build({ enabled: true, origin: null });

      expect(await service.confirmationFor('a@example.net')).toBeNull();
    });

    it('confirms at once the verified address of a member', async () => {
      const { service, findFirst } = build({ enabled: true, origin: ORIGIN });
      findFirst.mockResolvedValue({ id: 'u_1' });

      expect(await service.confirmationFor('Ops@Example.com')).toBeInstanceOf(
        Date,
      );
      expect(findFirst).toHaveBeenCalledWith({
        where: {
          email: { equals: 'Ops@Example.com', mode: 'insensitive' },
          emailVerifiedAt: { not: null },
        },
        select: { id: true },
      });
    });

    it('waits for the recipient otherwise', async () => {
      const { service } = build({ enabled: true, origin: ORIGIN });

      expect(await service.confirmationFor('a@example.net')).toBeNull();
    });
  });

  describe('allowMailTo', () => {
    it('claims the allowance of the workspace in scope for the address', async () => {
      const { service, claim } = build({ enabled: true, origin: ORIGIN });

      await service.allowMailTo('a@example.net');

      expect(claim).toHaveBeenCalledWith('ws_1', 'a@example.net');
    });

    it('claims nothing when no link can be built', async () => {
      const { service, claim } = build({ enabled: true, origin: null });

      expect(await service.allowMailTo('a@example.net')).toBeNull();
      expect(claim).not.toHaveBeenCalled();
    });

    it('lets the refusal of the limiter through', async () => {
      const { service, claim } = build({ enabled: true, origin: ORIGIN });
      claim.mockRejectedValue(new Error('too many'));

      await expect(service.allowMailTo('a@example.net')).rejects.toThrow(
        'too many',
      );
    });
  });

  describe('issue', () => {
    const refund = jest.fn().mockResolvedValue(undefined);
    const PREVIOUS = new Date('2026-10-11T08:00:00.000Z');
    const ALERT = {
      id: 'ea_1',
      email: 'ops@example.com',
      confirmationSentAt: PREVIOUS,
    };

    beforeEach(() => refund.mockClear());

    const quietly = () =>
      jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    it('reserves the send time, then mails the link and keeps the token out of the log', async () => {
      const { service, updateMany, send } = build({
        enabled: true,
        origin: ORIGIN,
      });

      const delivered = await service.issue(ALERT, 'owner@example.com', refund);

      expect(delivered).toBe('sent');
      const [{ where, data }] = updateMany.mock.calls[0] as [
        { where: unknown; data: { confirmationSentAt: Date } },
      ];
      expect(where).toEqual({
        id: 'ea_1',
        email: 'ops@example.com',
        confirmedAt: null,
        unsubscribedAt: null,
        confirmationSentAt: PREVIOUS,
      });
      const token = confirmationToken(SECRET, {
        alertId: 'ea_1',
        email: 'ops@example.com',
        sentAt: data.confirmationSentAt,
      });
      const [mail] = send.mock.calls[0] as [
        { kind: string; to: string; text: string; secrets: string[] },
      ];
      expect(mail.kind).toBe('alert-confirmation');
      expect(mail.to).toBe('ops@example.com');
      expect(mail.text).toContain(
        `${ORIGIN}/confirm-alert?alert=ea_1&token=${token}`,
      );
      expect(mail.secrets).toEqual([token]);
      expect(updateMany.mock.invocationCallOrder[0]).toBeLessThan(
        send.mock.invocationCallOrder[0],
      );
      expect(refund).not.toHaveBeenCalled();
    });

    it('sends nothing and gives the allowance back when another change got there first', async () => {
      const error = quietly();
      const { service, updateMany, send } = build({
        enabled: true,
        origin: ORIGIN,
      });
      updateMany.mockResolvedValue({ count: 0 });

      expect(await service.issue(ALERT, 'owner@example.com', refund)).toBe(
        'lost',
      );
      expect(send).not.toHaveBeenCalled();
      expect(refund).toHaveBeenCalledTimes(1);
      expect(error.mock.calls[0][0]).toContain('ea_1');
      error.mockRestore();
    });

    it('sends nothing and gives the allowance back when the send time cannot be stored', async () => {
      const error = quietly();
      const { service, updateMany, send } = build({
        enabled: true,
        origin: ORIGIN,
      });
      updateMany.mockRejectedValue(new Error('connection reset'));

      expect(await service.issue(ALERT, 'owner@example.com', refund)).toBe(
        'failed',
      );
      expect(send).not.toHaveBeenCalled();
      expect(refund).toHaveBeenCalledTimes(1);
      error.mockRestore();
    });

    it('restores the earlier link and gives the allowance back when the mail is not sent', async () => {
      const error = quietly();
      const { service, send, updateMany } = build({
        enabled: true,
        origin: ORIGIN,
      });
      send.mockRejectedValue(new Error('smtp down'));

      expect(await service.issue(ALERT, 'owner@example.com', refund)).toBe(
        'failed',
      );
      const [reserved] = updateMany.mock.calls[0] as [
        { data: { confirmationSentAt: Date } },
      ];
      expect(updateMany).toHaveBeenLastCalledWith({
        where: {
          id: 'ea_1',
          confirmationSentAt: reserved.data.confirmationSentAt,
        },
        data: { confirmationSentAt: PREVIOUS },
      });
      expect(refund).toHaveBeenCalledTimes(1);
      error.mockRestore();
    });

    it('logs a failed send by alert id, never by recipient address', async () => {
      const error = quietly();
      const { service, send } = build({ enabled: true, origin: ORIGIN });
      send.mockRejectedValue(new Error('smtp down'));

      await service.issue(ALERT, 'owner@example.com', refund);

      const [line] = error.mock.calls[0] as [string];
      expect(line).toContain('ea_1');
      expect(line).toContain('smtp down');
      expect(line).not.toContain('ops@example.com');
      error.mockRestore();
    });

    it('sends nothing without an allowance', async () => {
      const { service, send, updateMany } = build({
        enabled: true,
        origin: null,
      });

      expect(await service.issue(ALERT, 'owner@example.com', null)).toBe(
        'failed',
      );
      expect(send).not.toHaveBeenCalled();
      expect(updateMany).not.toHaveBeenCalled();
    });
  });
});
