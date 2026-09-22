import type Stripe from 'stripe';

export const LEGAL_TERMS_URL = 'https://docs.asobeast.com/legal/terms';

export const LEGAL_PRIVACY_URL = 'https://docs.asobeast.com/legal/privacy';

export const SAAS_TAX_CODE = 'txcd_10103001';

export const PORTAL_HEADLINE = 'asobeast';

export const PORTAL_CANCELLATION_REASONS = [
  'too_expensive',
  'missing_features',
  'switched_service',
  'unused',
  'other',
] as const;

export const PORTAL_CUSTOMER_UPDATES = [
  'name',
  'email',
  'address',
  'phone',
  'tax_id',
] as const;

export interface PortalProduct {
  id: string;
  prices: string[];
}

export interface PortalInput {
  products: PortalProduct[];
  termsUrl: string;
  privacyUrl: string;
  returnUrl?: string;
}

export function portalConfiguration(
  input: PortalInput,
): Stripe.BillingPortal.ConfigurationCreateParams {
  return {
    business_profile: {
      headline: PORTAL_HEADLINE,
      terms_of_service_url: input.termsUrl,
      privacy_policy_url: input.privacyUrl,
    },
    features: {
      subscription_cancel: {
        enabled: true,
        mode: 'at_period_end',
        proration_behavior: 'none',
        cancellation_reason: {
          enabled: true,
          options: [...PORTAL_CANCELLATION_REASONS],
        },
      },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ['price'],
        proration_behavior: 'always_invoice',
        products: input.products.map((product) => ({
          product: product.id,
          prices: product.prices,
        })),
        schedule_at_period_end: {
          conditions: [
            { type: 'decreasing_item_amount' },
            { type: 'shortening_interval' },
          ],
        },
      },
      customer_update: {
        enabled: true,
        allowed_updates: [...PORTAL_CUSTOMER_UPDATES],
      },
      payment_method_update: { enabled: true },
      invoice_history: { enabled: true },
    },
    login_page: { enabled: false },
    ...(input.returnUrl ? { default_return_url: input.returnUrl } : {}),
  };
}
