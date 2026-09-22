import Stripe from 'stripe';

export const STRIPE_API_VERSION = '2026-08-26.dahlia';

export const STRIPE_TIMEOUT_MS = 20_000;

export const STRIPE_MAX_NETWORK_RETRIES = 2;

export const STRIPE_APP_INFO = {
  name: 'asobeast',
  url: 'https://github.com/AsoBeast/asobeast',
};

export const STRIPE_CLIENT = 'STRIPE_CLIENT';

export interface StripeApi {
  customers: Pick<Stripe['customers'], 'create' | 'del'>;
  checkout: {
    sessions: Pick<
      Stripe['checkout']['sessions'],
      'create' | 'retrieve' | 'expire'
    >;
  };
  subscriptions: Pick<Stripe['subscriptions'], 'list' | 'retrieve'>;
  subscriptionSchedules: Pick<Stripe['subscriptionSchedules'], 'retrieve'>;
  billingPortal: {
    sessions: Pick<Stripe['billingPortal']['sessions'], 'create'>;
  };
  webhooks: Pick<Stripe['webhooks'], 'constructEvent'>;
}

export type StripeClient = StripeApi | null;

export function createStripeClient(
  secretKey: string | undefined,
): Stripe | null {
  if (!secretKey) return null;
  return new Stripe(secretKey, {
    apiVersion: STRIPE_API_VERSION,
    maxNetworkRetries: STRIPE_MAX_NETWORK_RETRIES,
    timeout: STRIPE_TIMEOUT_MS,
    appInfo: STRIPE_APP_INFO,
    typescript: true,
  });
}
