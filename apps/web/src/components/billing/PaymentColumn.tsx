"use client";

import {
  type AccountPlan,
  type BillingCatalog,
  type BillingInterval,
  type BillingPrice,
  type PaidPlanName,
} from "@asobeast/shared";
import { useTranslations } from "next-intl";
import { Lock } from "lucide-react";
import type { RetryableRead } from "@/components/layout/InlineQueryError";
import { LegalLinks } from "@/components/layout/LegalLinks";
import { Skeleton } from "@/components/ui/skeleton";
import { sessionKeyOf } from "@/lib/embedded-checkout";
import { summaryFromCatalog } from "@/lib/order-summary";
import {
  buysPlan,
  planLabel,
  type PlanAction,
  type ViewerClock,
} from "@/lib/plan-choice";
import { useAppLocale } from "@/lib/use-app-locale";
import { EmbeddedCheckout } from "./EmbeddedCheckout";
import { OrderSummary } from "./OrderSummary";
import { PaymentNote } from "./PaymentNote";
import { useCheckoutTheme } from "./use-checkout-theme";

export function PaymentColumn({
  plan,
  catalog,
  catalogRead,
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
  catalogRead: RetryableRead | null;
  name: PaidPlanName;
  interval: BillingInterval;
  action: PlanAction;
  price: BillingPrice | undefined;
  publishableKey: string | null;
  clock: ViewerClock;
  billing: boolean;
}) {
  const t = useTranslations("billing");
  const locale = useAppLocale();
  const context = { translator: t, locale };
  const offer = action === "trial" ? plan?.trialOffer : null;
  const theme = useCheckoutTheme();

  return (
    <section
      aria-labelledby="payment-title"
      className="flex min-w-0 flex-col gap-6 rounded-2xl border border-border bg-card p-4 shadow-raised sm:p-6 lg:col-start-1 lg:row-start-1"
    >
      <h2 id="payment-title" className="text-title">
        {t("payment.title")}
      </h2>
      {publishableKey && price && theme ? (
        <EmbeddedCheckout
          key={sessionKeyOf(price.priceId, theme)}
          publishableKey={publishableKey}
          priceId={price.priceId}
          theme={theme}
          label={t(
            interval === "month"
              ? "checkout.regionMonth"
              : "checkout.regionYear",
            { plan: planLabel(name, context) },
          )}
        />
      ) : null}
      {publishableKey && price && !theme ? (
        <Skeleton className="h-[28rem] w-full rounded-xl" />
      ) : null}
      {buysPlan(action) ? (
        <OrderSummary
          summary={summaryFromCatalog(name, interval, offer, {
            ...context,
            clock,
          })}
        />
      ) : null}
      {catalog?.enabled && buysPlan(action) ? (
        <p className="flex items-center gap-2 text-caption text-muted-foreground">
          <Lock aria-hidden="true" className="size-3.5 shrink-0" />
          <span>{t("payment.secure")}</span>
        </p>
      ) : null}
      <PaymentNote
        catalog={catalog}
        catalogRead={catalogRead}
        offer={offer}
        clock={clock}
      />
      {billing ? <LegalLinks /> : null}
    </section>
  );
}
