import { downgradeWarning } from '../../billing/account-mail';
import { BillingNoticeEmail } from '../../billing/billing-notice-email';
import { PREVIEW_ORIGIN } from './preview-origin';

const OVER = [
  { resource: 'keywords', used: 40, limit: 20 },
  { resource: 'apps', used: 6, limit: 3 },
];

export default function DowngradeWarningPreview() {
  return (
    <BillingNoticeEmail
      mail={downgradeWarning('Indie', '2026-11-01', OVER)}
      origin={PREVIEW_ORIGIN}
    />
  );
}
