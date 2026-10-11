import { ServiceUnavailableException } from '@nestjs/common';
import { RequestThrottledError } from '../auth/rate-limit/rate-limit.errors';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { PrismaService } from '../prisma/prisma.service';
import { AlertMail } from './alert-mail';
import { EmailAlertConfirmation } from './email-alert-confirmation.service';
import { EmailAlertsService } from './email-alerts.service';
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
  const confirmation = {
    canSend: true,
    allowMailTo: jest.fn().mockResolvedValue(refund),
    issue: jest.fn().mockResolvedValue(true),
  };
  const service = new EmailAlertsService(
    { emailAlert: { findFirst } } as unknown as PrismaService,
    { enabled: true } as MailerService,
    { require: jest.fn(() => 'ws_1') } as unknown as WorkspaceContext,
    {} as AlertMail,
    confirmation as unknown as EmailAlertConfirmation,
  );
  return { service, findFirst, confirmation };
};

describe('EmailAlertsService', () => {
  describe('resendConfirmation', () => {
    it('answers a resend that lost to a concurrent one as cooling down', async () => {
      const { service, findFirst, confirmation } = build();
      findFirst
        .mockResolvedValueOnce(waiting(new Date(Date.now() - 2 * HOUR_MS)))
        .mockResolvedValueOnce(waiting(new Date()));
      confirmation.issue.mockResolvedValue(false);

      await expect(
        service.resendConfirmation('ea_1', 'owner@example.com'),
      ).rejects.toBeInstanceOf(RequestThrottledError);
    });

    it('answers a resend whose mail could not be sent as unavailable', async () => {
      const { service, findFirst, confirmation } = build();
      findFirst.mockResolvedValue(waiting(new Date(Date.now() - 2 * HOUR_MS)));
      confirmation.issue.mockResolvedValue(false);

      await expect(
        service.resendConfirmation('ea_1', 'owner@example.com'),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });
});
