import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { describeWait } from '../auth/rate-limit/describe-wait';
import { RequestThrottledError } from '../auth/rate-limit/rate-limit.errors';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { AlertMail } from './alert-mail';
import { ConfirmationMailLimiter } from './confirmation-mail.limiter';
import { EmailAlertConfirmation } from './email-alert-confirmation.service';
import { EmailAlertUnsubscribe } from './email-alert-unsubscribe.service';
import {
  CONFIRMATION_RESEND_COOLDOWN_SECONDS,
  EmailAlertsService,
} from './email-alerts.service';
import { MailerService } from './mailer.service';

const HOUR_MS = 60 * 60 * 1000;

const waiting = (confirmationSentAt: Date | null) => ({
  id: 'ea_1',
  workspaceId: 'ws_1',
  email: 'ops@example.com',
  events: ['metadata.changed'],
  active: true,
  confirmedAt: null,
  confirmationSentAt,
  unsubscribedAt: null,
  createdAt: new Date(),
});

const build = () => {
  const findFirst = jest.fn();
  const refund = jest.fn().mockResolvedValue(undefined);
  const tx = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    emailAlert: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue(waiting(null)),
      findFirst: jest.fn().mockResolvedValue(waiting(null)),
      update: jest.fn().mockResolvedValue(waiting(null)),
    },
  };
  const withTransaction = jest.fn(
    async (run: (client: typeof tx) => Promise<unknown>) => run(tx),
  );
  const confirmation = {
    canSend: true,
    confirmationFor: jest.fn().mockResolvedValue(null),
    allowMailTo: jest.fn().mockResolvedValue(refund),
    issue: jest.fn().mockResolvedValue('sent'),
    resend: jest.fn().mockResolvedValue('sent'),
  };
  const service = new EmailAlertsService(
    {
      emailAlert: { findFirst },
      withTransaction,
    } as unknown as PrismaService,
    { enabled: true } as MailerService,
    { require: jest.fn(() => 'ws_1') } as unknown as WorkspaceContext,
    {} as AlertMail,
    confirmation as unknown as EmailAlertConfirmation,
  );
  return { service, findFirst, confirmation, refund, withTransaction, tx };
};

describe('EmailAlertsService', () => {
  describe('create', () => {
    it('gives the allowance back when the transaction fails after claiming it', async () => {
      const { service, confirmation, refund, withTransaction } = build();
      withTransaction.mockImplementation(async (run) => {
        await run({
          $executeRaw: jest.fn().mockResolvedValue(1),
          emailAlert: {
            count: jest.fn().mockResolvedValue(0),
            create: jest.fn().mockResolvedValue(waiting(null)),
          },
        });
        throw new Error('commit failed');
      });

      await expect(
        service.create(
          { email: 'ops@example.com', events: ['metadata.changed'] },
          'owner@example.com',
        ),
      ).rejects.toThrow('commit failed');
      expect(confirmation.allowMailTo).toHaveBeenCalledTimes(1);
      expect(refund).toHaveBeenCalledTimes(1);
      expect(confirmation.issue).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('decides whether the address changed under the workspace lock', async () => {
      const { service, findFirst, confirmation, tx } = build();

      await service.update(
        'ea_1',
        { email: 'OPS@example.com' },
        'owner@example.com',
      );

      expect(findFirst).not.toHaveBeenCalled();
      expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
        tx.emailAlert.findFirst.mock.invocationCallOrder[0],
      );
      expect(confirmation.allowMailTo).not.toHaveBeenCalled();
      expect(confirmation.confirmationFor).not.toHaveBeenCalled();
    });

    it('asks whether a new address is trusted only once it is known to change', async () => {
      const { service, confirmation, tx } = build();

      await service.update(
        'ea_1',
        { email: 'new@example.com' },
        'owner@example.com',
      );

      expect(confirmation.confirmationFor).toHaveBeenCalledWith(
        'new@example.com',
        tx,
      );
      expect(tx.emailAlert.findFirst.mock.invocationCallOrder[0]).toBeLessThan(
        confirmation.confirmationFor.mock.invocationCallOrder[0],
      );
    });
  });

  describe('resendConfirmation', () => {
    it('answers a resend that lost to a concurrent one as cooling down', async () => {
      const { service, findFirst, confirmation } = build();
      findFirst.mockResolvedValueOnce(
        waiting(new Date(Date.now() - 2 * HOUR_MS)),
      );
      confirmation.resend.mockResolvedValue('lost');

      await expect(
        service.resendConfirmation('ea_1', 'owner@example.com'),
      ).rejects.toBeInstanceOf(RequestThrottledError);
      expect(findFirst).toHaveBeenCalledTimes(1);
    });

    it('names the cooldown it waits for', async () => {
      const { service, findFirst } = build();
      findFirst.mockResolvedValue(waiting(new Date()));

      await expect(
        service.resendConfirmation('ea_1', 'owner@example.com'),
      ).rejects.toThrow(
        `less than ${describeWait(CONFIRMATION_RESEND_COOLDOWN_SECONDS)} ago`,
      );
    });

    it('holds a resend that lost the race to the cooldown, not to the daily allowance the racers spent', async () => {
      const warn = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      const findFirst = jest
        .fn()
        .mockResolvedValue(waiting(new Date(Date.now() - 2 * HOUR_MS)));
      const updateMany = jest.fn().mockResolvedValue({ count: 0 });
      const claim = jest
        .fn()
        .mockRejectedValue(
          new RequestThrottledError(
            50_000,
            'Too many confirmation emails were requested for this recipient today.',
          ),
        );
      const mailer = { enabled: true, origin: 'https://aso.example.com' };
      const prisma = {
        emailAlert: { findFirst, updateMany },
      } as unknown as PrismaService;
      const workspace = {
        require: jest.fn(() => 'ws_1'),
      } as unknown as WorkspaceContext;
      const service = new EmailAlertsService(
        prisma,
        mailer as MailerService,
        workspace,
        {} as AlertMail,
        new EmailAlertConfirmation(
          {} as ConfigService<Env, true>,
          mailer as MailerService,
          prisma,
          { claim } as unknown as ConfirmationMailLimiter,
          workspace,
          {} as EmailAlertUnsubscribe,
        ),
      );

      await expect(
        service.resendConfirmation('ea_1', 'owner@example.com'),
      ).rejects.toThrow(
        `less than ${describeWait(CONFIRMATION_RESEND_COOLDOWN_SECONDS)} ago`,
      );
      expect(claim).not.toHaveBeenCalled();
      warn.mockRestore();
    });

    it('answers a resend whose mail could not be sent as unavailable, whatever the row says now', async () => {
      const { service, findFirst, confirmation } = build();
      findFirst
        .mockResolvedValueOnce(waiting(new Date(Date.now() - 2 * HOUR_MS)))
        .mockResolvedValueOnce(waiting(new Date()));
      confirmation.resend.mockResolvedValue('failed');

      await expect(
        service.resendConfirmation('ea_1', 'owner@example.com'),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });
});
