import type { TrialNoticeContext } from '../../billing/account-mail';

export const PREVIEW_TRIAL: TrialNoticeContext = {
  card: true,
  days: 7,
  plan: 'Indie',
  price: '$10 per month',
  endsOn: '2026-10-17',
  cancelling: false,
  chargeFailed: false,
};
