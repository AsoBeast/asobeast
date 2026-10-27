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
import { Tabs, TabsList, TabsOption } from "@/components/ui/tabs";
import { formatNumber } from "@/lib/format";
import { INTERVAL_LABEL, priceOf } from "@/lib/order-summary";
import type { FaqItem } from "@/lib/paywall-faq";
import {
  CHOOSE_A_PLAN_TITLE,
  EVERY_PLAN_INCLUDES,
  FEATURES_TITLE,
  planCardLabel,
  savingPercent,
  type PlanAction,
} from "@/lib/plan-choice";
import { cn } from "@/lib/utils";
import { PaywallFaq } from "./PaywallFaq";

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
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={planCardLabel(name, interval, action)}
      onClick={onSelect}
      className={cn(
        "flex min-w-0 flex-col items-start gap-1 rounded-xl border-[1.5px] bg-card p-4 text-left transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        selected && "border-primary ring-1 ring-primary",
      )}
    >
      <span className="flex items-center gap-2 text-body">
        <span>{PLANS[name].displayName}</span>
        {action === "current" ? (
          <Badge variant="secondary">Current</Badge>
        ) : null}
      </span>
      <span>
        <span className="text-display tabular-nums">
          ${priceOf(name, interval)}
        </span>
        <span className="text-body text-muted-foreground">
          {PER_INTERVAL[interval]}
        </span>
      </span>
    </button>
  );
}

export function PlanPicker({
  interval,
  onInterval,
  selected,
  onSelect,
  actionOf,
  faq,
}: {
  interval: BillingInterval;
  onInterval: (interval: BillingInterval) => void;
  selected: PaidPlanName;
  onSelect: (name: PaidPlanName) => void;
  actionOf: (name: PaidPlanName) => PlanAction;
  faq: readonly FaqItem[];
}) {
  const { limits } = PLANS[selected];

  return (
    <div className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-6 lg:order-last">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-title">{CHOOSE_A_PLAN_TITLE}</h2>
        <Tabs
          value={interval}
          onValueChange={(next) => onInterval(next as BillingInterval)}
        >
          <TabsList aria-label="Billing interval">
            {BILLING_INTERVALS.map((value) => (
              <TabsOption key={value} value={value}>
                {INTERVAL_LABEL[value]}
                {value === "year" ? (
                  <Badge variant="secondary">
                    Save {savingPercent(selected)}%
                  </Badge>
                ) : null}
              </TabsOption>
            ))}
          </TabsList>
        </Tabs>
      </div>
      <div role="group" aria-label="Plans" className="grid grid-cols-2 gap-3">
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
        className="flex flex-col gap-3"
      >
        <h2 id="plan-features-title" className="text-title">
          {FEATURES_TITLE}
        </h2>
        <dl className="grid gap-x-8 gap-y-2 text-body sm:grid-cols-2">
          {LIMIT_ROWS.map(({ key, label }) => (
            <div key={key} className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-medium tabular-nums">
                {formatNumber(limits[key] ?? 0)}
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-caption text-muted-foreground">
          {EVERY_PLAN_INCLUDES}
        </p>
        <ul className="grid gap-2 text-body sm:grid-cols-2">
          {INCLUDED.map((feature) => (
            <li key={feature} className="flex items-start gap-2">
              <Check
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-success"
              />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </section>
      <PaywallFaq items={faq} />
    </div>
  );
}
