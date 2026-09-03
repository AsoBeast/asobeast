import { PLANS, type AccountPlan, type PaidPlanName } from "@asobeast/shared";
import { formatDate } from "@/lib/format";

export type PlanAction = "current" | "checkout" | "change" | "resume";

const CHOOSE_A_PLAN = "Choose a plan to unlock asobeast.";

const STALLED_ON_THE_PAYWALL =
  "Your subscription stopped collecting. Add a payment method in the billing portal and it picks up where it left off.";

const STALLED_IN_SETTINGS =
  "Your subscription stopped collecting. Add a payment method in the billing portal and tracking resumes.";

const ACTION_LABEL: Record<Exclude<PlanAction, "checkout">, string> = {
  current: "Current plan",
  change: "Change in the billing portal",
  resume: "Resume in the billing portal",
};

export function planAction(
  plan: AccountPlan | undefined,
  name: PaidPlanName,
): PlanAction {
  if (plan?.plan === name) return "current";
  if (!plan?.subscribed) return "checkout";
  return plan.subscriptionStalled ? "resume" : "change";
}

export function planActionLabel(
  action: PlanAction,
  displayName: string,
): string {
  return action === "checkout" ? `Choose ${displayName}` : ACTION_LABEL[action];
}

export function paywallStatusLine(plan: AccountPlan | undefined): string {
  if (!plan) return CHOOSE_A_PLAN;
  if (plan.plan === "trial" && plan.trialEndsAt) {
    return `Your trial is active until ${formatDate(plan.trialEndsAt)}.`;
  }
  if (plan.subscriptionStalled) return STALLED_ON_THE_PAYWALL;
  if (plan.trialEndsAt && !plan.entitled) {
    return `Your trial ended on ${formatDate(plan.trialEndsAt)}. Your data is still here.`;
  }
  if (plan.renewsAt) {
    return `Your ${PLANS[plan.plan].displayName} plan renews on ${formatDate(plan.renewsAt)}.`;
  }
  return CHOOSE_A_PLAN;
}

export function planStatusLine(plan: AccountPlan): string {
  if (plan.subscriptionStalled) return STALLED_IN_SETTINGS;
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
  return plan.subscriptionStalled ? "Resume plan" : "Choose a plan";
}
