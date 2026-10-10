import { everyFieldChanged } from '../../alerts/email-fixtures.fixture';
import { alertEmailElement } from '../../alerts/email-format';
import { PREVIEW_ALERT_CONTEXT } from './preview-origin';

export default function AlertMetadataChangedPreview() {
  return alertEmailElement(everyFieldChanged, PREVIEW_ALERT_CONTEXT);
}
