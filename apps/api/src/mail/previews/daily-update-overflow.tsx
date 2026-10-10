import { worstCaseBatch } from '../../alerts/email-fixtures.fixture';
import { batchEmailElement } from '../../alerts/email-format';
import { PREVIEW_ALERT_CONTEXT } from './preview-origin';

const OVERFLOWING = worstCaseBatch(null);

export default function DailyUpdateOverflowPreview() {
  return batchEmailElement(
    { ...OVERFLOWING, apps: OVERFLOWING.apps.slice(0, 1) },
    PREVIEW_ALERT_CONTEXT,
  );
}
