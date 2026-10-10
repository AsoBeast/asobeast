import { Injectable } from '@nestjs/common';
import type { AlertPayload } from '@asobeast/shared';
import type { OutgoingMail } from '../mail/outgoing-message';
import {
  EmailAlertUnsubscribe,
  oneClickHeaders,
} from './email-alert-unsubscribe.service';
import { formatEmail } from './email-format';
import { MailerService } from './mailer.service';

@Injectable()
export class AlertMail {
  constructor(
    private readonly mailer: MailerService,
    private readonly unsubscribes: EmailAlertUnsubscribe,
  ) {}

  async compose(
    emailAlertId: string,
    to: string,
    payload: AlertPayload,
  ): Promise<OutgoingMail> {
    const links = this.unsubscribes.links({ alertId: emailAlertId, email: to });
    const email = await formatEmail(payload, {
      origin: this.mailer.origin,
      unsubscribe: links?.page ?? null,
    });
    return { to, ...email, headers: oneClickHeaders(links) };
  }
}
