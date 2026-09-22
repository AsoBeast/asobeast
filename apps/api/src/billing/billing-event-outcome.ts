export const BILLING_EVENT_OUTCOMES = [
  'applied',
  'ignored',
  'orphaned',
] as const;

export type BillingEventOutcome = (typeof BILLING_EVENT_OUTCOMES)[number];
