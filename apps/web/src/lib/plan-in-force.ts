import {
  PLANS,
  effectivePlan,
  type AuthUser,
  type PlanName,
} from "@asobeast/shared";

type PlanTerms = Pick<AuthUser, "plan" | "trialEndsAt" | "planExpiresAt">;

function dateOf(iso: string | null): Date | null {
  return iso === null ? null : new Date(iso);
}

export function planInForce(user: PlanTerms, now: Date): PlanName {
  return effectivePlan(
    {
      plan: user.plan,
      trialEndsAt: dateOf(user.trialEndsAt),
      planExpiresAt: dateOf(user.planExpiresAt),
    },
    now,
  );
}

export function planInForceLabel(user: PlanTerms, now: Date): string {
  return PLANS[planInForce(user, now)].displayName;
}
