import { trialNotice } from '../../billing/account-mail';
import { BillingNoticeEmail } from '../../billing/billing-notice-email';
import { PREVIEW_ORIGIN } from './preview-origin';

export default function TrialDay8Preview() {
  return (
    <BillingNoticeEmail
      mail={trialNotice(8, '2026-10-17')}
      origin={PREVIEW_ORIGIN}
    />
  );
}
