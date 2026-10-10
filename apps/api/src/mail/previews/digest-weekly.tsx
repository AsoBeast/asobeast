import { digestWithGroups } from '../../alerts/email-fixtures.fixture';
import { alertEmailElement } from '../../alerts/email-format';
import { PREVIEW_ORIGIN } from './preview-origin';

export default function DigestWeeklyPreview() {
  return alertEmailElement(digestWithGroups, { origin: PREVIEW_ORIGIN });
}
