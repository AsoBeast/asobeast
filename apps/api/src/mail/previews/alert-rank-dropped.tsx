import { dropped } from '../../alerts/email-fixtures.fixture';
import { alertEmailElement } from '../../alerts/email-format';
import { PREVIEW_ALERT_CONTEXT } from './preview-origin';

export default function AlertRankDroppedPreview() {
  return alertEmailElement(dropped, PREVIEW_ALERT_CONTEXT);
}
