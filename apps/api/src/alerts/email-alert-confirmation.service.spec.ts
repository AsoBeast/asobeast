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
  describe('required', () => {
    it.each([
      [true, ORIGIN, true],
      [true, null, false],
      [false, ORIGIN, false],
    ])(
      'with email enabled %s and origin %s it is %s',
      (enabled, origin, required) => {
        expect(build({ enabled, origin }).service.required).toBe(required);
      },
    );
  });

  describe('confirmationFor', () => {
    it('confirms at once when the instance cannot send a link', async () => {
      const { service, findFirst } = build({ enabled: true, origin: null });

      expect(await service.confirmationFor('a@example.net')).toBeInstanceOf(
        Date,
      );
      expect(findFirst).not.toHaveBeenCalled();
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

    beforeEach(() => refund.mockClear());

    it('mails the link, then stamps the send and keeps the token out of the log', async () => {
      const { service, updateMany, send } = build({
        enabled: true,
        origin: ORIGIN,
      });

      const delivered = await service.issue(
        { id: 'ea_1', email: 'ops@example.com' },
        'owner@example.com',
        refund,
      );

      expect(delivered).toBe(true);
      const [{ where, data }] = updateMany.mock.calls[0] as [
        { where: unknown; data: { confirmationSentAt: Date } },
      ];
      expect(where).toEqual({ id: 'ea_1', email: 'ops@example.com' });
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
      expect(send.mock.invocationCallOrder[0]).toBeLessThan(
        updateMany.mock.invocationCallOrder[0],
      );
      expect(refund).not.toHaveBeenCalled();
    });

    it('keeps the earlier link and gives the allowance back when the mail is not sent', async () => {
      const { service, send, updateMany } = build({
        enabled: true,
        origin: ORIGIN,
      });
      send.mockRejectedValue(new Error('smtp down'));

      expect(
        await service.issue(
          { id: 'ea_1', email: 'ops@example.com' },
          'owner@example.com',
          refund,
        ),
      ).toBe(false);
      expect(updateMany).not.toHaveBeenCalled();
      expect(refund).toHaveBeenCalledTimes(1);
    });

    it('reports a send it could not record instead of throwing', async () => {
      const { service, updateMany } = build({
        enabled: true,
        origin: ORIGIN,
      });
      updateMany.mockRejectedValue(new Error('connection reset'));

      expect(
        await service.issue(
          { id: 'ea_1', email: 'ops@example.com' },
          'owner@example.com',
          refund,
        ),
      ).toBe(false);
      expect(refund).not.toHaveBeenCalled();
    });
  });
});
