import { dropped } from '../../alerts/email-fixtures.fixture';
import { alertEmailElement } from '../../alerts/email-format';
import { PREVIEW_ORIGIN } from './preview-origin';

export default function AlertRankDroppedPreview() {
  return alertEmailElement(dropped, { origin: PREVIEW_ORIGIN });
}
