import type {
  BillingCatalog,
  CheckoutTheme,
  CheckoutUi,
} from "@asobeast/shared";

export function sessionKeyOf(priceId: string, theme: CheckoutTheme): string {
  return `stripe-checkout-${priceId}-${theme}`;
}

export function checkoutThemeOf(
  resolvedTheme: string | undefined,
): CheckoutTheme {
  return resolvedTheme === "dark" ? "dark" : "light";
}

export function checkoutUiFor(catalog: BillingCatalog | undefined): CheckoutUi {
  return catalog?.enabled && catalog.publishableKey ? "embedded" : "hosted";
}
