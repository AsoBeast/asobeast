import type { Stripe } from "@stripe/stripe-js";

const loads = new Map<string, Promise<Stripe | null>>();

export function loadStripeOnce(publishableKey: string): Promise<Stripe | null> {
  const cached = loads.get(publishableKey);
  if (cached) return cached;
  const load = import("@stripe/stripe-js")
    .then(({ loadStripe }) => loadStripe(publishableKey))
    .catch((error: unknown) => {
      loads.delete(publishableKey);
      throw error;
    });
  loads.set(publishableKey, load);
  return load;
}
