import { negative } from '../../alerts/email-fixtures.fixture';
import { alertEmailElement } from '../../alerts/email-format';
import { PREVIEW_ALERT_CONTEXT } from './preview-origin';

export default function AlertReviewNegativePreview() {
  return alertEmailElement(negative, PREVIEW_ALERT_CONTEXT);
}
