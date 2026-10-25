import { batch } from '../../alerts/email-fixtures.fixture';
import { batchEmailElement } from '../../alerts/email-format';
import { withPreviewIcons } from './preview-icons';
import { PREVIEW_ALERT_CONTEXT } from './preview-origin';

export default function DailyAppUpdatePreview() {
  return batchEmailElement(withPreviewIcons(batch), PREVIEW_ALERT_CONTEXT);
}
