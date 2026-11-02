import { actionOpened } from '../../alerts/email-fixtures.fixture';
import { alertEmailElement } from '../../alerts/email-format';
import { withPreviewIdentity } from './preview-icons';
import { PREVIEW_ALERT_CONTEXT } from './preview-origin';

export default function AlertActionOpenedPreview() {
  return alertEmailElement(
    withPreviewIdentity(actionOpened),
    PREVIEW_ALERT_CONTEXT,
  );
}
