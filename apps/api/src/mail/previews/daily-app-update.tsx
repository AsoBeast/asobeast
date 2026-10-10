import { batch } from '../../alerts/email-fixtures.fixture';
import { batchEmailElement } from '../../alerts/email-format';
import { PREVIEW_ALERT_CONTEXT } from './preview-origin';

export default function DailyAppUpdatePreview() {
  return batchEmailElement(batch, PREVIEW_ALERT_CONTEXT);
}
