import { newReview } from '../../alerts/email-fixtures.fixture';
import { alertEmailElement } from '../../alerts/email-format';
import { withPreviewIdentity } from './preview-icons';
import { PREVIEW_ALERT_CONTEXT } from './preview-origin';

export default function AlertReviewNewPreview() {
  return alertEmailElement(
    withPreviewIdentity(newReview),
    PREVIEW_ALERT_CONTEXT,
  );
}
