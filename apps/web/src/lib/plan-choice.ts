import {
  PLANS,
  type AccountPlan,
  type BillingCatalog,
  type BillingInterval,
  type PaidPlanName,
} from "@asobeast/shared";
import { formatDate } from "@/lib/format";

export type PlanAction =
  "current" | "checkout" | "change" | "resume" | "pending";

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

export const CONFIRM_EMAIL_TO_START_TRIAL =
  "Confirm your email to start your free trial.";

const CONFIRMATION_PENDING = `${CONFIRM_EMAIL_TO_START_TRIAL} Open the link we emailed you when you registered.`;

const STALLED_ON_THE_PAYWALL =
  "Your subscription stopped collecting. Add a payment method in the billing portal and it picks up where it left off.";

const STALLED_IN_SETTINGS =
  "Your subscription stopped collecting. Add a payment method in the billing portal and tracking resumes.";

const ACTION_LABEL: Record<Exclude<PlanAction, "checkout">, string> = {
  current: "Current plan",
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

export function planAction(
  plan: AccountPlan | undefined,
  name: PaidPlanName,
): PlanAction {
  if (plan?.plan === name) return "current";
  if (plan && pending(plan)) return "pending";
  if (!plan?.subscribed) return "checkout";
  return stalled(plan) ? "resume" : "change";
}

export function planActionLabel(
  action: PlanAction,
  displayName: string,
): string {
  return action === "checkout" ? `Choose ${displayName}` : ACTION_LABEL[action];
}

export function paywallStatusLine(
  plan: AccountPlan | undefined,
  awaitingConfirmation = false,
): string {
  if (!plan) {
    return awaitingConfirmation ? CONFIRMATION_PENDING : CHOOSE_A_PLAN;
  }
  if (pending(plan)) return PAYMENT_CONFIRMING;
  if (plan.plan === "trial" && plan.trialEndsAt) {
    return `Your trial is active until ${formatDate(plan.trialEndsAt)}.`;
  }
  if (stalled(plan)) return STALLED_ON_THE_PAYWALL;
  if (awaitingConfirmation) return CONFIRMATION_PENDING;
  if (plan.trialEndsAt && !plan.entitled) {
    return `Your trial ended on ${formatDate(plan.trialEndsAt)}. Your data is still here.`;
  }
  if (plan.renewsAt) {
    return `Your ${PLANS[plan.plan].displayName} plan renews on ${formatDate(plan.renewsAt)}.`;
  }
  return CHOOSE_A_PLAN;
}

export function planStatusLine(
  plan: AccountPlan,
  awaitingConfirmation = false,
): string {
  if (pending(plan)) return PAYMENT_CONFIRMING;
  if (stalled(plan)) return STALLED_IN_SETTINGS;
  if (awaitingConfirmation) return CONFIRMATION_PENDING;
  if (!plan.entitled) {
    return "Your data stays readable and exportable; tracking resumes when you choose a plan.";
  }
  if (plan.plan === "trial" && plan.trialEndsAt) {
    return `Trial active until ${formatDate(plan.trialEndsAt)}.`;
  }
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

export function memberPlanLine(plan: AccountPlan | undefined): string {
  if (plan && !plan.entitled) return `${COLLECTION_PAUSED} ${ASK_THE_OWNER}`;
  return "Only the workspace owner can change the plan or the payment method.";
}

export function billingNote(interval: BillingInterval): string {
  return BILLED[interval];
}
