"use client";

import {
  BILLING_INTERVALS,
  PAID_PLAN_NAMES,
  PLANS,
  type BillingInterval,
  type PaidPlanName,
} from "@asobeast/shared";
import { Check } from "lucide-react";
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
import { Tabs, TabsList, TabsOption } from "@/components/ui/tabs";
import { formatNumber } from "@/lib/format";
import { billingNote, type PlanAction } from "@/lib/plan-choice";
import { cn } from "@/lib/utils";

const INCLUDED = [
  "Daily keyword rank tracking across every storefront",
  "Popularity, difficulty and opportunity scoring",
  "Competitor discovery and metadata audits",
  "AI audit and metadata drafts",
  "Alerts by email and webhook",
  "Personal API tokens and the MCP server",
];

const LIMIT_ROWS = [
  { key: "apps", label: "Apps" },
  { key: "keywordMarkets", label: "Keyword markets" },
  { key: "competitorsPerApp", label: "Competitors per app" },
  { key: "aiCallsPerMonth", label: "AI calls per month" },
] as const;

const INTERVAL_LABEL: Record<BillingInterval, string> = {
  month: "Monthly",
  year: "Annual",
};

function amountOf(name: PaidPlanName, interval: BillingInterval) {
  const { monthlyUsd, annualUsd } = PLANS[name].prices;
  return (interval === "month" ? monthlyUsd : annualUsd) ?? 0;
}

function PlanOption({
  name,
  interval,
  action,
  selected,
  onSelect,
}: {
  name: PaidPlanName;
  interval: BillingInterval;
  action: PlanAction;
  selected: boolean;
  onSelect: () => void;
}) {
  const { displayName, limits } = PLANS[name];

  return (
    <Card
      className={cn(
        "min-w-0 flex-1 transition-colors",
        selected && "border-primary ring-1 ring-primary",
      )}
    >
      <CardHeader>
        <CardDescription className="flex items-center gap-2">
          {displayName}
          {action === "current" ? (
            <Badge variant="secondary">Current</Badge>
          ) : null}
        </CardDescription>
        <CardTitle asChild>
          <p>
            <span className="text-display tabular-nums">
              ${amountOf(name, interval)}
            </span>
            <span className="text-body text-muted-foreground">
              {interval === "month" ? " /month" : " /year"}
            </span>
          </p>
        </CardTitle>
        <p className="text-body text-muted-foreground">
          {billingNote(interval)}
        </p>
      </CardHeader>
      <CardContent>
        <dl className="flex flex-col gap-1.5 text-sm">
          {LIMIT_ROWS.map(({ key, label }) => (
            <div key={key} className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-medium tabular-nums">
                {formatNumber(limits[key] ?? 0)}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
      <CardFooter>
        <Button
          variant="outline"
          className="w-full"
          aria-pressed={selected}
          onClick={onSelect}
        >
          {selected ? <Check aria-hidden="true" /> : null}
          {selected ? "Selected" : "Select"}
          <span className="sr-only"> {displayName}</span>
        </Button>
      </CardFooter>
    </Card>
  );
}

export function PlanPicker({
  interval,
  onInterval,
  selected,
  onSelect,
  actionOf,
}: {
  interval: BillingInterval;
  onInterval: (interval: BillingInterval) => void;
  selected: PaidPlanName;
  onSelect: (name: PaidPlanName) => void;
  actionOf: (name: PaidPlanName) => PlanAction;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Tabs
        value={interval}
        onValueChange={(next) => onInterval(next as BillingInterval)}
      >
        <TabsList aria-label="Billing interval">
          {BILLING_INTERVALS.map((value) => (
            <TabsOption key={value} value={value}>
              {INTERVAL_LABEL[value]}
            </TabsOption>
          ))}
        </TabsList>
      </Tabs>
      <div
        role="group"
        aria-label="Plans"
        className="flex flex-col gap-4 sm:flex-row"
      >
        {PAID_PLAN_NAMES.map((name) => (
          <PlanOption
            key={name}
            name={name}
            interval={interval}
            action={actionOf(name)}
            selected={name === selected}
            onSelect={() => onSelect(name)}
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
      </Card>
    </div>
  );
}
