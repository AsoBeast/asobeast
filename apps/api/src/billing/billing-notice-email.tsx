import { CallToAction } from '../mail/call-to-action';
import { FooterLine } from '../mail/email-footer';
import { EmailLayout } from '../mail/email-layout';
import { atHost, webLink } from '../mail/email-links';
import { EmailHeading, EmailParagraph } from '../mail/email-text';
import { renderEmail, type EmailContent } from '../mail/render-email';
import type { AccountMail } from './account-mail';

interface BillingNoticeEmailProps {
  mail: AccountMail;
  origin: string | null;
}

export function BillingNoticeEmail({ mail, origin }: BillingNoticeEmailProps) {
  const href = mail.action ? webLink(origin, mail.action.path) : null;
  return (
    <EmailLayout
      preview={mail.body[0]}
      origin={origin}
      footer={
        <FooterLine>
          {`You received this because you own an AsoBeast workspace${atHost(origin)}. Billing and trial notices always go to the workspace owner.`}
        </FooterLine>
      }
    >
      <EmailHeading>{mail.heading}</EmailHeading>
      {mail.body.map((line) => (
        <EmailParagraph key={line}>{line}</EmailParagraph>
      ))}
      {href && mail.action && (
        <CallToAction href={href} label={mail.action.label} />
      )}
    </EmailLayout>
  );
}

export function billingNoticeEmail(
  mail: AccountMail,
  origin: string | null,
): Promise<EmailContent> {
  return renderEmail(
    mail.subject,
    <BillingNoticeEmail mail={mail} origin={origin} />,
  );
}
