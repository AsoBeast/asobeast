import {
  PLANS,
  planRenewalTerms,
  type BillingInterval,
  type PaidPlanName,
  type TrialOffer,
} from "@asobeast/shared";
import { formatUsd } from "@/lib/format";
import { trialEndLabel, type ViewerClock } from "@/lib/plan-choice";

export const INTERVAL_LABEL: Record<BillingInterval, string> = {
  month: "Monthly",
  year: "Annual",
};

export const ORDER_SUMMARY_TITLE = "Order summary";

export const DUE_TODAY = "Due today";

const CANCEL_ANY_TIME = "Cancel any time from settings.";

const NOTHING_BEFORE_THE_DATE = "Nothing is charged before the date above.";

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

export function summaryFromCatalog(
  name: PaidPlanName,
  interval: BillingInterval,
  offer: TrialOffer | null | undefined,
  clock: ViewerClock,
): OrderSummaryModel {
  const unitAmount = formatUsd(priceOf(name, interval));
  const renewalTerms = planRenewalTerms(name, interval);
  return {
    planName: PLANS[name].displayName,
    intervalLabel: INTERVAL_LABEL[interval],
    unitAmount,
    dueToday: offer ? formatUsd(0) : unitAmount,
    thenLine: offer
      ? `From ${trialEndLabel(offer, clock)}: ${renewalTerms}.`
      : `Then ${renewalTerms}.`,
    cancelLine: offer
      ? `${CANCEL_ANY_TIME} ${NOTHING_BEFORE_THE_DATE}`
      : CANCEL_ANY_TIME,
  };
}
