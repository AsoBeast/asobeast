import type { SendMailOptions } from 'nodemailer/lib/mailer';
import type { EmailContent } from './render-email';

export interface OutgoingMail extends EmailContent {
  to: string;
  headers?: Readonly<Record<string, string>>;
}

const AUTOMATED_MAIL_HEADERS: Readonly<Record<string, string>> = {
  'Auto-Submitted': 'auto-generated',
  'X-Auto-Response-Suppress': 'All',
};

export function outgoingMessage(
  from: SendMailOptions['from'],
  mail: OutgoingMail,
): SendMailOptions {
  return {
    from,
    to: mail.to,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
    headers: { ...mail.headers, ...AUTOMATED_MAIL_HEADERS },
  };
}
