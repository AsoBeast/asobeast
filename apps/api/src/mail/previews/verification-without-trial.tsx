import { VERIFY_PATH } from '@asobeast/shared';
import { VerificationEmail } from '../../auth/emails/verification-email';
import { PREVIEW_ORIGIN } from './preview-origin';

export default function VerificationWithoutTrialPreview() {
  return (
    <VerificationEmail
      origin={PREVIEW_ORIGIN}
      address="ada@example.com"
      link={`${PREVIEW_ORIGIN}${VERIFY_PATH}?token=0123456789abcdef`}
      startsTrial={false}
      hours={24}
    />
  );
}
