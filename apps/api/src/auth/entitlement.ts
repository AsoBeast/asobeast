import {
  FREE_PLAN,
  UPGRADE_PATH,
  effectivePlan,
  nextPlan,
  type EntitlementDetail,
  type PlanEntitlement,
} from '@asobeast/shared';

export type WorkspaceEntitlement = PlanEntitlement;

export const isEntitled = (
  workspace: WorkspaceEntitlement,
  now: Date,
): boolean => effectivePlan(workspace, now) !== FREE_PLAN;

export function entitlementDetail(
  workspace: WorkspaceEntitlement,
  now: Date,
): EntitlementDetail {
  const plan = effectivePlan(workspace, now);
  return {
    plan,
    trialEndsAt: workspace.trialEndsAt?.toISOString() ?? null,
    planExpiresAt: workspace.planExpiresAt?.toISOString() ?? null,
    upgradeTo: nextPlan(plan),
    upgradePath: UPGRADE_PATH,
  };
}
