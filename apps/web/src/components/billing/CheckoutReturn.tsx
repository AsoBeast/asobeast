"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { reconcileBilling } from "@/lib/api";
import {
  checkoutReturned,
  checkoutSessionId,
  trialStartedToast,
  urlWithoutCheckout,
} from "@/lib/checkout-return";
import { accountPlanOptions, invalidateAuth, refetchAuth } from "@/lib/queries";

export function CheckoutReturn() {
  const client = useQueryClient();
  const settled = useRef(false);

  useEffect(() => {
    if (settled.current || !checkoutReturned(window.location.search)) return;
    settled.current = true;

    void reconcileBilling(checkoutSessionId(window.location.search))
      .then(async () => {
        const plan = await client.fetchQuery({
          ...accountPlanOptions,
          staleTime: 0,
        });
        const welcome = trialStartedToast(plan);
        if (welcome) toast.success(welcome);
        await refetchAuth(client);
        const { pathname, search } = window.location;
        window.history.replaceState(
          null,
          "",
          urlWithoutCheckout(pathname, search),
        );
      })
      .catch(() => invalidateAuth(client));
  }, [client]);

  return null;
}
