import { digestWithGroups } from '../../alerts/email-fixtures.fixture';
import { alertEmailElement } from '../../alerts/email-format';
import { PREVIEW_ALERT_CONTEXT } from './preview-origin';

export default function DigestWeeklyPreview() {
  return alertEmailElement(digestWithGroups, PREVIEW_ALERT_CONTEXT);
}
