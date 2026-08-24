import type { PaidPlanName, PlanLimit, PlanLimits, PlanName } from './plans';

export const RATE_CLASSES = ['read', 'write', 'store'] as const;

export type RateClass = (typeof RATE_CLASSES)[number];

export const DEFAULT_RATE_CLASS: RateClass = 'read';

export const RATE_WINDOWS = ['minute', 'day', 'concurrent'] as const;

export type RateWindow = (typeof RATE_WINDOWS)[number];

export const RATE_BUDGETS = ['read', 'write', 'mcp', 'all'] as const;

export type RateBudget = (typeof RATE_BUDGETS)[number];

export interface RateRule {
  window: RateWindow;
  budget: RateBudget;
  limit: number;
  windowSeconds: number;
}

export interface RateLimitDetail {
  window: RateWindow;
  rateClass: RateClass;
  plan: PlanName;
  limit: number;
  resetSeconds: number;
  upgradeTo: PaidPlanName | null;
}

export const MINUTE_SECONDS = 60;

export const DAY_SECONDS = 24 * 60 * 60;

export function budgetOf(rateClass: RateClass): RateBudget {
  return rateClass === 'read' ? 'read' : 'write';
}

function perMinuteOf(limits: PlanLimits, budget: RateBudget): PlanLimit {
  return budget === 'read'
    ? limits.apiRequestsPerMinute
    : limits.apiWritesPerMinute;
}

export function rateRules(
  limits: PlanLimits,
  rateClass: RateClass,
): RateRule[] {
  const rules: RateRule[] = [];
  const budget = budgetOf(rateClass);
  const perMinute = perMinuteOf(limits, budget);
  if (perMinute !== null) {
    rules.push({
      window: 'minute',
      budget,
      limit: perMinute,
      windowSeconds: MINUTE_SECONDS,
    });
  }
  if (limits.apiRequestsPerDay !== null) {
    rules.push({
      window: 'day',
      budget: 'all',
      limit: limits.apiRequestsPerDay,
      windowSeconds: DAY_SECONDS,
    });
  }
  return rules;
}

export function mcpRateRule(limits: PlanLimits): RateRule | null {
  if (limits.mcpRequestsPerMinute === null) return null;
  return {
    window: 'minute',
    budget: 'mcp',
    limit: limits.mcpRequestsPerMinute,
    windowSeconds: MINUTE_SECONDS,
  };
}
