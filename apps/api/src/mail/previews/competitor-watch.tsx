import { competitorBatch } from '../../alerts/email-fixtures.fixture';
import { batchEmailElement } from '../../alerts/email-format';
import { PREVIEW_ORIGIN } from './preview-origin';

export default function CompetitorWatchPreview() {
  return batchEmailElement(competitorBatch, { origin: PREVIEW_ORIGIN });
}
