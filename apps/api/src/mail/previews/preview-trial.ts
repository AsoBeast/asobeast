import { planRenewalTerms } from '@asobeast/shared';
import type { TrialNoticeContext } from '../../billing/account-mail';

export const PREVIEW_TRIAL: TrialNoticeContext = {
  card: true,
  days: 7,
  plan: 'Indie',
  price: planRenewalTerms('indie', 'month'),
  endsOn: '2026-10-17',
  timeLeft: '3 days',
  cancelling: false,
  chargeFailed: false,
};
