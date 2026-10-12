import { CallToAction } from '../../mail/call-to-action';
import { FooterLine, FooterLink } from '../../mail/email-footer';
import { EmailLayout } from '../../mail/email-layout';
import { atHost } from '../../mail/email-links';
import { EmailHeading, EmailParagraph } from '../../mail/email-text';
import { Notice } from '../../mail/notice';
import { renderEmail, type EmailContent } from '../../mail/render-email';

export const ALERT_CONFIRMATION_SUBJECT = 'Confirm your asobeast alert email';

export interface AlertConfirmationEmailProps {
  origin: string | null;
  address: string;
  requestedBy: string;
  link: string;
  stop: string;
  days: number;
}

export function AlertConfirmationEmail({
  origin,
  address,
  requestedBy,
  link,
  stop,
  days,
}: AlertConfirmationEmailProps) {
  return (
    <EmailLayout
      preview={`${requestedBy} asked to send AsoBeast alerts to ${address}.`}
      origin={origin}
      footer={
        <>
          <FooterLine>
            {`You received this because ${requestedBy} entered this address${atHost(origin)}.`}
          </FooterLine>
          <FooterLine>
            <FooterLink href={stop}>Do not ask this address again</FooterLink>
          </FooterLine>
        </>
      }
    >
      <EmailHeading>Confirm alert emails</EmailHeading>
      <EmailParagraph>
        {`${requestedBy} asked to send AsoBeast alerts to ${address}. AsoBeast tracks App Store and Google Play rankings, listings and reviews, and emails what changed.`}
      </EmailParagraph>
      <CallToAction href={link} label="Confirm email address" />
      <Notice>
        {`The link works for ${days} days. If you did not expect this, ignore this email and nothing is sent to this address.`}
      </Notice>
    </EmailLayout>
  );
}

export function alertConfirmationEmail(
  props: AlertConfirmationEmailProps,
): Promise<EmailContent> {
  return renderEmail(
    ALERT_CONFIRMATION_SUBJECT,
    <AlertConfirmationEmail {...props} />,
  );
}
