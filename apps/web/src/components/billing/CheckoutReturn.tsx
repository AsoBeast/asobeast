"use client";

import { useEffect, useRef } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, reconcileBilling } from "@/lib/api";
import { entryDestination } from "@/lib/auth-routes";
import {
  checkoutReturned,
  checkoutSessionId,
  trialStartedToast,
  urlWithoutCheckout,
} from "@/lib/checkout-return";
import {
  accountPlanOptions,
  authMeOptions,
  invalidateAuth,
  refetchAuth,
} from "@/lib/queries";

const SETTLED_REFUSALS: ReadonlySet<number> = new Set([400, 401, 403, 404]);

function refused(error: unknown): boolean {
  return (
    error instanceof ApiError && SETTLED_REFUSALS.has(error.envelope.statusCode)
  );
}

function forgetCheckout(): void {
  const { pathname, search } = window.location;
  window.history.replaceState(null, "", urlWithoutCheckout(pathname, search));
}

function refreshedAccount(client: QueryClient) {
  const account = client.getQueryState(authMeOptions.queryKey);
  return account?.isInvalidated ? undefined : account?.data;
}

function leaveForTheOwedStep(client: QueryClient): void {
  const user = refreshedAccount(client);
  if (!user?.entryStep) return;
  const destination = entryDestination(user, null);
  if (window.location.pathname !== destination) {
    window.location.replace(destination);
  }
}

export function CheckoutReturn() {
  const client = useQueryClient();
  const settled = useRef(false);

  useEffect(() => {
    if (settled.current || !checkoutReturned(window.location.search)) return;
    settled.current = true;

    void reconcileBilling(checkoutSessionId(window.location.search))
      .then(
        async () => {
          const plan = await client.fetchQuery({
            ...accountPlanOptions,
            staleTime: 0,
          });
          const welcome = trialStartedToast(plan);
          if (welcome) toast.success(welcome);
          await refetchAuth(client);
          forgetCheckout();
          leaveForTheOwedStep(client);
        },
        async (error: unknown) => {
          if (!refused(error)) return invalidateAuth(client);
          try {
            await refetchAuth(client);
          } finally {
            forgetCheckout();
            leaveForTheOwedStep(client);
          }
        },
      )
      .catch(() => invalidateAuth(client));
  }, [client]);

  return null;
}
