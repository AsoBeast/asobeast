"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  BILLING_INTERVALS,
  PAID_PLAN_NAMES,
  PLANS,
  type AccountPlan,
  type BillingInterval,
  type BillingPrice,
  type PaidPlanName,
} from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError, openBillingPortal, startCheckout } from "@/lib/api";
import { formatDate, formatNumber } from "@/lib/format";
import { accountPlanOptions, billingCatalogOptions } from "@/lib/queries";

const INCLUDED = [
  "Daily keyword rank tracking across every storefront",
  "Traffic, difficulty and opportunity scoring",
  "Competitor discovery and metadata audits",
  "AI audit and metadata drafts",
  "Alerts by email and webhook",
  "Personal API tokens and the MCP server",
];

const INTERVAL_LABEL: Record<BillingInterval, string> = {
  month: "Monthly",
  year: "Annual",
};

function statusLine(plan: AccountPlan | undefined): string {
  if (!plan) return "Choose a plan to unlock asobeast.";
  if (plan.plan === "trial" && plan.trialEndsAt) {
    return `Your trial is active until ${formatDate(plan.trialEndsAt)}.`;
  }
  if (plan.trialEndsAt && !plan.entitled) {
    return `Your trial ended on ${formatDate(plan.trialEndsAt)}. Your data is still here.`;
  }
  if (plan.renewsAt) {
    return `Your ${PLANS[plan.plan].displayName} plan renews on ${formatDate(plan.renewsAt)}.`;
  }
  return "Choose a plan to unlock asobeast.";
}

function priceLabel(interval: BillingInterval, amountUsd: number): string {
  return interval === "month"
    ? `$${amountUsd} /month`
    : `$${amountUsd} /year, two months free`;
}

function actionLabel(
  current: boolean,
  subscribed: boolean,
  displayName: string,
): string {
  if (current) return "Current plan";
  if (subscribed) return "Change in the billing portal";
  return `Choose ${displayName}`;
}

function failureMessage(error: unknown, subscribed: boolean): string {
  if (error instanceof ApiError) return error.envelope.message;
  return subscribed
    ? "Could not open the billing portal. Try again."
    : "Could not start checkout. Try again.";
}

function PlanOption({
  name,
  interval,
  price,
  current,
  subscribed,
}: {
  name: PaidPlanName;
  interval: BillingInterval;
  price: BillingPrice | undefined;
  current: boolean;
  subscribed: boolean;
}) {
  const { displayName, prices, limits } = PLANS[name];
  const amountUsd =
    (interval === "month" ? prices.monthlyUsd : prices.annualUsd) ?? 0;

  const change = useMutation({
    mutationFn: () =>
      subscribed ? openBillingPortal() : startCheckout(price?.priceId ?? ""),
    onSuccess: ({ url }) => {
      window.location.assign(url);
    },
    onError: (error) => {
      toast.error(failureMessage(error, subscribed));
    },
  });

  return (
    <Card className="flex-1">
      <CardHeader>
        <CardDescription className="flex items-center gap-2">
          {displayName}
          {current ? <Badge variant="secondary">Current</Badge> : null}
        </CardDescription>
        <CardTitle asChild>
          <p>
            <span className="text-display tabular-nums">${amountUsd}</span>
            <span className="text-body text-muted-foreground">
              {interval === "month" ? " /month" : " /year"}
            </span>
          </p>
        </CardTitle>
        <p className="text-body text-muted-foreground">
          {priceLabel(interval, amountUsd)}
        </p>
      </CardHeader>
      <CardContent>
        <dl className="flex flex-col gap-1.5 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Apps</dt>
            <dd className="font-medium tabular-nums">
              {formatNumber(limits.apps ?? 0)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Keyword markets</dt>
            <dd className="font-medium tabular-nums">
              {formatNumber(limits.keywordMarkets ?? 0)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Competitors per app</dt>
            <dd className="font-medium tabular-nums">
              {formatNumber(limits.competitorsPerApp ?? 0)}
            </dd>
          </div>
        </dl>
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          disabled={current || (!subscribed && !price) || change.isPending}
          title={
            subscribed || price ? undefined : "Checkout is not configured yet"
          }
          onClick={() => change.mutate()}
        >
          {change.isPending ? <Loader2 className="animate-spin" /> : null}
          {actionLabel(current, subscribed, displayName)}
        </Button>
      </CardFooter>
    </Card>
  );
}

export function UpgradeContent() {
  const { data: plan } = useQuery(accountPlanOptions);
  const { data: catalog } = useQuery(billingCatalogOptions);
  const [interval, setInterval] = useState<BillingInterval>("month");

  const priceFor = (name: PaidPlanName) =>
    catalog?.prices.find(
      (price) => price.plan === name && price.interval === interval,
    );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex flex-col gap-1">
          <h1 className="text-display tracking-tight text-balance">
            Keep optimizing without limits
          </h1>
          <p className="text-body text-muted-foreground">{statusLine(plan)}</p>
        </div>
        <Tabs
          value={interval}
          onValueChange={(next) => setInterval(next as BillingInterval)}
        >
          <TabsList aria-label="Billing interval">
            {BILLING_INTERVALS.map((value) => (
              <TabsTrigger key={value} value={value}>
                {INTERVAL_LABEL[value]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        {PAID_PLAN_NAMES.map((name) => (
          <PlanOption
            key={name}
            name={name}
            interval={interval}
            price={priceFor(name)}
            current={plan?.plan === name}
            subscribed={plan?.subscribed ?? false}
          />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle asChild>
            <h2>Every plan includes</h2>
          </CardTitle>
          <CardDescription>
            The difference between the plans is volume, never features.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            {INCLUDED.map((feature) => (
              <li key={feature} className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-success" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </CardContent>
        <CardFooter>
          <p className="text-caption text-muted-foreground">
            {catalog?.enabled
              ? "Payments are handled by Stripe. Cancel any time from settings."
              : "Checkout is not configured on this instance."}{" "}
            Need help?{" "}
            <a
              href="mailto:hello@asobeast.dev"
              className="font-medium underline"
            >
              Contact support
            </a>
            .
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
