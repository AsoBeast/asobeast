import Stripe from 'stripe';

export const STRIPE_API_VERSION = '2026-07-29.dahlia';

export const STRIPE_CLIENT = 'STRIPE_CLIENT';

export type StripeClient = Stripe | null;

export function createStripeClient(
  secretKey: string | undefined,
): StripeClient {
  if (!secretKey) return null;
  return new Stripe(secretKey, {
    apiVersion: STRIPE_API_VERSION,
    maxNetworkRetries: 2,
    typescript: true,
  });
}
