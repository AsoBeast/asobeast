import { paymentFailed } from '../../billing/account-mail';
import { BillingNoticeEmail } from '../../billing/billing-notice-email';
import { PREVIEW_ORIGIN } from './preview-origin';

export default function PaymentFailedPreview() {
  return <BillingNoticeEmail mail={paymentFailed()} origin={PREVIEW_ORIGIN} />;
}
