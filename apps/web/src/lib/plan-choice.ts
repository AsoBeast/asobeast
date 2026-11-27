import {
  PLANS,
  paidPlanOf,
  planOf,
  type AccountPlan,
  type BillingCatalog,
  type BillingInterval,
  type PaidPlanName,
  type PlanLimit,
  type PlanLimits,
  type TrialOffer,
} from "@asobeast/shared";
import type { TranslationContext } from "@/i18n/translator";
import { formatDateInLocale, formatDateInZoneAndLocale } from "@/lib/format";
import {
  formatUsdInLocale,
  planLabel,
  planPriceLabel,
} from "@/lib/plan-labels";

export {
  formatUsdInLocale,
  planLabel,
  planPriceLabel,
} from "@/lib/plan-labels";

export type PlanAction =
  "current" | "checkout" | "trial" | "change" | "resume" | "pending";

const DAY_MS = 24 * 60 * 60 * 1000;

function stalled(plan: AccountPlan): boolean {
  return plan.subscriptionStalled === true;
}

function pending(plan: AccountPlan): boolean {
  return plan.subscriptionPending === true;
}

function cardTrialEnd(plan: AccountPlan): string | null {
  return plan.trialing === true ? plan.trialEndsAt : null;
}

export function trialChargeDeclined(plan: AccountPlan | undefined): boolean {
  return plan?.trialChargeFailed === true;
}

const declined = trialChargeDeclined;

export function pausedPlanOf(
  plan: AccountPlan | undefined,
): AccountPlan | undefined {
  return plan?.entitled === false ? plan : undefined;
}

export function pausedNotice(
  plan: AccountPlan | undefined,
  isMember: boolean,
): string {
  if (isMember) return `${COLLECTION_PAUSED} ${ASK_THE_OWNER}`;
  return trialChargeDeclined(plan) ? TRIAL_CHARGE_DECLINED : COLLECTION_PAUSED;
}

function scheduledSwitch(
  plan: AccountPlan,
  context: TranslationContext,
): string | null {
  if (!plan.scheduledPlan || !plan.renewsAt) return null;
  return context.translator("status.switchesTo", {
    plan: PLANS[plan.scheduledPlan].displayName,
    date: formatDateInLocale(plan.renewsAt, context.locale),
  });
}

export function trialPriceLabel(
  plan: AccountPlan,
  context: TranslationContext,
): string | null {
  const paid = paidPlanOf(plan.plan);
  return paid && plan.billingInterval
    ? planPriceLabel(paid, plan.billingInterval, context)
    : null;
}

export function trialBannerLine(
  daysLeft: number,
  plan: AccountPlan | undefined,
  context: TranslationContext,
): string {
  if (plan?.cancelAtPeriodEnd && plan.trialEndsAt) {
    return context.translator("trial.bannerEnds", {
      date: formatDateInLocale(plan.trialEndsAt, context.locale),
    });
  }
  const remaining = context.translator("trial.bannerRemaining", {
    days: daysLeft,
  });
  const price = plan ? trialPriceLabel(plan, context) : null;
  return price && plan
    ? context.translator("trial.bannerThen", {
        remaining,
        plan: planLabel(planOf(plan.plan), context),
        price,
      })
    : context.translator("trial.bannerRemainingOnly", { days: daysLeft });
}

export function sellingTrial(catalog: BillingCatalog | undefined): boolean {
  return catalog?.enabled !== false;
}

export function planOnSale(
  plan: AccountPlan | undefined,
  catalog: BillingCatalog | undefined,
): AccountPlan | undefined {
  if (!plan?.trialOffer || sellingTrial(catalog)) return plan;
  return { ...plan, trialOffer: null };
}

export function planAction(
  plan: AccountPlan | undefined,
  name: PaidPlanName,
): PlanAction {
  if (plan?.plan === name) return "current";
  if (plan && pending(plan)) return "pending";
  if (!plan?.subscribed) return plan?.trialOffer ? "trial" : "checkout";
  return stalled(plan) ? "resume" : "change";
}

export function paywallHeading(
  plan: AccountPlan | undefined,
  context: TranslationContext,
): string {
  return plan?.trialOffer
    ? context.translator("plan.trialHeading", { days: plan.trialOffer.days })
    : context.translator("plan.heading");
}

export interface ViewerClock {
  now: Date;
  timeZone: string;
}

export function trialEndsOn(offer: TrialOffer, now: Date): Date {
  return new Date(now.getTime() + offer.days * DAY_MS);
}

export function trialEndLabel(
  offer: TrialOffer,
  { now, timeZone }: ViewerClock,
  context: TranslationContext,
): string {
  return formatDateInZoneAndLocale(
    trialEndsOn(offer, now),
    timeZone,
    context.locale,
  );
}

export function featuresTitle(
  name: PaidPlanName,
  context: TranslationContext,
): string {
  return context.translator("plan.featuresTitle", {
    plan: planLabel(name, context),
  });
}

function limitLine(
  limit: PlanLimit,
  resource: "apps" | "keywordMarkets",
  context: TranslationContext,
): string {
  return limit === null
    ? context.translator(`plan.limits.${resource}.unlimited`)
    : context.translator(`plan.limits.${resource}.count`, { count: limit });
}

export function limitHighlights(
  { apps, keywordMarkets }: Pick<PlanLimits, "apps" | "keywordMarkets">,
  context: TranslationContext,
): readonly string[] {
  return [
    limitLine(apps, "apps", context),
    limitLine(keywordMarkets, "keywordMarkets", context),
  ];
}

export function planHighlights(
  name: PaidPlanName,
  context: TranslationContext,
): readonly string[] {
  return limitHighlights(PLANS[name].limits, context);
}

export function buysPlan(action: PlanAction): boolean {
  return action === "checkout" || action === "trial";
}

export function planCardLabel(
  name: PaidPlanName,
  interval: BillingInterval,
  action: PlanAction,
  context: TranslationContext,
): string {
  return context.translator("plan.cardLabel", {
    plan: planLabel(name, context),
    price: planPriceLabel(name, interval, context),
    current: action === "current" ? "true" : "false",
  });
}

export function savingPercent(name: PaidPlanName): number {
  const { monthlyUsd, annualUsd } = PLANS[name].prices;
  if (!monthlyUsd || !annualUsd) return 0;
  return Math.round(((12 * monthlyUsd - annualUsd) / (12 * monthlyUsd)) * 100);
}

export function trustLines(
  offer: TrialOffer,
  clock: ViewerClock,
  context: TranslationContext,
): readonly string[] {
  return [
    context.translator("trial.trustSafe", {
      date: trialEndLabel(offer, clock, context),
    }),
    context.translator("trial.trustFree", { days: offer.days }),
    context.translator("trial.trustCancel"),
  ];
}

export interface TrialBarDescriptor {
  messageKey: "trial.bar";
  values: {
    days: number;
    endsOn: string;
  };
}

export function trialBarParts(
  offer: TrialOffer,
  clock: ViewerClock,
  context: TranslationContext,
): TrialBarDescriptor {
  return {
    messageKey: "trial.bar",
    values: {
      days: offer.days,
      endsOn: trialEndLabel(offer, clock, context),
    },
  };
}

export function planActionLabel(
  action: PlanAction,
  name: PaidPlanName,
  context: TranslationContext,
): string {
  if (action === "checkout") {
    return context.translator("actions.checkout", {
      plan: planLabel(name, context),
    });
  }
  if (action === "trial") {
    return context.translator("actions.trial", {
      price: formatUsdInLocale(0, context.locale, 0),
    });
  }
  return context.translator(`actions.${action}`);
}

function paywallTrialLine(
  plan: AccountPlan,
  context: TranslationContext,
): string | null {
  const trialEnd = cardTrialEnd(plan);
  if (trialEnd) {
    const date = formatDateInLocale(trialEnd, context.locale);
    if (plan.cancelAtPeriodEnd) {
      return context.translator("status.cancelledTrial", { date });
    }
    const price = trialPriceLabel(plan, context);
    return context.translator(
      price ? "status.trialRunningThen" : "status.trialRunning",
      {
        date,
        ...(price ? { price } : {}),
      },
    );
  }
  if (declined(plan)) return context.translator("status.trialChargeDeclined");
  if (plan.plan === "trial" && plan.trialEndsAt) {
    return context.translator("status.trialActiveUntil", {
      date: formatDateInLocale(plan.trialEndsAt, context.locale),
    });
  }
  return null;
}

function settingsTrialLine(
  plan: AccountPlan,
  context: TranslationContext,
): string | null {
  if (plan.plan === "trial" && plan.trialEndsAt) {
    return context.translator("status.trialSettingsUntil", {
      date: formatDateInLocale(plan.trialEndsAt, context.locale),
    });
  }
  const trialEnd = cardTrialEnd(plan);
  if (!trialEnd) return null;
  const date = formatDateInLocale(trialEnd, context.locale);
  if (plan.cancelAtPeriodEnd) {
    return context.translator("status.cancelledTrial", { date });
  }
  const price = trialPriceLabel(plan, context);
  return context.translator(
    price ? "status.trialSettingsThen" : "status.trialSettings",
    {
      date,
      ...(price ? { price } : {}),
    },
  );
}

export function paywallStatusLine(
  plan: AccountPlan | undefined,
  clock: ViewerClock,
  context: TranslationContext,
): string {
  if (!plan) return context.translator("status.choose");
  if (pending(plan)) return context.translator("status.paymentConfirming");
  if (plan.trialRefused) return context.translator("status.trialRefused");
  if (plan.trialOffer && !plan.subscribed) {
    return context.translator("status.trialOffer", {
      price: formatUsdInLocale(0, context.locale, 0),
      date: trialEndLabel(plan.trialOffer, clock, context),
    });
  }
  const trial = paywallTrialLine(plan, context);
  if (trial) return trial;
  if (stalled(plan)) return context.translator("status.stalledPaywall");
  if (plan.trialEndsAt && !plan.entitled) {
    return context.translator("status.trialEnded", {
      date: formatDateInLocale(plan.trialEndsAt, context.locale),
    });
  }
  const switchTo = scheduledSwitch(plan, context);
  if (switchTo) return switchTo;
  if (plan.renewsAt) {
    return context.translator("status.renews", {
      plan: planLabel(planOf(plan.plan), context),
      date: formatDateInLocale(plan.renewsAt, context.locale),
    });
  }
  return context.translator("status.choose");
}

export function planStatusLine(
  plan: AccountPlan,
  context: TranslationContext,
): string {
  if (pending(plan)) return context.translator("status.paymentConfirming");
  if (declined(plan)) return context.translator("status.trialChargeDeclined");
  if (stalled(plan)) return context.translator("status.stalledSettings");
  if (plan.trialOffer && !plan.subscribed) {
    return context.translator("status.startTrial");
  }
  if (!plan.entitled) return context.translator("status.dataReadable");
  const trial = settingsTrialLine(plan, context);
  if (trial) return trial;
  if (plan.cancelAtPeriodEnd && plan.renewsAt) {
    return context.translator("status.cancelledAccessUntil", {
      date: formatDateInLocale(plan.renewsAt, context.locale),
    });
  }
  const switchTo = scheduledSwitch(plan, context);
  if (switchTo) return switchTo;
  if (plan.renewsAt) {
    return context.translator("status.renewsShort", {
      date: formatDateInLocale(plan.renewsAt, context.locale),
    });
  }
  return context.translator("status.billedMonthly");
}

export function planCallToAction(
  plan: AccountPlan,
  context: TranslationContext,
): string {
  if (plan.entitled) return context.translator("plan.upgrade");
  return stalled(plan)
    ? context.translator("plan.resume")
    : context.translator("plan.choose");
}

export function paymentNote(
  catalog: BillingCatalog | undefined,
  context: TranslationContext,
): string {
  if (!catalog?.enabled) return context.translator("payment.unconfigured");
  return context.translator(
    catalog.managedPayments
      ? "payment.handledByLink"
      : "payment.handledByStripe",
  );
}

export function trialPaymentNote(
  catalog: BillingCatalog | undefined,
  offer: TrialOffer | null | undefined,
  clock: ViewerClock,
  context: TranslationContext,
): string {
  const note = paymentNote(catalog, context);
  if (!offer || !catalog?.enabled) return note;
  return `${note} ${context.translator("trial.paymentNote", {
    date: trialEndLabel(offer, clock, context),
  })}`;
}

export function memberPlanLine(
  plan: AccountPlan | undefined,
  context: TranslationContext,
): string {
  if (plan && !plan.entitled) return context.translator("member.paused");
  return context.translator("member.onlyOwner");
}

export function suspensionNotice(
  reason: string | null | undefined,
  context: TranslationContext,
): string {
  const cause = reason?.trim().replace(/[.!?。！？]+$/, "");
  return context.translator(
    cause ? "status.suspendedWithReason" : "status.suspended",
    cause ? { reason: cause } : {},
  );
}

export const PAYMENT_CONFIRMING =
  "Your payment is being confirmed. This usually takes a minute; if it has not completed within a day the attempt expires and you can choose a plan again.";
export const HANDLED_BY_LINK =
  "Payments are handled by Link, a Stripe affiliate and the merchant of record. Prices are in US dollars; checkout adds sales tax or VAT where it applies and can charge in your local currency. Cancel any time from settings.";
export const HANDLED_BY_STRIPE =
  "Payments are handled by Stripe. Cancel any time from settings.";
export const CHECKOUT_UNCONFIGURED =
  "Checkout is not configured on this instance.";
export const TRIAL_REFUSED =
  "This card or email has already had a free trial. Choose a plan to start today.";
export const COLLECTION_PAUSED =
  "Collection is paused. Everything AsoBeast has already gathered stays readable and exportable.";
export const MEMBER_BILLING_TITLE = "Your workspace owner manages billing";
export const MEMBER_BILLING_NOTE = `${MEMBER_BILLING_TITLE}.`;
export const ASK_THE_OWNER = "Ask your workspace owner to choose a plan.";
export const CONFIRM_EMAIL_TITLE = "Confirm your email";
export const CONFIRM_EMAIL_CAPTION =
  "Check your spam folder if it has not arrived. The link works for a day.";
export const WRONG_ADDRESS = "Wrong address?";
export const REGISTER_AGAIN = "and register again.";
export const PAYMENT_TITLE = "Payment";
export const CHOOSE_A_PLAN_TITLE = "Choose a plan";
export const FAQ_TITLE = "Questions";
export const EVERY_PLAN_INCLUDES = "Every plan includes";
export const SECURE_BY_STRIPE = "Secure payments processed by Stripe.";
export const NEED_HELP = "Need help?";
export const CONTACT_SUPPORT = "Contact support";
export const CHECKOUT_UNREACHABLE = "Checkout could not be opened. Try again.";
export const PLAN_UNREACHABLE =
  "Your plan could not be loaded. Check your connection, then try again.";
export const PRICES_UNREACHABLE =
  "The prices could not be loaded. Check your connection, then try again.";
export const CHECKOUT_REOPENING = "Opening checkout…";
export const CHECKOUT_PRICE_MISSING = "Checkout is not configured yet";
export const CHECKOUT_START_FAILED = "Could not start checkout. Try again.";
export const PORTAL_OPEN_FAILED =
  "Could not open the billing portal. Try again.";
export const EVERY_PLAN_FEATURES: readonly string[] = [
  "Daily keyword rank tracking across every storefront",
  "Popularity, difficulty and opportunity scoring",
  "Competitor discovery and metadata audits",
  "AI audit and metadata drafts",
  "Alerts by email and webhook",
  "Personal API tokens and the MCP server",
];

export const TRIAL_CHARGE_DECLINED =
  "Your trial ended, but the card was declined. Update it in the billing portal to start your plan.";
