import type { PaidPlanName } from './plans';

export const BILLING_INTERVALS = ['month', 'year'] as const;

export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export interface BillingPrice {
  plan: PaidPlanName;
  interval: BillingInterval;
  priceId: string;
  amountUsd: number;
}

export interface BillingCatalog {
  enabled: boolean;
  prices: BillingPrice[];
}

export interface CheckoutRequest {
  priceId: string;
}

export interface BillingSession {
  url: string;
}

export interface BillingReconcileReport {
  checked: number;
  corrected: number;
  orphanSubscriptions: string[];
  unreconciled: string[];
}
