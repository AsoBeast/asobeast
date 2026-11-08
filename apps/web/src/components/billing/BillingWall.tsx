"use client";

import { useState } from "react";
import { useQueryState } from "nuqs";
import {
  PLANS,
  planRenewalTerms,
  type AccountPlan,
  type AuthUser,
  type BillingCatalog,
  type BillingInterval,
  type PaidPlanName,
} from "@asobeast/shared";
import { SignUpSteps } from "@/components/auth/SignUpSteps";
import { checkoutUiFor } from "@/lib/embedded-checkout";
import { paywallFaq } from "@/lib/paywall-faq";
import {
  buysPlan,
  paywallHeading,
  paywallStatusLine,
  planAction,
  planOnSale,
  planActionLabel,
  trialBarParts,
  trustLines,
} from "@/lib/plan-choice";
import { planParam } from "@/lib/search-params";
import { signUpSteps } from "@/lib/sign-up-steps";
import { HostedAction } from "./HostedAction";
import { PaymentColumn } from "./PaymentColumn";
import { PaywallFaq } from "./PaywallFaq";
import { PlanPicker } from "./PlanPicker";
import { TrialBar } from "./TrialBar";
import { TrustRow } from "./TrustRow";
import { useViewerClock } from "./use-viewer-clock";

const DEFAULT_PLAN: PaidPlanName = "indie";

export function BillingWall({
  user,
  plan: accountPlan,
  catalog,
  billing,
}: {
  user: AuthUser | undefined;
  plan: AccountPlan | undefined;
  catalog: BillingCatalog | undefined;
  billing: boolean;
}) {
  const [selected, setSelected] = useQueryState(
    "plan",
    planParam.withDefault(DEFAULT_PLAN).withOptions({ clearOnDefault: false }),
  );
  const [interval, setInterval] = useState<BillingInterval>("month");
  const clock = useViewerClock();
  const plan = planOnSale(accountPlan, catalog);
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
  const trialParts =
    action === "trial" && offer ? trialBarParts(offer, clock) : null;

  return (
    <div className="page-checkout flex flex-col gap-8 pb-40 sm:pb-28">
      <header className="flex flex-col gap-4">
        <SignUpSteps steps={signUpSteps(user)} />
        <h1 className="text-display tracking-tight text-balance sm:text-hero">
          {paywallHeading(plan)}
        </h1>
        <p className="max-w-prose text-subtitle font-normal text-muted-foreground">
          {paywallStatusLine(plan, clock)}
        </p>
        {offer ? <TrustRow lines={trustLines(offer, clock)} /> : null}
      </header>
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,28rem)] xl:gap-12">
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
          clock={clock}
          billing={billing}
        />
      </div>
      <PaywallFaq
        items={paywallFaq(offer, planRenewalTerms(selected, interval), clock)}
      />
      <TrialBar
        parts={trialParts}
        label={trialParts ? "Your trial" : "Checkout"}
      >
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
