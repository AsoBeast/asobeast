import { UNSUBSCRIBE_PATH } from '@asobeast/shared';
import type { AlertEmailContext } from '../../alerts/emails/alert-footer';

export const PREVIEW_ORIGIN = 'http://localhost:3000';

export const PREVIEW_ALERT_CONTEXT: AlertEmailContext = {
  origin: PREVIEW_ORIGIN,
  unsubscribe: `${PREVIEW_ORIGIN}${UNSUBSCRIBE_PATH}?alert=ea_preview&token=preview`,
};
