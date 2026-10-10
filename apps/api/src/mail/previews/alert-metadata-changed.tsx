import { everyFieldChanged } from '../../alerts/email-fixtures.fixture';
import { alertEmailElement } from '../../alerts/email-format';
import { PREVIEW_ORIGIN } from './preview-origin';

export default function AlertMetadataChangedPreview() {
  return alertEmailElement(everyFieldChanged, { origin: PREVIEW_ORIGIN });
}
