import { Injectable } from '@nestjs/common';
import { VERIFY_PATH } from '@asobeast/shared';
import { MailerService } from '../alerts/mailer.service';
import { verificationEmail } from './emails/verification-email';
import { PublicWebUrl } from './public-web-url';

export const VERIFICATION_HOURS = 24;

@Injectable()
export class VerificationMailer {
  constructor(
    private readonly mailer: MailerService,
    private readonly web: PublicWebUrl,
  ) {}

  get configured(): boolean {
    return this.mailer.enabled && this.web.configured;
  }

  async send(
    address: string,
    token: string,
    startsTrial: boolean,
  ): Promise<void> {
    const link = this.web.tokenLink(VERIFY_PATH, token, 'confirmation link');
    const email = await verificationEmail({
      origin: this.mailer.origin,
      address,
      link,
      startsTrial,
      hours: VERIFICATION_HOURS,
    });
    await this.mailer.sendAccountMail({
      kind: 'verification',
      to: address,
      ...email,
      secrets: [token],
    });
  }
}
