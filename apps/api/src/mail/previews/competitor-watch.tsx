import { competitorBatch } from '../../alerts/email-fixtures.fixture';
import { batchEmailElement } from '../../alerts/email-format';
import { PREVIEW_ALERT_CONTEXT } from './preview-origin';

export default function CompetitorWatchPreview() {
  return batchEmailElement(competitorBatch, PREVIEW_ALERT_CONTEXT);
}
