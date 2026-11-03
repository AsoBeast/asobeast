import type {
  BillingCatalog,
  CheckoutTheme,
  CheckoutUi,
} from "@asobeast/shared";

export const OPEN_TURN_MS = 40_000;

let opening: Promise<unknown> = Promise.resolve();

function turnEnds(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, OPEN_TURN_MS));
}

export function openAfterPrevious<T>(open: () => Promise<T>): Promise<T> {
  const next = opening.then(open);
  opening = Promise.race([next, turnEnds()]).catch(() => undefined);
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
