"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, reconcileBilling } from "@/lib/api";
import {
  checkoutReturned,
  checkoutSessionId,
  trialStartedToast,
  urlWithoutCheckout,
} from "@/lib/checkout-return";
import { accountPlanOptions, invalidateAuth, refetchAuth } from "@/lib/queries";

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
        },
        async (error: unknown) => {
          if (!refused(error)) return invalidateAuth(client);
          try {
            await refetchAuth(client);
          } finally {
            forgetCheckout();
          }
        },
      )
      .catch(() => invalidateAuth(client));
  }, [client]);

  return null;
}
