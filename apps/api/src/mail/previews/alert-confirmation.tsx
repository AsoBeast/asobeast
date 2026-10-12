import { CONFIRM_ALERT_PATH, UNSUBSCRIBE_PATH } from '@asobeast/shared';
import { CONFIRMATION_DAYS } from '../../alerts/confirmation-token';
import { AlertConfirmationEmail } from '../../alerts/emails/alert-confirmation-email';
import { PREVIEW_ORIGIN } from './preview-origin';

export default function AlertConfirmationPreview() {
  return (
    <AlertConfirmationEmail
      origin={PREVIEW_ORIGIN}
      address="alerts@example.com"
      requestedBy="ada@example.com"
      link={`${PREVIEW_ORIGIN}${CONFIRM_ALERT_PATH}?alert=ea_preview&token=preview`}
      stop={`${PREVIEW_ORIGIN}${UNSUBSCRIBE_PATH}?alert=ea_preview&token=preview`}
      days={CONFIRMATION_DAYS}
    />
  );
}
