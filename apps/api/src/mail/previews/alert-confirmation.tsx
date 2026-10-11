import { CONFIRM_ALERT_PATH } from '@asobeast/shared';
import { AlertConfirmationEmail } from '../../alerts/emails/alert-confirmation-email';
import { PREVIEW_ORIGIN } from './preview-origin';

export default function AlertConfirmationPreview() {
  return (
    <AlertConfirmationEmail
      origin={PREVIEW_ORIGIN}
      address="alerts@example.com"
      requestedBy="ada@example.com"
      link={`${PREVIEW_ORIGIN}${CONFIRM_ALERT_PATH}?alert=ea_preview&token=preview`}
      days={7}
    />
  );
}
