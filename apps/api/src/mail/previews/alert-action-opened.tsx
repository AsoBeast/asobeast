import { actionOpened } from '../../alerts/email-fixtures.fixture';
import { alertEmailElement } from '../../alerts/email-format';
import { PREVIEW_ORIGIN } from './preview-origin';

export default function AlertActionOpenedPreview() {
  return alertEmailElement(actionOpened, { origin: PREVIEW_ORIGIN });
}
