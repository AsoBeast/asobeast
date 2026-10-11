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
    alert: { id: string; email: string },
    requestedBy: string,
    refund: ConfirmationRefund | null,
  ): Promise<boolean> {
    if (!refund) return false;
    const sentAt = new Date();
    try {
      await this.send(alert, requestedBy, sentAt);
    } catch (error) {
      await refund();
      this.logger.error(
        `confirmation email for alert ${alert.id} failed: ${reasonOf(error)}`,
      );
      return false;
    }
    return this.record(alert, sentAt);
  }

  private async send(
    alert: { id: string; email: string },
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

  private async record(
    alert: { id: string; email: string },
    sentAt: Date,
  ): Promise<boolean> {
    try {
      const { count } = await this.prisma.emailAlert.updateMany({
        where: { id: alert.id, email: alert.email },
        data: { confirmationSentAt: sentAt },
      });
      return count > 0;
    } catch (error) {
      this.logger.error(
        `confirmation email for alert ${alert.id} was sent but not recorded: ${reasonOf(error)}`,
      );
      return false;
    }
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
