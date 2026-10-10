import { CallToAction } from '../../mail/call-to-action';
import { FooterLine } from '../../mail/email-footer';
import { EmailLayout } from '../../mail/email-layout';
import { atHost } from '../../mail/email-links';
import { EmailHeading, EmailParagraph } from '../../mail/email-text';
import { Notice } from '../../mail/notice';
import { renderEmail, type EmailContent } from '../../mail/render-email';

export interface InvitationEmailProps {
  origin: string | null;
  inviter: string;
  link: string;
  days: number;
}

export function InvitationEmail({
  origin,
  inviter,
  link,
  days,
}: InvitationEmailProps) {
  return (
    <EmailLayout
      preview={`${inviter} invited you to their AsoBeast workspace.`}
      origin={origin}
      footer={
        <FooterLine>
          {`You received this because ${inviter} invited this address${atHost(origin)}.`}
        </FooterLine>
      }
    >
      <EmailHeading>Join your team on AsoBeast</EmailHeading>
      <EmailParagraph>
        {`${inviter} invited you to their workspace. AsoBeast tracks App Store and Google Play rankings, listings and reviews.`}
      </EmailParagraph>
      <CallToAction href={link} label="Accept invitation" />
      <Notice>
        {`The invitation expires in ${days} days. If you were not expecting it, ignore this email.`}
      </Notice>
    </EmailLayout>
  );
}

export function invitationEmail(
  props: InvitationEmailProps,
): Promise<EmailContent> {
  return renderEmail(
    `${props.inviter} invited you to asobeast`,
    <InvitationEmail {...props} />,
  );
}
