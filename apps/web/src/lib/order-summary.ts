import {
  PLANS,
  type BillingInterval,
  type PaidPlanName,
  type TrialOffer,
} from "@asobeast/shared";
import type { TranslationContext } from "@/i18n/translator";
import {
  formatUsdInLocale,
  planLabel,
  planPriceLabel,
  trialEndLabel,
  type ViewerClock,
} from "@/lib/plan-choice";

export interface OrderSummaryContext extends TranslationContext {
  clock: ViewerClock;
}

export interface OrderSummaryModel {
  planName: string;
  intervalLabel: string;
  unitAmount: string;
  dueToday: string;
  thenLine: string;
  cancelLine: string;
}

export function priceOf(name: PaidPlanName, interval: BillingInterval): number {
  const { monthlyUsd, annualUsd } = PLANS[name].prices;
  return (interval === "month" ? monthlyUsd : annualUsd) ?? 0;
}

export function intervalLabel(
  interval: BillingInterval,
  context: TranslationContext,
): string {
  return context.translator(`intervals.${interval}`);
}

export function planRenewalTerms(
  name: PaidPlanName,
  interval: BillingInterval,
  context: TranslationContext,
): string {
  return context.translator("plan.renewalTerms", {
    price: planPriceLabel(name, interval, context),
    cadence: context.translator(
      interval === "month" ? "intervals.monthly" : "intervals.yearly",
    ),
  });
}

export function summaryFromCatalog(
  name: PaidPlanName,
  interval: BillingInterval,
  offer: TrialOffer | null | undefined,
  context: OrderSummaryContext,
): OrderSummaryModel {
  const unitAmount = formatUsdInLocale(priceOf(name, interval), context.locale);
  const renewalTerms = planRenewalTerms(name, interval, context);
  return {
    planName: planLabel(name, context),
    intervalLabel: intervalLabel(interval, context),
    unitAmount,
    dueToday: offer ? formatUsdInLocale(0, context.locale) : unitAmount,
    thenLine: offer
      ? context.translator("orderSummary.thenTrial", {
          date: trialEndLabel(offer, context.clock, context),
          terms: renewalTerms,
        })
      : context.translator("orderSummary.then", { terms: renewalTerms }),
    cancelLine: offer
      ? context.translator("orderSummary.trialCancel", {
          cancel: context.translator("orderSummary.cancelAnyTime"),
          nothing: context.translator("orderSummary.nothingBeforeDate"),
        })
      : context.translator("orderSummary.cancelAnyTime"),
  };
}
