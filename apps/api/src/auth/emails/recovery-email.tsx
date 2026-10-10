import { CallToAction } from '../../mail/call-to-action';
import { FooterLine } from '../../mail/email-footer';
import { EmailLayout } from '../../mail/email-layout';
import { atHost } from '../../mail/email-links';
import { EmailHeading, EmailParagraph } from '../../mail/email-text';
import { Notice } from '../../mail/notice';
import { renderEmail, type EmailContent } from '../../mail/render-email';

export const RECOVERY_SUBJECT = 'Reset your asobeast password';

export interface RecoveryEmailProps {
  origin: string | null;
  address: string;
  link: string;
}

export function RecoveryEmail({ origin, address, link }: RecoveryEmailProps) {
  return (
    <EmailLayout
      preview={`Choose a new password for ${address}. The link expires in an hour.`}
      origin={origin}
      footer={
        <FooterLine>
          {`You received this because a password reset was requested for this address${atHost(origin)}.`}
        </FooterLine>
      }
    >
      <EmailHeading>Reset your password</EmailHeading>
      <EmailParagraph>
        {`Someone asked to reset the password for ${address}.`}
      </EmailParagraph>
      <CallToAction href={link} label="Choose a new password" />
      <Notice>
        The link expires in an hour. If you did not ask for it, ignore this
        email and your password stays the same.
      </Notice>
    </EmailLayout>
  );
}

export function recoveryEmail(
  props: RecoveryEmailProps,
): Promise<EmailContent> {
  return renderEmail(RECOVERY_SUBJECT, <RecoveryEmail {...props} />);
}
