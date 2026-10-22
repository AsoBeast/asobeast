import {
  FREE_PLAN,
  PLAN_LIMITS,
  SELF_HOSTED_LIMITS,
  effectivePlan,
  paidPlanOf,
  trialingLimits,
  type PlanEntitlement,
  type PlanLimits,
  type PlanName,
} from '@asobeast/shared';

export interface PlanScope {
  plan: PlanName;
  limits: PlanLimits;
}

export function selfHostedLimits(aiCallsPerMonth: number | null): PlanLimits {
  return { ...SELF_HOSTED_LIMITS, aiCallsPerMonth };
}

export interface PlanScopeSource extends PlanEntitlement {
  subscriptionStatus: string | null;
}

export function planScopeOf(
  metered: boolean,
  workspace: PlanScopeSource | null,
  now: Date,
  selfHosted: PlanLimits = SELF_HOSTED_LIMITS,
): PlanScope {
  if (!metered) return { plan: FREE_PLAN, limits: selfHosted };
  const plan = workspace ? effectivePlan(workspace, now) : FREE_PLAN;
  const trialing =
    workspace?.subscriptionStatus === 'trialing' && paidPlanOf(plan) !== null;
  return {
    plan,
    limits: trialing ? trialingLimits(PLAN_LIMITS[plan]) : PLAN_LIMITS[plan],
  };
}
