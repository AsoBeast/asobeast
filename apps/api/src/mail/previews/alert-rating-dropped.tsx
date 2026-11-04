import { alertEmailElement } from '../../alerts/email-format';
import { ratingDropped } from '../../alerts/listing-events.fixture';
import { withPreviewIdentity } from './preview-icons';
import { PREVIEW_ALERT_CONTEXT } from './preview-origin';

export default function AlertRatingDroppedPreview() {
  return alertEmailElement(
    withPreviewIdentity(ratingDropped({ version: '2.4', actionId: 'act_1' })),
    PREVIEW_ALERT_CONTEXT,
  );
}
