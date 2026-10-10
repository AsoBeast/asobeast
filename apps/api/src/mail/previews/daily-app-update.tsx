import { batch } from '../../alerts/email-fixtures.fixture';
import { batchEmailElement } from '../../alerts/email-format';
import { PREVIEW_ORIGIN } from './preview-origin';

export default function DailyAppUpdatePreview() {
  return batchEmailElement(batch, { origin: PREVIEW_ORIGIN });
}
