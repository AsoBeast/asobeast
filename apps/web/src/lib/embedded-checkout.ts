import type {
  BillingCatalog,
  CheckoutTheme,
  CheckoutUi,
} from "@asobeast/shared";

let opening: Promise<unknown> = Promise.resolve();

export function openAfterPrevious<T>(open: () => Promise<T>): Promise<T> {
  const next = opening.then(open);
  opening = next.catch(() => undefined);
  return next;
}

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
