import {
  PLANS,
  type BillingInterval,
  type PaidPlanName,
  type PlanName,
} from "@asobeast/shared";
import type { TranslationContext } from "@/i18n/translator";
import type { Locale } from "@/lib/locale";

const usdFormatters = new Map<string, Intl.NumberFormat>();

export function formatUsdInLocale(
  value: number,
  locale: Locale,
  fractionDigits = 2,
): string {
  const key = `${locale}:${fractionDigits}`;
  const cached = usdFormatters.get(key);
  if (cached) return cached.format(value);
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  usdFormatters.set(key, formatter);
  return formatter.format(value);
}

export function planLabel(name: PlanName, context: TranslationContext): string {
  return context.translator(`plans.${name}`);
}

export function planPriceLabel(
  name: PaidPlanName,
  interval: BillingInterval,
  context: TranslationContext,
): string {
  const price = formatUsdInLocale(
    (interval === "month"
      ? PLANS[name].prices.monthlyUsd
      : PLANS[name].prices.annualUsd) ?? 0,
    context.locale,
    0,
  );
  return context.translator("plan.pricePerInterval", {
    price,
    interval: context.translator(
      interval === "month" ? "intervals.monthName" : "intervals.yearName",
    ),
  });
}
