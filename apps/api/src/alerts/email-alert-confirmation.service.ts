import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CONFIRM_ALERT_PATH } from '@asobeast/shared';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { alertConfirmationEmail } from './emails/alert-confirmation-email';
import { CONFIRMATION_DAYS, confirmationToken } from './confirmation-token';
import { MailerService } from './mailer.service';

@Injectable()
export class EmailAlertConfirmation {
  private readonly logger = new Logger(EmailAlertConfirmation.name);

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly mailer: MailerService,
    private readonly prisma: PrismaService,
  ) {}

  get required(): boolean {
    return this.mailer.enabled && Boolean(this.mailer.origin);
  }

  async confirmationFor(address: string): Promise<Date | null> {
    if (!this.required || (await this.isVerifiedMember(address))) {
      return new Date();
    }
    return null;
  }

  async issue(
    alert: { id: string; email: string },
    requestedBy: string,
  ): Promise<boolean> {
    const origin = this.mailer.origin;
    if (!origin) return false;
    const sentAt = new Date();
    await this.prisma.emailAlert.update({
      where: { id: alert.id },
      data: { confirmationSentAt: sentAt },
    });
    const token = confirmationToken(this.secret, {
      alertId: alert.id,
      email: alert.email,
      sentAt,
    });
    try {
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
      return true;
    } catch (error) {
      this.logger.error(
        `confirmation email to ${alert.email} failed: ${error instanceof Error ? error.message : String(error)}`,
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
