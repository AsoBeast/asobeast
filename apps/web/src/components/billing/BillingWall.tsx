"use client";

import { useState } from "react";
import { useQueryState } from "nuqs";
import {
  PLANS,
  planPriceLabel,
  type AccountPlan,
  type BillingCatalog,
  type BillingInterval,
  type PaidPlanName,
} from "@asobeast/shared";
import { checkoutUiFor } from "@/lib/embedded-checkout";
import { paywallFaq } from "@/lib/paywall-faq";
import {
  buysPlan,
  paywallHeading,
  paywallStatusLine,
  planAction,
  planActionLabel,
  trialBarLine,
  trustLines,
} from "@/lib/plan-choice";
import { planParam } from "@/lib/search-params";
import { HostedAction } from "./HostedAction";
import { PaymentColumn } from "./PaymentColumn";
import { PaywallFaq } from "./PaywallFaq";
import { PlanPicker } from "./PlanPicker";
import { TrialBar } from "./TrialBar";
import { TrustRow } from "./TrustRow";

const DEFAULT_PLAN: PaidPlanName = "indie";

export function BillingWall({
  plan,
  catalog,
}: {
  plan: AccountPlan | undefined;
  catalog: BillingCatalog | undefined;
}) {
  const [selected, setSelected] = useQueryState(
    "plan",
    planParam.withDefault(DEFAULT_PLAN).withOptions({ clearOnDefault: false }),
  );
  const [interval, setInterval] = useState<BillingInterval>("month");
  const [now] = useState(() => new Date());
  const offer = plan?.trialOffer ?? null;
  const action = planAction(plan, selected);
  const price = catalog?.prices.find(
    (candidate) =>
      candidate.plan === selected && candidate.interval === interval,
  );
  const publishableKey =
    checkoutUiFor(catalog) === "embedded" && buysPlan(action) && price
      ? (catalog?.publishableKey ?? null)
      : null;
  const trialLine =
    action === "trial" && offer ? trialBarLine(offer, now) : null;

  return (
    <div className="page-wide flex flex-col gap-8 pb-40 sm:pb-24">
      <header className="flex flex-col gap-3">
        <h1 className="text-display tracking-tight text-balance">
          {paywallHeading(plan)}
        </h1>
        <p className="text-body text-muted-foreground">
          {paywallStatusLine(plan, now)}
        </p>
        {offer ? <TrustRow lines={trustLines(offer, now)} /> : null}
      </header>
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,36rem)]">
        <PlanPicker
          interval={interval}
          onInterval={setInterval}
          selected={selected}
          onSelect={(name) => void setSelected(name)}
          actionOf={(name) => planAction(plan, name)}
        />
        <PaymentColumn
          plan={plan}
          catalog={catalog}
          name={selected}
          interval={interval}
          action={action}
          price={price}
          publishableKey={publishableKey}
          now={now}
        />
        <PaywallFaq
          items={paywallFaq(offer, planPriceLabel(selected, interval), now)}
        />
      </div>
      <TrialBar line={trialLine} label={trialLine ? "Your trial" : "Checkout"}>
        {publishableKey ? null : (
          <HostedAction
            action={action}
            label={planActionLabel(action, PLANS[selected].displayName)}
            price={price}
          />
        )}
      </TrialBar>
    </div>
  );
}
