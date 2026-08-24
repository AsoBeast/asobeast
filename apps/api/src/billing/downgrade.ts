import {
  FREE_PLAN,
  PLAN_LIMITS,
  isPaidPlan,
  planOf,
  type PlanName,
} from '@asobeast/shared';

const DAY_MS = 24 * 60 * 60 * 1000;

export const DOWNGRADE_WARNING_DAYS = 7;

export interface OverLimitResource {
  resource: string;
  used: number;
  limit: number;
}

export interface PendingChange {
  plan: string;
  pendingPlan: string | null;
  cancelAtPeriodEnd: boolean;
  planExpiresAt: Date | null;
  downgradeWarnedAt: Date | null;
}

export interface WorkspaceCounts {
  apps: number;
  keywordMarkets: number;
}

export function planAfterChange(change: PendingChange): PlanName {
  if (change.cancelAtPeriodEnd) return FREE_PLAN;
  return planOf(change.pendingPlan ?? change.plan);
}

export function warningDue(change: PendingChange, now: Date): boolean {
  if (change.downgradeWarnedAt !== null) return false;
  if (!change.planExpiresAt) return false;

  const next = planAfterChange(change);
  if (!isPaidPlan(next) || next === planOf(change.plan)) return false;

  const remaining = change.planExpiresAt.getTime() - now.getTime();
  return remaining > 0 && remaining <= DOWNGRADE_WARNING_DAYS * DAY_MS;
}

export function overLimitAfter(
  plan: PlanName,
  counts: WorkspaceCounts,
): OverLimitResource[] {
  const limits = PLAN_LIMITS[plan];
  return [
    { resource: 'apps', used: counts.apps, limit: limits.apps },
    {
      resource: 'keyword markets',
      used: counts.keywordMarkets,
      limit: limits.keywordMarkets,
    },
  ].flatMap(({ resource, used, limit }) =>
    limit !== null && used > limit ? [{ resource, used, limit }] : [],
  );
}
