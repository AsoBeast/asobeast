"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { BillingPrice } from "@asobeast/shared";
import type { MessageTranslator } from "@/i18n/translator";
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

function failureMessage(
  error: unknown,
  action: PlanAction,
  t: MessageTranslator,
): string {
  if (error instanceof ApiError) return error.envelope.message;
  return t(buysPlan(action) ? "checkout.startFailed" : "checkout.portalFailed");
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
  const t = useTranslations("billing");
  const client = useQueryClient();
  const buys = buysPlan(action);
  const theme = useCheckoutTheme();
  const change = useMutation({
    mutationFn: () => {
      if (!buys) return openBillingPortal();
      if (!price) return Promise.reject(new Error(t("checkout.priceMissing")));
      return startCheckout(price.priceId, "hosted", theme);
    },
    onSuccess: ({ url }) => {
      window.location.assign(url);
    },
    onError: (error) => {
      if (recoversInPortal(error)) invalidateAuth(client);
      toast.error(failureMessage(error, action, t));
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
      title={!buys || price ? undefined : t("checkout.priceMissing")}
      onClick={() => {
        if (!change.isPending) changeOnce();
      }}
    >
      {change.isPending ? <Loader2 className="animate-spin" /> : null}
      {label}
    </Button>
  );
}
