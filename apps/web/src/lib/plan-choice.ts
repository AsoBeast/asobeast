import {
  PLANS,
  paidPlanOf,
  planPriceLabel,
  type AccountPlan,
  type BillingCatalog,
  type BillingInterval,
  type PaidPlanName,
  type TrialOffer,
} from "@asobeast/shared";
import { formatDate } from "@/lib/format";

export type PlanAction =
  "current" | "checkout" | "trial" | "change" | "resume" | "pending";

export const PAYMENT_CONFIRMING =
  "Your payment is being confirmed. This usually takes a minute; if it has not completed within a day the attempt expires and you can choose a plan again.";

export const SOLD_THROUGH_LINK =
  "Sold through Link, our reseller. Prices are in US dollars; checkout adds sales tax or VAT where it applies and can charge in your local currency. Cancel any time from settings.";

export const HANDLED_BY_STRIPE =
  "Payments are handled by Stripe. Cancel any time from settings.";

export const CHECKOUT_UNCONFIGURED =
  "Checkout is not configured on this instance.";

export const COLLECTION_PAUSED =
  "Collection is paused. Everything AsoBeast has already gathered stays readable and exportable.";

const SUSPENDED_SCOPE =
  "Your data stays readable and exportable and billing stays open, but changes and the daily run are paused. Contact the operator of this instance to lift it.";

export function suspensionNotice(reason: string | null | undefined): string {
  const cause = reason?.trim().replace(/[.!?]+$/, "");
  const subject = cause
    ? `This workspace is suspended: ${cause}.`
    : "This workspace is suspended.";
  return `${subject} ${SUSPENDED_SCOPE}`;
}

export const MEMBER_BILLING_TITLE = "Your workspace owner manages billing";

export const MEMBER_BILLING_NOTE = `${MEMBER_BILLING_TITLE}.`;

export const ASK_THE_OWNER = "Ask your workspace owner to choose a plan.";

const CHOOSE_A_PLAN = "Choose a plan to unlock AsoBeast.";

const BILLED: Record<BillingInterval, string> = {
  month: "Billed monthly",
  year: "Billed yearly, two months free",
};

const START_ON_THE_PLAN_PAGE = "Start your free trial from the plan page.";

const DAY_MS = 24 * 60 * 60 * 1000;

const STALLED_ON_THE_PAYWALL =
  "Your subscription stopped collecting. Add a payment method in the billing portal and it picks up where it left off.";

const TRIAL_CHARGE_DECLINED =
  "Your trial ended, but the card was declined. Update it in the billing portal to start your plan.";

const STALLED_IN_SETTINGS =
  "Your subscription stopped collecting. Add a payment method in the billing portal and tracking resumes.";

const ACTION_LABEL: Record<Exclude<PlanAction, "checkout">, string> = {
  current: "Current plan",
  trial: "Start free trial",
  change: "Change in the billing portal",
  resume: "Resume in the billing portal",
  pending: "Confirming your payment",
};

function stalled(plan: AccountPlan): boolean {
  return plan.subscriptionStalled === true;
}

function pending(plan: AccountPlan): boolean {
  return plan.subscriptionPending === true;
}

function cardTrialEnd(plan: AccountPlan): string | null {
  return plan.trialing === true ? plan.trialEndsAt : null;
}

function declined(plan: AccountPlan): boolean {
  return plan.trialChargeFailed === true;
}

export function trialPriceLabel(plan: AccountPlan): string | null {
  const paid = paidPlanOf(plan.plan);
  return paid && plan.billingInterval
    ? planPriceLabel(paid, plan.billingInterval)
    : null;
}

function nothingCharged(endsAt: string): string {
  return `Cancelled. Your trial ends on ${formatDate(endsAt)} and nothing is charged.`;
}

function thenCharged(plan: AccountPlan): string {
  const price = trialPriceLabel(plan);
  return price ? `, then ${price}` : "";
}

export function trialBannerLine(
  daysLeft: number,
  plan: AccountPlan | undefined,
): string {
  if (plan?.cancelAtPeriodEnd && plan.trialEndsAt) {
    return `Trial ends on ${formatDate(plan.trialEndsAt)}. Nothing will be charged.`;
  }
  const remaining = `Trial ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`;
  const price = plan ? trialPriceLabel(plan) : null;
  return price
    ? `${remaining}, then ${PLANS[plan?.plan ?? "free"].displayName} at ${price}.`
    : `${remaining}.`;
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

export function paywallHeading(plan: AccountPlan | undefined): string {
  return plan?.trialOffer
    ? `Start your ${plan.trialOffer.days} day free trial`
    : "Keep optimizing without limits";
}

export function trialEndsOn(offer: TrialOffer, now: Date): Date {
  return new Date(now.getTime() + offer.days * DAY_MS);
}

function trialLine(offer: TrialOffer, now: Date): string {
  return `Pay $0 today. Your trial ends on ${formatDate(trialEndsOn(offer, now).toISOString())}, then the plan you choose is charged. Cancel any time from settings.`;
}

export const CONFIRM_EMAIL_TITLE = "Confirm your email";

export const CONFIRM_EMAIL_CAPTION =
  "Check your spam folder if it has not arrived. The link works for a day.";

export const WRONG_ADDRESS = "Wrong address?";

export const REGISTER_AGAIN = "and register again.";

export interface ConfirmEmailParts {
  before: string;
  address: string;
  after: string;
}

export function confirmEmailParts(
  email: string,
  offered: boolean,
): ConfirmEmailParts {
  return {
    before: "Thank you for registering. We sent a link to ",
    address: email,
    after: `. Open it to continue${offered ? " to your free trial" : ""}.`,
  };
}

export function confirmEmailLine(email: string, offered: boolean): string {
  const { before, address, after } = confirmEmailParts(email, offered);
  return `${before}${address}${after}`;
}

export function planActionLabel(
  action: PlanAction,
  displayName: string,
): string {
  return action === "checkout" ? `Choose ${displayName}` : ACTION_LABEL[action];
}

function paywallTrialLine(plan: AccountPlan): string | null {
  const trialEnd = cardTrialEnd(plan);
  if (trialEnd) {
    return plan.cancelAtPeriodEnd
      ? nothingCharged(trialEnd)
      : `Your trial runs until ${formatDate(trialEnd)}${thenCharged(plan)}. Change or cancel it in the billing portal.`;
  }
  if (declined(plan)) return TRIAL_CHARGE_DECLINED;
  if (plan.plan === "trial" && plan.trialEndsAt) {
    return `Your trial is active until ${formatDate(plan.trialEndsAt)}.`;
  }
  return null;
}

function settingsTrialLine(plan: AccountPlan): string | null {
  if (plan.plan === "trial" && plan.trialEndsAt) {
    return `Trial active until ${formatDate(plan.trialEndsAt)}.`;
  }
  const trialEnd = cardTrialEnd(plan);
  if (!trialEnd) return null;
  return plan.cancelAtPeriodEnd
    ? nothingCharged(trialEnd)
    : `Trial until ${formatDate(trialEnd)}${thenCharged(plan)}.`;
}

export function paywallStatusLine(
  plan: AccountPlan | undefined,
  now = new Date(),
): string {
  if (!plan) return CHOOSE_A_PLAN;
  if (pending(plan)) return PAYMENT_CONFIRMING;
  if (plan.trialOffer && !plan.subscribed) {
    return trialLine(plan.trialOffer, now);
  }
  const trial = paywallTrialLine(plan);
  if (trial) return trial;
  if (stalled(plan)) return STALLED_ON_THE_PAYWALL;
  if (plan.trialEndsAt && !plan.entitled) {
    return `Your trial ended on ${formatDate(plan.trialEndsAt)}. Your data is still here.`;
  }
  if (plan.renewsAt) {
    return `Your ${PLANS[plan.plan].displayName} plan renews on ${formatDate(plan.renewsAt)}.`;
  }
  return CHOOSE_A_PLAN;
}

export function planStatusLine(plan: AccountPlan): string {
  if (pending(plan)) return PAYMENT_CONFIRMING;
  if (declined(plan)) return TRIAL_CHARGE_DECLINED;
  if (stalled(plan)) return STALLED_IN_SETTINGS;
  if (plan.trialOffer && !plan.subscribed) return START_ON_THE_PLAN_PAGE;
  if (!plan.entitled) {
    return "Your data stays readable and exportable; tracking resumes when you choose a plan.";
  }
  const trial = settingsTrialLine(plan);
  if (trial) return trial;
  if (plan.cancelAtPeriodEnd && plan.renewsAt) {
    return `Cancelled. Access continues until ${formatDate(plan.renewsAt)}.`;
  }
  if (plan.renewsAt) return `Renews on ${formatDate(plan.renewsAt)}.`;
  return "Billed monthly until you cancel.";
}

export function planCallToAction(plan: AccountPlan): string {
  if (plan.entitled) return "Upgrade plan";
  return stalled(plan) ? "Resume plan" : "Choose a plan";
}

export function paymentNote(catalog: BillingCatalog | undefined): string {
  if (!catalog?.enabled) return CHECKOUT_UNCONFIGURED;
  return catalog.managedPayments ? SOLD_THROUGH_LINK : HANDLED_BY_STRIPE;
}

export function trialPaymentNote(
  catalog: BillingCatalog | undefined,
  offer: TrialOffer | null | undefined,
  now: Date,
): string {
  const note = paymentNote(catalog);
  if (!offer || !catalog?.enabled) return note;
  return `${note} Your card is verified now and charged on ${formatDate(trialEndsOn(offer, now).toISOString())}.`;
}

export function memberPlanLine(plan: AccountPlan | undefined): string {
  if (plan && !plan.entitled) return `${COLLECTION_PAUSED} ${ASK_THE_OWNER}`;
  return "Only the workspace owner can change the plan or the payment method.";
}

export function billingNote(interval: BillingInterval): string {
  return BILLED[interval];
}
