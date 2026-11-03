"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { BillingPrice } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import {
  ApiError,
  openBillingPortal,
  recoversInPortal,
  startCheckout,
} from "@/lib/api";
import {
  CHECKOUT_PRICE_MISSING,
  CHECKOUT_START_FAILED,
  PORTAL_OPEN_FAILED,
  buysPlan,
  type PlanAction,
} from "@/lib/plan-choice";
import { invalidateAuth } from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";
import { useCheckoutTheme } from "./use-checkout-theme";

function failureMessage(error: unknown, action: PlanAction): string {
  if (error instanceof ApiError) return error.envelope.message;
  return buysPlan(action) ? CHECKOUT_START_FAILED : PORTAL_OPEN_FAILED;
}

export function HostedAction({
  action,
  label,
  price,
}: {
  action: PlanAction;
  label: string;
  price: BillingPrice | undefined;
}) {
  const client = useQueryClient();
  const buys = buysPlan(action);
  const theme = useCheckoutTheme();
  const change = useMutation({
    mutationFn: () => {
      if (!buys) return openBillingPortal();
      if (!price) return Promise.reject(new Error(CHECKOUT_PRICE_MISSING));
      return startCheckout(price.priceId, "hosted", theme);
    },
    onSuccess: ({ url }) => {
      window.location.assign(url);
    },
    onError: (error) => {
      if (recoversInPortal(error)) invalidateAuth(client);
      toast.error(failureMessage(error, action));
    },
  });
  const changeOnce = useSingleFlight(change);

  return (
    <Button
      size="xl"
      className="w-full sm:w-auto sm:min-w-72"
      disabled={
        action === "current" || action === "pending" || (buys && !price)
      }
      aria-disabled={change.isPending || undefined}
      title={!buys || price ? undefined : CHECKOUT_PRICE_MISSING}
      onClick={() => {
        if (!change.isPending) changeOnce();
      }}
    >
      {change.isPending ? <Loader2 className="animate-spin" /> : null}
      {label}
    </Button>
  );
}
