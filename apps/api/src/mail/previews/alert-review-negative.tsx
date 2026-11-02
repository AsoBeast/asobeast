import { negative } from '../../alerts/email-fixtures.fixture';
import { alertEmailElement } from '../../alerts/email-format';
import { withPreviewIdentity } from './preview-icons';
import { PREVIEW_ALERT_CONTEXT } from './preview-origin';

export default function AlertReviewNegativePreview() {
  return alertEmailElement(
    withPreviewIdentity(negative),
    PREVIEW_ALERT_CONTEXT,
  );
}
