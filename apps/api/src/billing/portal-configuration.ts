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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export function configurationCovers(
  actual: unknown,
  expected: unknown,
): boolean {
  if (Array.isArray(expected)) {
    return (
      Array.isArray(actual) &&
      actual.length === expected.length &&
      expected.every((item) =>
        actual.some((candidate) => configurationCovers(candidate, item)),
      )
    );
  }
  if (isRecord(expected)) {
    return (
      isRecord(actual) &&
      Object.entries(expected).every(([key, value]) =>
        configurationCovers(actual[key], value),
      )
    );
  }
  return actual === expected;
}

export type PortalConfigurations = Pick<
  Stripe['billingPortal']['configurations'],
  'list' | 'update' | 'create'
>;

export async function syncPortal(
  configurations: PortalConfigurations,
  desired: Stripe.BillingPortal.ConfigurationCreateParams,
  say: (line: string) => void,
): Promise<string> {
  const found = await configurations.list({ is_default: true, limit: 1 });
  const current = found.data[0];
  if (current && configurationCovers(current, desired)) return current.id;

  if (current) {
    await configurations.update(current.id, desired);
    say(`updated portal configuration ${current.id}`);
    return current.id;
  }
  const created = await configurations.create(desired);
  say(`created portal configuration ${created.id}`);
  if (!created.is_default) {
    say(`mark portal configuration ${created.id} as default in the dashboard`);
  }
  return created.id;
}
