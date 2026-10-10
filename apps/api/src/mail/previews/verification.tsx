import { VerificationEmail } from '../../auth/emails/verification-email';
import { PREVIEW_ORIGIN } from './preview-origin';

export default function VerificationPreview() {
  return (
    <VerificationEmail
      origin={PREVIEW_ORIGIN}
      address="ada@example.com"
      link={`${PREVIEW_ORIGIN}/verify?token=0123456789abcdef`}
      startsTrial
      hours={24}
    />
  );
}
