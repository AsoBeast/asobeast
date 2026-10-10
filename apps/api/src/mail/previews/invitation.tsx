import { InvitationEmail } from '../../auth/emails/invitation-email';
import { PREVIEW_ORIGIN } from './preview-origin';

export default function InvitationPreview() {
  return (
    <InvitationEmail
      origin={PREVIEW_ORIGIN}
      inviter="ada@example.com"
      link={`${PREVIEW_ORIGIN}/invite?token=0123456789abcdef`}
      days={7}
    />
  );
}
