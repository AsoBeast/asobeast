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
import { buysPlan, type PlanAction } from "@/lib/plan-choice";
import { invalidateAuth } from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";
import { useCheckoutTheme } from "./use-checkout-theme";

function failureMessage(error: unknown, action: PlanAction): string {
  if (error instanceof ApiError) return error.envelope.message;
  return buysPlan(action)
    ? "Could not start checkout. Try again."
    : "Could not open the billing portal. Try again.";
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
    mutationFn: () =>
      buys
        ? startCheckout(price?.priceId ?? "", "hosted", theme)
        : openBillingPortal(),
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
      className="w-full sm:w-auto"
      disabled={
        action === "current" || action === "pending" || (buys && !price)
      }
      aria-disabled={change.isPending || undefined}
      title={!buys || price ? undefined : "Checkout is not configured yet"}
      onClick={() => {
        if (!change.isPending) changeOnce();
      }}
    >
      {change.isPending ? <Loader2 className="animate-spin" /> : null}
      {label}
    </Button>
  );
}
