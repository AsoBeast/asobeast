import { Injectable } from '@nestjs/common';
import { RESET_PASSWORD_PATH } from '@asobeast/shared';
import { MailerService } from '../alerts/mailer.service';
import { recoveryEmail } from './emails/recovery-email';
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

  async send(address: string, token: string): Promise<void> {
    const link = this.web.tokenLink(
      RESET_PASSWORD_PATH,
      token,
      'recovery link',
    );
    const email = await recoveryEmail({
      origin: this.mailer.origin,
      address,
      link,
    });
    await this.mailer.sendAccountMail({
      kind: 'recovery',
      to: address,
      ...email,
      secrets: [token],
    });
  }
}
