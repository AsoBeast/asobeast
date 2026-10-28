import {
  chartEntered,
  chartMilestone,
  chartMoveBatch,
} from '../../alerts/chart-events.fixture';
import { batchEmailElement } from '../../alerts/email-format';
import { withPreviewIcons } from './preview-icons';
import { PREVIEW_ALERT_CONTEXT } from './preview-origin';

export default function DailyAppUpdateChartMovesPreview() {
  return batchEmailElement(
    withPreviewIcons(
      chartMoveBatch(chartEntered(), chartMilestone({ from: null, to: 7 })),
    ),
    PREVIEW_ALERT_CONTEXT,
  );
}
