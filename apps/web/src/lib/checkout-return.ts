const CHECKOUT_PARAM = "checkout";

const CHECKOUT_COMPLETE = "complete";

export function checkoutReturned(search: string): boolean {
  return new URLSearchParams(search).get(CHECKOUT_PARAM) === CHECKOUT_COMPLETE;
}

export function urlWithoutCheckout(pathname: string, search: string): string {
  const params = new URLSearchParams(search);
  params.delete(CHECKOUT_PARAM);
  const rest = params.toString();
  return rest ? `${pathname}?${rest}` : pathname;
}
