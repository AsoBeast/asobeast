import { dropped } from '../../alerts/email-fixtures.fixture';
import { alertEmailElement } from '../../alerts/email-format';
import { withPreviewIdentity } from './preview-icons';
import { PREVIEW_ALERT_CONTEXT } from './preview-origin';

export default function AlertRankDroppedPreview() {
  return alertEmailElement(withPreviewIdentity(dropped), PREVIEW_ALERT_CONTEXT);
}
