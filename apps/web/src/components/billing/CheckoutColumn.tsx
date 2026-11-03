"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  PLANS,
  planPriceLabel,
  type AccountPlan,
  type BillingCatalog,
  type BillingInterval,
  type BillingPrice,
  type PaidPlanName,
} from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ApiError,
  openBillingPortal,
  recoversInPortal,
  startCheckout,
} from "@/lib/api";
import {
  planActionLabel,
  trialPaymentNote,
  type PlanAction,
} from "@/lib/plan-choice";
import { checkoutUiFor, sessionKeyOf } from "@/lib/embedded-checkout";
import { invalidateAuth } from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";
import { EmbeddedCheckout } from "./EmbeddedCheckout";

const BUYS: readonly PlanAction[] = ["checkout", "trial"];

const INTERVAL_WORD: Record<BillingInterval, string> = {
  month: "monthly",
  year: "annual",
};

function failureMessage(error: unknown, action: PlanAction): string {
  if (error instanceof ApiError) return error.envelope.message;
  return BUYS.includes(action)
    ? "Could not start checkout. Try again."
    : "Could not open the billing portal. Try again.";
}

function HostedAction({
  action,
  label,
  price,
}: {
  action: PlanAction;
  label: string;
  price: BillingPrice | undefined;
}) {
  const client = useQueryClient();
  const buys = BUYS.includes(action);
  const change = useMutation({
    mutationFn: () =>
      buys
        ? startCheckout(price?.priceId ?? "", "hosted")
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
      className="w-full"
      disabled={
        action === "current" ||
        action === "pending" ||
        (buys && !price) ||
        change.isPending
      }
      title={!buys || price ? undefined : "Checkout is not configured yet"}
      onClick={() => changeOnce()}
    >
      {change.isPending ? <Loader2 className="animate-spin" /> : null}
      {label}
    </Button>
  );
}

export function CheckoutColumn({
  plan,
  catalog,
  name,
  interval,
  action,
  now,
}: {
  plan: AccountPlan | undefined;
  catalog: BillingCatalog | undefined;
  name: PaidPlanName;
  interval: BillingInterval;
  action: PlanAction;
  now: Date;
}) {
  const { displayName } = PLANS[name];
  const price = catalog?.prices.find(
    (candidate) => candidate.plan === name && candidate.interval === interval,
  );
  const label = planActionLabel(action, displayName);
  const offer = plan?.trialOffer;
  const publishableKey = catalog?.publishableKey;
  const embedded =
    checkoutUiFor(catalog) === "embedded" &&
    BUYS.includes(action) &&
    price !== undefined &&
    publishableKey !== undefined;

  return (
    <Card className="min-w-0 lg:sticky lg:top-6">
      <CardHeader>
        <CardTitle asChild>
          <h2>{embedded ? label : displayName}</h2>
        </CardTitle>
        <CardDescription>
          {embedded ? `${displayName}: ` : null}
          {action === "trial" && offer
            ? `${offer.days} days free, then ${planPriceLabel(name, interval)}.`
            : `${planPriceLabel(name, interval)}.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {embedded ? (
          <EmbeddedCheckout
            key={sessionKeyOf(price.priceId)}
            publishableKey={publishableKey}
            priceId={price.priceId}
            label={`Stripe checkout for ${displayName}, ${INTERVAL_WORD[interval]}`}
          />
        ) : (
          <HostedAction action={action} label={label} price={price} />
        )}
      </CardContent>
      <CardFooter>
        <p className="text-caption text-muted-foreground">
          {trialPaymentNote(catalog, action === "trial" ? offer : null, now)}{" "}
          Need help?{" "}
          <a href="mailto:hello@asobeast.dev" className="font-medium underline">
            Contact support
          </a>
          .
        </p>
      </CardFooter>
    </Card>
  );
}
