import {
  CHECKOUT_RETURN_COMPLETE,
  CHECKOUT_RETURN_PARAM,
} from "@asobeast/shared";

export function checkoutReturned(search: string): boolean {
  return (
    new URLSearchParams(search).get(CHECKOUT_RETURN_PARAM) ===
    CHECKOUT_RETURN_COMPLETE
  );
}

export function urlWithoutCheckout(pathname: string, search: string): string {
  const params = new URLSearchParams(search);
  params.delete(CHECKOUT_RETURN_PARAM);
  const rest = params.toString();
  return rest ? `${pathname}?${rest}` : pathname;
}
