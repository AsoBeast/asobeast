import {
  FREE_PLAN,
  PLAN_LIMITS,
  SELF_HOSTED_LIMITS,
  effectivePlan,
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

export function planScopeOf(
  metered: boolean,
  workspace: PlanEntitlement | null,
  now: Date,
  selfHosted: PlanLimits = SELF_HOSTED_LIMITS,
): PlanScope {
  if (!metered) return { plan: FREE_PLAN, limits: selfHosted };
  const plan = workspace ? effectivePlan(workspace, now) : FREE_PLAN;
  return { plan, limits: PLAN_LIMITS[plan] };
}
