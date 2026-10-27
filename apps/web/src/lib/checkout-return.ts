import {
  CHECKOUT_RETURN_COMPLETE,
  CHECKOUT_RETURN_PARAM,
  CHECKOUT_SESSION_PARAM,
  type AccountPlan,
} from "@asobeast/shared";
import { formatDate } from "./format";

export function searchOf(requested: string | null): string {
  if (requested === null) return "";
  const start = requested.indexOf("?");
  return start === -1 ? "" : requested.slice(start);
}

export function checkoutReturned(search: string): boolean {
  return (
    new URLSearchParams(search).get(CHECKOUT_RETURN_PARAM) ===
    CHECKOUT_RETURN_COMPLETE
  );
}

export function pageReturnedFromCheckout(
  searchParams: Record<string, string | string[] | undefined>,
): boolean {
  const value = searchParams[CHECKOUT_RETURN_PARAM];
  return (Array.isArray(value) ? value[0] : value) === CHECKOUT_RETURN_COMPLETE;
}

export function checkoutSessionId(search: string): string | undefined {
  return new URLSearchParams(search).get(CHECKOUT_SESSION_PARAM) || undefined;
}

export function urlWithoutCheckout(pathname: string, search: string): string {
  const params = new URLSearchParams(search);
  params.delete(CHECKOUT_RETURN_PARAM);
  params.delete(CHECKOUT_SESSION_PARAM);
  const rest = params.toString();
  return rest ? `${pathname}?${rest}` : pathname;
}

export function trialStartedToast(plan: AccountPlan): string | null {
  if (!plan.trialing || !plan.renewsAt) return null;
  return `Your free trial has started. The first charge is on ${formatDate(plan.renewsAt)}.`;
}
