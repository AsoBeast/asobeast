import type Stripe from 'stripe';

export function isMissingResource(error: unknown): boolean {
  const stripeError = error as Partial<Stripe.errors.StripeError> | null;
  return (
    stripeError?.code === 'resource_missing' || stripeError?.statusCode === 404
  );
}

export function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
