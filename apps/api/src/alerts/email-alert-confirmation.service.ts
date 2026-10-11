import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CONFIRM_ALERT_PATH } from '@asobeast/shared';
import { WorkspaceContext } from '../common/tenancy/workspace-context';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { alertConfirmationEmail } from './emails/alert-confirmation-email';
import { CONFIRMATION_DAYS, confirmationToken } from './confirmation-token';
import {
  ConfirmationMailLimiter,
  type ConfirmationRefund,
} from './confirmation-mail.limiter';
import { MailerService } from './mailer.service';

const NO_ORIGIN = 'WEB_PUBLIC_URL is not set, so the link has no host';

export type ConfirmationOutcome = 'sent' | 'lost' | 'failed';

interface PendingRecipient {
  id: string;
  email: string;
  confirmationSentAt: Date | null;
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

@Injectable()
export class EmailAlertConfirmation {
  private readonly logger = new Logger(EmailAlertConfirmation.name);

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly mailer: MailerService,
    private readonly prisma: PrismaService,
    private readonly limiter: ConfirmationMailLimiter,
    private readonly workspace: WorkspaceContext,
  ) {}

  get canSend(): boolean {
    return this.mailer.enabled && Boolean(this.mailer.origin);
  }

  async confirmationFor(address: string): Promise<Date | null> {
    return (await this.isVerifiedMember(address)) ? new Date() : null;
  }

  async allowMailTo(address: string): Promise<ConfirmationRefund | null> {
    if (!this.canSend) return null;
    return this.limiter.claim(
      this.workspace.require('a confirmation email'),
      address,
    );
  }

  async issue(
    alert: PendingRecipient,
    requestedBy: string,
    refund: ConfirmationRefund | null,
  ): Promise<ConfirmationOutcome> {
    if (!refund) return 'failed';
    const sentAt = new Date();
    const reserved = await this.reserve(alert, sentAt);
    if (reserved !== 'reserved') {
      await refund();
      return reserved;
    }
    try {
      await this.send(alert, requestedBy, sentAt);
      return 'sent';
    } catch (error) {
      await this.restore(alert, sentAt);
      await refund();
      this.logger.error(
        `confirmation email for alert ${alert.id} failed: ${reasonOf(error)}`,
      );
      return 'failed';
    }
  }

  private async reserve(
    alert: PendingRecipient,
    sentAt: Date,
  ): Promise<'reserved' | 'lost' | 'failed'> {
    try {
      const { count } = await this.prisma.emailAlert.updateMany({
        where: {
          id: alert.id,
          email: alert.email,
          confirmedAt: null,
          unsubscribedAt: null,
          confirmationSentAt: alert.confirmationSentAt,
        },
        data: { confirmationSentAt: sentAt },
      });
      if (count > 0) return 'reserved';
      this.logger.error(
        `confirmation email for alert ${alert.id} not sent: the alert changed before it went out`,
      );
      return 'lost';
    } catch (error) {
      this.logger.error(
        `confirmation email for alert ${alert.id} not sent: ${reasonOf(error)}`,
      );
      return 'failed';
    }
  }

  private async restore(alert: PendingRecipient, sentAt: Date): Promise<void> {
    try {
      await this.prisma.emailAlert.updateMany({
        where: { id: alert.id, confirmationSentAt: sentAt },
        data: { confirmationSentAt: alert.confirmationSentAt },
      });
    } catch (error) {
      this.logger.error(
        `confirmation email for alert ${alert.id} kept a send time it never used: ${reasonOf(error)}`,
      );
    }
  }

  private async send(
    alert: PendingRecipient,
    requestedBy: string,
    sentAt: Date,
  ): Promise<void> {
    const origin = this.mailer.origin;
    if (!origin) throw new Error(NO_ORIGIN);
    const token = confirmationToken(this.secret, {
      alertId: alert.id,
      email: alert.email,
      sentAt,
    });
    const email = await alertConfirmationEmail({
      origin,
      address: alert.email,
      requestedBy,
      link: `${origin}${CONFIRM_ALERT_PATH}?alert=${encodeURIComponent(alert.id)}&token=${token}`,
      days: CONFIRMATION_DAYS,
    });
    await this.mailer.sendAccountMail({
      kind: 'alert-confirmation',
      to: alert.email,
      ...email,
      secrets: [token],
    });
  }

  private async isVerifiedMember(address: string): Promise<boolean> {
    const member = await this.prisma.user.findFirst({
      where: {
        email: { equals: address, mode: 'insensitive' },
        emailVerifiedAt: { not: null },
      },
      select: { id: true },
    });
    return member !== null;
  }

  private get secret(): string {
    return this.config.get('AUTH_SECRET', { infer: true });
  }
}
