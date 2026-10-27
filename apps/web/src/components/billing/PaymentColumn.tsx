"use client";

import {
  PLANS,
  type AccountPlan,
  type BillingCatalog,
  type BillingInterval,
  type BillingPrice,
  type PaidPlanName,
} from "@asobeast/shared";
import { sessionKeyOf } from "@/lib/embedded-checkout";
import { summaryFromCatalog } from "@/lib/order-summary";
import {
  PAYMENT_TITLE,
  SECURE_BY_STRIPE,
  buysPlan,
  trialPaymentNote,
  type PlanAction,
} from "@/lib/plan-choice";
import { EmbeddedCheckout } from "./EmbeddedCheckout";
import { OrderSummary } from "./OrderSummary";

const INTERVAL_WORD: Record<BillingInterval, string> = {
  month: "monthly",
  year: "annual",
};

export function PaymentColumn({
  plan,
  catalog,
  name,
  interval,
  action,
  price,
  publishableKey,
  now,
}: {
  plan: AccountPlan | undefined;
  catalog: BillingCatalog | undefined;
  name: PaidPlanName;
  interval: BillingInterval;
  action: PlanAction;
  price: BillingPrice | undefined;
  publishableKey: string | null;
  now: Date;
}) {
  const offer = action === "trial" ? plan?.trialOffer : null;

  return (
    <section
      aria-labelledby="payment-title"
      className="flex min-w-0 flex-col gap-4"
    >
      <h2 id="payment-title" className="text-title">
        {PAYMENT_TITLE}
      </h2>
      {publishableKey && price ? (
        <EmbeddedCheckout
          key={sessionKeyOf(price.priceId)}
          publishableKey={publishableKey}
          priceId={price.priceId}
          label={`Stripe checkout for ${PLANS[name].displayName}, ${INTERVAL_WORD[interval]}`}
        />
      ) : null}
      {buysPlan(action) ? (
        <OrderSummary
          summary={summaryFromCatalog(name, interval, offer, now)}
        />
      ) : null}
      <p className="text-caption text-muted-foreground">{SECURE_BY_STRIPE}</p>
      <p className="text-caption text-muted-foreground">
        {trialPaymentNote(catalog, offer, now)} Need help?{" "}
        <a href="mailto:hello@asobeast.dev" className="font-medium underline">
          Contact support
        </a>
        .
      </p>
    </section>
  );
}
