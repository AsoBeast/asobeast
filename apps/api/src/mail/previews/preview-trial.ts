import type { TrialNoticeContext } from '../../billing/account-mail';

export const PREVIEW_TRIAL: TrialNoticeContext = {
  card: true,
  days: 7,
  plan: 'Indie',
  price:
    '$10 per month plus any VAT or sales tax, renewing monthly until you cancel',
  endsOn: '2026-10-17',
  timeLeft: '3 days',
  cancelling: false,
  chargeFailed: false,
};
