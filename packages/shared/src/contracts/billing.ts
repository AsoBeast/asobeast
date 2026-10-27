import { PRODUCT_NAME } from '../brand';
import { PLANS, type PaidPlanName } from './plans';

export const CHECKOUT_RETURN_PARAM = 'checkout';

export const CHECKOUT_RETURN_COMPLETE = 'complete';

export const CHECKOUT_SESSION_PARAM = 'session_id';

export const BILLING_INTERVALS = ['month', 'year'] as const;

export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export function billingIntervalOf(
  value: string | null | undefined,
): BillingInterval | null {
  return BILLING_INTERVALS.find((interval) => interval === value) ?? null;
}

export function planPriceLabel(
  plan: PaidPlanName,
  interval: BillingInterval,
): string {
  const { monthlyUsd, annualUsd } = PLANS[plan].prices;
  return `$${(interval === 'month' ? monthlyUsd : annualUsd) ?? 0} per ${interval}`;
}

export interface BillingPrice {
  plan: PaidPlanName;
  interval: BillingInterval;
  priceId: string;
  amountUsd: number;
}

export interface BillingCatalog {
  enabled: boolean;
  prices: BillingPrice[];
  managedPayments?: boolean;
  publishableKey?: string;
}

export const CHECKOUT_UIS = ['hosted', 'embedded'] as const;

export type CheckoutUi = (typeof CHECKOUT_UIS)[number];

export const CHECKOUT_THEMES = ['light', 'dark'] as const;

export type CheckoutTheme = (typeof CHECKOUT_THEMES)[number];

export interface CheckoutBrand {
  backgroundColor: string;
  buttonColor: string;
  borderStyle: 'rounded';
  fontFamily: 'inter';
  displayName: string;
}

const CHECKOUT_BUTTON_COLOR = '#f89820';

export const CHECKOUT_BRAND: Record<CheckoutTheme, CheckoutBrand> = {
  light: {
    backgroundColor: '#fbfaf8',
    buttonColor: CHECKOUT_BUTTON_COLOR,
    borderStyle: 'rounded',
    fontFamily: 'inter',
    displayName: PRODUCT_NAME,
  },
  dark: {
    backgroundColor: '#110f0c',
    buttonColor: CHECKOUT_BUTTON_COLOR,
    borderStyle: 'rounded',
    fontFamily: 'inter',
    displayName: PRODUCT_NAME,
  },
};

export interface CheckoutRequest {
  priceId: string;
  ui?: CheckoutUi;
  theme?: CheckoutTheme;
}

export interface ReconcileRequest {
  sessionId?: string;
}

export interface BillingSession {
  url: string;
  clientSecret?: string;
}

export interface TrialOffer {
  days: number;
}

export interface BillingReconcileReport {
  checked: number;
  corrected: number;
  orphanSubscriptions: string[];
  unreconciled: string[];
}
