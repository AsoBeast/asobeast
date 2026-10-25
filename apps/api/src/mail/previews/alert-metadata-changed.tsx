import { everyFieldChanged } from '../../alerts/email-fixtures.fixture';
import { alertEmailElement } from '../../alerts/email-format';
import {
  PREVIEW_ICON,
  PREVIEW_PREVIOUS_ICON,
  withPreviewIdentity,
} from './preview-icons';
import { PREVIEW_ALERT_CONTEXT } from './preview-origin';

const ICON_CHANGED = withPreviewIdentity({
  ...everyFieldChanged,
  changes: everyFieldChanged.changes.map((change) =>
    change.field === 'icon'
      ? { ...change, before: PREVIEW_PREVIOUS_ICON, after: PREVIEW_ICON }
      : change,
  ),
});

export default function AlertMetadataChangedPreview() {
  return alertEmailElement(ICON_CHANGED, PREVIEW_ALERT_CONTEXT);
}
