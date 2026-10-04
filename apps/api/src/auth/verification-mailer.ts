import { Injectable } from '@nestjs/common';
import { VERIFY_PATH } from '@asobeast/shared';
import { MailerService } from '../alerts/mailer.service';
import { PublicWebUrl } from './public-web-url';

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
    email: string,
    token: string,
    startsTrial: boolean,
  ): Promise<void> {
    const link = this.web.tokenLink(VERIFY_PATH, token, 'confirmation link');
    const subject = 'Confirm your asobeast email';
    const invitation = startsTrial
      ? 'Confirm your address to start your trial'
      : 'Confirm your address';
    await this.mailer.sendAccountMail({
      kind: 'verification',
      to: email,
      subject,
      text: `${subject}\n\n${invitation}: ${link}`,
      html: `<p>${invitation}.</p><p><a href="${link}">Confirm ${email}</a></p>`,
      secrets: [token],
    });
  }
}
