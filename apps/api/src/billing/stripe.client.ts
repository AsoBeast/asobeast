import Stripe from 'stripe';

export const STRIPE_API_VERSION = '2026-08-26.dahlia';

export const STRIPE_TIMEOUT_MS = 20_000;

export const STRIPE_MAX_NETWORK_RETRIES = 2;

export const STRIPE_APP_INFO = {
  name: 'asobeast',
  url: 'https://github.com/AsoBeast/asobeast',
};

export const STRIPE_CLIENT = 'STRIPE_CLIENT';

export type StripeClient = Stripe | null;

export function createStripeClient(
  secretKey: string | undefined,
): StripeClient {
  if (!secretKey) return null;
  return new Stripe(secretKey, {
    apiVersion: STRIPE_API_VERSION,
    maxNetworkRetries: STRIPE_MAX_NETWORK_RETRIES,
    timeout: STRIPE_TIMEOUT_MS,
    appInfo: STRIPE_APP_INFO,
    typescript: true,
  });
}
