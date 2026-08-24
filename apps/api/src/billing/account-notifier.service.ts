import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { ACCOUNT_MAIL_CHANNEL, MailerService } from '../alerts/mailer.service';
import { Env } from '../config/env';
import { asHtml, asText, type AccountMail } from './account-mail';

export const ACCOUNT_CHANNEL = ACCOUNT_MAIL_CHANNEL;

export type NoticeOutcome = 'delivered' | 'skipped' | 'failed';

export function noticeSettled(outcome: NoticeOutcome): boolean {
  return outcome !== 'failed';
}

@Injectable()
export class AccountNotifier {
  private readonly logger = new Logger(AccountNotifier.name);

  constructor(
    private readonly mailer: MailerService,
    private readonly prisma: PrismaService,
    private readonly crossTenant: CrossTenantAccess,
    private readonly config: ConfigService<Env, true>,
  ) {}

  get appUrl(): string {
    return this.config.get('WEB_PUBLIC_URL', { infer: true }) ?? '';
  }

  notify(
    workspaceId: string,
    event: string,
    mail: AccountMail,
  ): Promise<NoticeOutcome> {
    return this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
      'an account email is addressed to an owner, not scoped to a request',
      () => this.deliver(workspaceId, event, mail),
    );
  }

  private async deliver(
    workspaceId: string,
    event: string,
    mail: AccountMail,
  ): Promise<NoticeOutcome> {
    const recipient = await this.owner(workspaceId);
    if (!recipient || !this.mailer.enabled) {
      this.logger.log(
        `workspace ${workspaceId} has no way to receive ${event}; recording it unsent`,
      );
      await this.record(event, 'skipped', 'no owner email or no smtp');
      return 'skipped';
    }

    try {
      await this.mailer.send(
        recipient,
        mail.subject,
        asText(mail),
        asHtml(mail),
      );
      await this.record(event, 'delivered', null);
      return 'delivered';
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.error(`${event} to ${recipient} failed: ${detail}`);
      await this.record(event, 'failed', detail);
      return 'failed';
    }
  }

  private async owner(workspaceId: string): Promise<string | null> {
    const owner = await this.prisma.user.findFirst({
      where: { workspaceId, role: 'owner' },
      orderBy: { createdAt: 'asc' },
      select: { email: true },
    });
    return owner?.email ?? null;
  }

  private async record(
    event: string,
    status: string,
    detail: string | null,
  ): Promise<void> {
    await this.prisma.alertDelivery.create({
      data: { channel: ACCOUNT_CHANNEL, event, status, detail, attempt: 1 },
    });
  }
}
