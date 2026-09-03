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
    const { pathname, search } = window.location;
    if (settled.current || !checkoutReturned(search)) return;
    settled.current = true;

    void reconcileBilling()
      .then(() => {
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
