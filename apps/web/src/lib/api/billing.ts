import type {
  BillingCatalog,
  BillingReconcileReport,
  BillingSession,
  CheckoutRequest,
} from "@asobeast/shared";
import { ApiError, apiFetch } from "./client";

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

export function reconcileBilling(): Promise<BillingReconcileReport> {
  return apiFetch<BillingReconcileReport>("/billing/reconcile", {
    method: "POST",
  });
}

export function recoversInPortal(error: unknown): boolean {
  return (
    error instanceof ApiError && error.envelope.billing?.recovery === "portal"
  );
}
