import { trialNotice } from '../../billing/account-mail';
import { BillingNoticeEmail } from '../../billing/billing-notice-email';
import { PREVIEW_ORIGIN } from './preview-origin';
import { PREVIEW_TRIAL } from './preview-trial';

export default function TrialDay0Preview() {
  return (
    <BillingNoticeEmail
      mail={trialNotice(0, PREVIEW_TRIAL)}
      origin={PREVIEW_ORIGIN}
    />
  );
}
