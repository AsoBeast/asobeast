import { trialChargeFailed } from '../../billing/account-mail';
import { BillingNoticeEmail } from '../../billing/billing-notice-email';
import { PREVIEW_ORIGIN } from './preview-origin';

export default function TrialChargeFailedPreview() {
  return (
    <BillingNoticeEmail mail={trialChargeFailed()} origin={PREVIEW_ORIGIN} />
  );
}
