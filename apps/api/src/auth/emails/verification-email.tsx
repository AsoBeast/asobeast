import { CallToAction } from '../../mail/call-to-action';
import { FooterLine } from '../../mail/email-footer';
import { EmailLayout } from '../../mail/email-layout';
import { atHost } from '../../mail/email-links';
import { EmailHeading, EmailParagraph } from '../../mail/email-text';
import { Notice } from '../../mail/notice';
import { renderEmail, type EmailContent } from '../../mail/render-email';

export const VERIFICATION_SUBJECT = 'Confirm your asobeast email';

export interface VerificationEmailProps {
  origin: string | null;
  address: string;
  link: string;
  startsTrial: boolean;
  hours: number;
}

export function VerificationEmail({
  origin,
  address,
  link,
  startsTrial,
  hours,
}: VerificationEmailProps) {
  const purpose = startsTrial
    ? 'to start your trial'
    : 'to finish setting up your account';
  return (
    <EmailLayout
      preview={`Confirm ${address} ${purpose}.`}
      origin={origin}
      footer={
        <FooterLine>
          {`You received this because this address was used to sign up${atHost(origin)}.`}
        </FooterLine>
      }
    >
      <EmailHeading>Confirm your email</EmailHeading>
      <EmailParagraph>{`Confirm ${address} ${purpose}.`}</EmailParagraph>
      <CallToAction href={link} label="Confirm email address" />
      <Notice>
        {`The link works for ${hours} hours. If you did not create an AsoBeast account, ignore this email and nothing happens.`}
      </Notice>
    </EmailLayout>
  );
}

export function verificationEmail(
  props: VerificationEmailProps,
): Promise<EmailContent> {
  return renderEmail(VERIFICATION_SUBJECT, <VerificationEmail {...props} />);
}
