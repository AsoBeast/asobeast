import { chartEntered } from '../../alerts/chart-events.fixture';
import { alertEmailElement } from '../../alerts/email-format';
import { withPreviewIdentity } from './preview-icons';
import { PREVIEW_ALERT_CONTEXT } from './preview-origin';

export default function AlertChartEnteredPreview() {
  return alertEmailElement(
    withPreviewIdentity(chartEntered()),
    PREVIEW_ALERT_CONTEXT,
  );
}
