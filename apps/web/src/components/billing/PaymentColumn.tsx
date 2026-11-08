"use client";

import {
  PLANS,
  type AccountPlan,
  type BillingCatalog,
  type BillingInterval,
  type BillingPrice,
  type PaidPlanName,
  SUPPORT_EMAIL,
} from "@asobeast/shared";
import { Lock } from "lucide-react";
import { LegalLinks } from "@/components/layout/LegalLinks";
import { Skeleton } from "@/components/ui/skeleton";
import { sessionKeyOf } from "@/lib/embedded-checkout";
import { INTERVAL_LABEL, summaryFromCatalog } from "@/lib/order-summary";
import {
  PAYMENT_TITLE,
  CONTACT_SUPPORT,
  NEED_HELP,
  SECURE_BY_STRIPE,
  buysPlan,
  trialPaymentNote,
  type PlanAction,
  type ViewerClock,
} from "@/lib/plan-choice";
import { EmbeddedCheckout } from "./EmbeddedCheckout";
import { OrderSummary } from "./OrderSummary";
import { useCheckoutTheme } from "./use-checkout-theme";

export function PaymentColumn({
  plan,
  catalog,
  name,
  interval,
  action,
  price,
  publishableKey,
  clock,
  billing,
}: {
  plan: AccountPlan | undefined;
  catalog: BillingCatalog | undefined;
  name: PaidPlanName;
  interval: BillingInterval;
  action: PlanAction;
  price: BillingPrice | undefined;
  publishableKey: string | null;
  clock: ViewerClock;
  billing: boolean;
}) {
  const offer = action === "trial" ? plan?.trialOffer : null;
  const theme = useCheckoutTheme();

  return (
    <section
      aria-labelledby="payment-title"
      className="flex min-w-0 flex-col gap-6 rounded-2xl border border-border bg-card p-4 shadow-raised sm:p-6 lg:col-start-1 lg:row-start-1"
    >
      <h2 id="payment-title" className="text-display">
        {PAYMENT_TITLE}
      </h2>
      {publishableKey && price && theme ? (
        <EmbeddedCheckout
          key={sessionKeyOf(price.priceId, theme)}
          publishableKey={publishableKey}
          priceId={price.priceId}
          theme={theme}
          label={`Stripe checkout for ${PLANS[name].displayName}, ${INTERVAL_LABEL[interval].toLowerCase()}`}
        />
      ) : null}
      {publishableKey && price && !theme ? (
        <Skeleton className="h-[28rem] w-full rounded-xl" />
      ) : null}
      {buysPlan(action) ? (
        <OrderSummary
          summary={summaryFromCatalog(name, interval, offer, clock)}
        />
      ) : null}
      {catalog?.enabled && buysPlan(action) ? (
        <p className="flex items-center gap-2 text-caption text-muted-foreground">
          <Lock aria-hidden="true" className="size-3.5 shrink-0" />
          <span>{SECURE_BY_STRIPE}</span>
        </p>
      ) : null}
      <p className="text-caption text-muted-foreground">
        <span>{trialPaymentNote(catalog, offer, clock)}</span>{" "}
        <span>{NEED_HELP}</span>{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium underline">
          {CONTACT_SUPPORT}
        </a>
        .
      </p>
      {billing ? <LegalLinks /> : null}
    </section>
  );
}
