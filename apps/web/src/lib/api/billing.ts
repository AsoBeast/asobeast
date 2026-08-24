import type {
  BillingCatalog,
  BillingSession,
  CheckoutRequest,
} from "@asobeast/shared";
import { apiFetch } from "./client";

export function getBillingCatalog(): Promise<BillingCatalog> {
  return apiFetch<BillingCatalog>("/billing/catalog");
}

export function startCheckout(priceId: string): Promise<BillingSession> {
  return apiFetch<BillingSession>("/billing/checkout", {
    method: "POST",
    body: JSON.stringify({ priceId } satisfies CheckoutRequest),
  });
}

export function openBillingPortal(): Promise<BillingSession> {
  return apiFetch<BillingSession>("/billing/portal", { method: "POST" });
}
