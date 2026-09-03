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

    window.history.replaceState(null, "", urlWithoutCheckout(pathname, search));
    void reconcileBilling()
      .catch(() => undefined)
      .then(() => invalidateAuth(client));
  }, [client]);

  return null;
}
