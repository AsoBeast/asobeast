"use client";

import {
  BILLING_INTERVALS,
  PAID_PLAN_NAMES,
  PLANS,
  type BillingInterval,
  type PaidPlanName,
} from "@asobeast/shared";
import { useId } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsOption } from "@/components/ui/tabs";
import { formatPlanLimit } from "@/lib/format";
import { INTERVAL_LABEL, priceOf } from "@/lib/order-summary";
import {
  CHOOSE_A_PLAN_TITLE,
  EVERY_PLAN_FEATURES,
  EVERY_PLAN_INCLUDES,
  featuresTitle,
  planCardLabel,
  planHighlights,
  savingPercent,
  type PlanAction,
} from "@/lib/plan-choice";
import { cn } from "@/lib/utils";
import { CheckMark } from "./CheckMark";

const LIMIT_ROWS = [
  { key: "apps", label: "Apps" },
  { key: "keywordMarkets", label: "Keyword markets" },
  { key: "competitorsPerApp", label: "Competitors per app" },
  { key: "aiCallsPerMonth", label: "AI calls per month" },
] as const;

const PER_INTERVAL: Record<BillingInterval, string> = {
  month: "/month",
  year: "/year",
};

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
  const highlightsId = useId();

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={planCardLabel(name, interval, action)}
      aria-describedby={highlightsId}
      onClick={onSelect}
      className={cn(
        "flex min-w-0 flex-col items-start gap-3 rounded-2xl border bg-card p-4 text-left shadow-raised transition-[color,background-color,border-color,box-shadow] hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:p-6",
        selected &&
          "border-primary bg-primary-subtle ring-1 ring-primary hover:bg-primary-subtle",
      )}
    >
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-heading">
        <span>{PLANS[name].displayName}</span>
        {action === "current" ? (
          <Badge variant="secondary">Current</Badge>
        ) : null}
      </span>
      <span aria-hidden="true" className="flex items-baseline gap-1">
        <span className="text-title tabular-nums sm:text-hero">{`$${priceOf(name, interval)}`}</span>
        <span className="text-heading font-normal text-muted-foreground">
          {PER_INTERVAL[interval]}
        </span>
      </span>
      <ul
        id={highlightsId}
        className="flex flex-col gap-1 text-body text-muted-foreground"
      >
        {planHighlights(name).map((line) => (
          <li key={line}>
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </button>
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
  const { limits } = PLANS[selected];

  return (
    <div className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-6 lg:col-start-2 lg:row-start-1 lg:self-start">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-title">{CHOOSE_A_PLAN_TITLE}</h2>
        <Tabs
          value={interval}
          onValueChange={(next) => onInterval(next as BillingInterval)}
        >
          <TabsList
            aria-label="Billing interval"
            className="rounded-xl p-1 group-data-horizontal/tabs:h-10"
          >
            {BILLING_INTERVALS.map((value) => (
              <TabsOption
                key={value}
                value={value}
                className="gap-2 rounded-lg px-3 text-heading"
              >
                <span>{INTERVAL_LABEL[value]}</span>
                {value === "year" ? (
                  <Badge variant="info">{`Save ${savingPercent(selected)}%`}</Badge>
                ) : null}
              </TabsOption>
            ))}
          </TabsList>
        </Tabs>
      </div>
      <div
        role="group"
        aria-label="Plans"
        className="grid grid-cols-2 gap-3 sm:gap-4"
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
      <section
        aria-labelledby="plan-features-title"
        className="flex flex-col gap-4"
      >
        <h2 id="plan-features-title" className="text-heading">
          {featuresTitle(selected)}
        </h2>
        <dl className="divide-y divide-border text-heading">
          {LIMIT_ROWS.map(({ key, label }) => (
            <div key={key} className="flex justify-between gap-4 py-2">
              <dt className="font-normal text-muted-foreground">{label}</dt>
              <dd className="tabular-nums">{formatPlanLimit(limits[key])}</dd>
            </div>
          ))}
        </dl>
        <p className="text-caption text-muted-foreground">
          {EVERY_PLAN_INCLUDES}
        </p>
        <ul className="flex flex-col gap-2 text-body">
          {EVERY_PLAN_FEATURES.map((feature) => (
            <li key={feature} className="flex items-start gap-2">
              <CheckMark className="mt-0.5 size-4" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
