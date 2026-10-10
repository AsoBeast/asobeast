import { RecoveryEmail } from '../../auth/emails/recovery-email';
import { PREVIEW_ORIGIN } from './preview-origin';

export default function RecoveryPreview() {
  return (
    <RecoveryEmail
      origin={PREVIEW_ORIGIN}
      address="ada@example.com"
      link={`${PREVIEW_ORIGIN}/reset-password?token=0123456789abcdef`}
    />
  );
}
