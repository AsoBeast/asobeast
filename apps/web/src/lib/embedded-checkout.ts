import type { BillingCatalog, CheckoutUi } from "@asobeast/shared";

export function sessionKeyOf(priceId: string): string {
  return `stripe-checkout-${priceId}`;
}

export function checkoutUiFor(catalog: BillingCatalog | undefined): CheckoutUi {
  return catalog?.enabled && catalog.publishableKey ? "embedded" : "hosted";
}
