import { Injectable } from '@nestjs/common';
import { RESET_PASSWORD_PATH } from '@asobeast/shared';
import { MailerService } from '../alerts/mailer.service';
import { PublicWebUrl } from './public-web-url';

@Injectable()
export class RecoveryMailer {
  constructor(
    private readonly mailer: MailerService,
    private readonly web: PublicWebUrl,
  ) {}

  get configured(): boolean {
    return this.mailer.enabled && this.web.configured;
  }

  async send(email: string, token: string): Promise<void> {
    const link = this.web.tokenLink(
      RESET_PASSWORD_PATH,
      token,
      'recovery link',
    );
    const subject = 'Reset your asobeast password';
    await this.mailer.sendAccountMail({
      kind: 'recovery',
      to: email,
      subject,
      text: `${subject}\n\nChoose a new password: ${link}\n\nThe link expires in an hour. Ignore this message if you did not ask for it.`,
      html: `<p>Choose a new password.</p><p><a href="${link}">Reset the password for ${email}</a></p><p>The link expires in an hour. Ignore this message if you did not ask for it.</p>`,
      secrets: [token],
    });
  }
}
