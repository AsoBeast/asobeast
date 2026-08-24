import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import { CrossTenantAccess } from '../common/tenancy/cross-tenant-access';
import { REDACTED, scrubText } from '../common/logging/log-redaction';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

export const ACCOUNT_MAIL_CHANNEL = 'account';

export const ACCOUNT_MAIL_KINDS = [
  'verification',
  'recovery',
  'invitation',
] as const;

export type AccountMailKind = (typeof ACCOUNT_MAIL_KINDS)[number];

export interface AccountMail {
  kind: AccountMailKind;
  to: string;
  subject: string;
  text: string;
  html: string;
  secrets?: readonly string[];
}

const DETAIL_MAX = 500;

const NO_TRANSPORT = 'Email alerts require SMTP configuration';

const RECORD_JUSTIFICATION =
  'an account email is attempted before the recipient has a workspace in scope';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transport: Transporter | null = null;
  private verified: Promise<void> | null = null;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
    private readonly crossTenant: CrossTenantAccess,
  ) {}

  get enabled(): boolean {
    return Boolean(
      this.config.get('SMTP_HOST', { infer: true }) &&
      this.config.get('SMTP_FROM', { infer: true }),
    );
  }

  async send(
    to: string,
    subject: string,
    text: string,
    html: string,
  ): Promise<void> {
    if (!this.enabled) {
      throw new Error(NO_TRANSPORT);
    }
    await this.ready();
    try {
      await this.transporter().sendMail({
        from: this.config.get('SMTP_FROM', { infer: true }),
        to,
        subject,
        text,
        html,
      });
    } catch (error) {
      throw new Error(this.scrub(reason(error)));
    }
  }

  async sendAccountMail(mail: AccountMail): Promise<void> {
    if (!this.enabled) {
      await this.record(mail, 'skipped', 'no smtp transport is configured');
      throw new Error(NO_TRANSPORT);
    }

    try {
      await this.send(mail.to, mail.subject, mail.text, mail.html);
    } catch (error) {
      const detail = this.scrub(reason(error), mail.secrets);
      await this.record(mail, 'failed', detail);
      throw sameKind(error, detail);
    }
    await this.record(mail, 'delivered', null);
  }

  private async record(
    mail: AccountMail,
    status: string,
    scrubbedDetail: string | null,
  ): Promise<void> {
    try {
      await this.crossTenant.becauseThisWorkIsNotOwnedByOneWorkspace(
        RECORD_JUSTIFICATION,
        () =>
          this.prisma.alertDelivery.create({
            data: {
              channel: ACCOUNT_MAIL_CHANNEL,
              event: mail.kind,
              status,
              detail: scrubbedDetail,
              attempt: 1,
            },
          }),
      );
    } catch (error) {
      this.logger.warn(`account mail delivery log failed: ${reason(error)}`);
    }
  }

  private scrub(detail: string, secrets: readonly string[] = []): string {
    const password = this.config.get('SMTP_PASSWORD', { infer: true });
    const withoutPassword = password
      ? detail.split(password).join(REDACTED)
      : detail;
    return scrubText(withoutPassword, secrets).slice(0, DETAIL_MAX);
  }

  private ready(): Promise<void> {
    this.verified ??= this.transporter()
      .verify()
      .then(() => undefined)
      .catch((error: unknown) => {
        this.verified = null;
        throw new ServiceUnavailableException(
          this.scrub(
            `The SMTP relay at ${this.config.get('SMTP_HOST', { infer: true })}:${this.config.get('SMTP_PORT', { infer: true })} would not accept a connection, so no email can be sent: ${reason(error)}`,
          ),
        );
      });
    return this.verified;
  }

  private transporter(): Transporter {
    if (!this.transport) {
      const user = this.config.get('SMTP_USER', { infer: true });
      const pass = this.config.get('SMTP_PASSWORD', { infer: true });
      this.transport = createTransport({
        host: this.config.get('SMTP_HOST', { infer: true }),
        port: this.config.get('SMTP_PORT', { infer: true }),
        secure: this.config.get('SMTP_SECURE', { infer: true }),
        auth: user ? { user, pass } : undefined,
      });
    }
    return this.transport;
  }
}

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sameKind(error: unknown, detail: string): Error {
  return error instanceof ServiceUnavailableException
    ? new ServiceUnavailableException(detail)
    : new Error(detail);
}
