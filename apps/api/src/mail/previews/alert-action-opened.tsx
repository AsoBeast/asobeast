import { actionOpened } from '../../alerts/email-fixtures.fixture';
import { alertEmailElement } from '../../alerts/email-format';
import { PREVIEW_ALERT_CONTEXT } from './preview-origin';

export default function AlertActionOpenedPreview() {
  return alertEmailElement(actionOpened, PREVIEW_ALERT_CONTEXT);
}
