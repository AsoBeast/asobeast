"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { reconcileBilling } from "@/lib/api";
import { checkoutReturned, urlWithoutCheckout } from "@/lib/checkout-return";
import { invalidateAuth } from "@/lib/queries";

export function CheckoutReturn() {
  const client = useQueryClient();
  const settled = useRef(false);

  useEffect(() => {
    if (settled.current || !checkoutReturned(window.location.search)) return;
    settled.current = true;

    void reconcileBilling()
      .then(() => {
        const { pathname, search } = window.location;
        window.history.replaceState(
          null,
          "",
          urlWithoutCheckout(pathname, search),
        );
      })
      .catch(() => undefined)
      .finally(() => {
        invalidateAuth(client);
      });
  }, [client]);

  return null;
}
