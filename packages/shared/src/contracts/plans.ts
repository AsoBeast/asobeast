export const PLAN_NAMES = ['free', 'trial', 'indie', 'ultimate'] as const;

export type PlanName = (typeof PLAN_NAMES)[number];

export const PAID_PLAN_NAMES = ['indie', 'ultimate'] as const;

export type PaidPlanName = (typeof PAID_PLAN_NAMES)[number];

export const FREE_PLAN: PlanName = 'free';

export const TRIAL_PLAN: PlanName = 'trial';

export const LEGACY_PREMIUM_PLAN = 'premium';

export const ON_DEMAND_ACTIONS = [
  'refresh',
  'runDaily',
  'score',
  'suggestions',
] as const;

export type OnDemandAction = (typeof ON_DEMAND_ACTIONS)[number];

export interface OnDemandRule {
  limit: number;
  windowSeconds: number;
}

export type OnDemandRules = Record<OnDemandAction, OnDemandRule>;

export type PlanLimit = number | null;

export interface PlanLimits {
  apps: PlanLimit;
  keywordMarkets: PlanLimit;
  competitorsPerApp: PlanLimit;
  apiRequestsPerMinute: PlanLimit;
  apiWritesPerMinute: PlanLimit;
  apiRequestsPerDay: PlanLimit;
  apiConcurrentRequests: PlanLimit;
  mcpRequestsPerMinute: PlanLimit;
  onDemand: OnDemandRules | null;
}

export interface PlanRates {
  apiRequestsPerMinute: PlanLimit;
  apiWritesPerMinute: PlanLimit;
  apiRequestsPerDay: PlanLimit;
  apiConcurrentRequests: PlanLimit;
  mcpRequestsPerMinute: PlanLimit;
}

export interface PlanPrices {
  monthlyUsd: number | null;
  annualUsd: number | null;
}

export interface PlanDefinition {
  name: PlanName;
  displayName: string;
  prices: PlanPrices;
  limits: PlanLimits;
}

const DAY_SECONDS = 24 * 60 * 60;
const HOUR_SECONDS = 60 * 60;

const NO_PRICE: PlanPrices = { monthlyUsd: null, annualUsd: null };

const INDIE_RATES: PlanRates = {
  apiRequestsPerMinute: 60,
  apiWritesPerMinute: 20,
  apiRequestsPerDay: 10_000,
  apiConcurrentRequests: 8,
  mcpRequestsPerMinute: 60,
};

const ULTIMATE_RATES: PlanRates = {
  apiRequestsPerMinute: 300,
  apiWritesPerMinute: 100,
  apiRequestsPerDay: 100_000,
  apiConcurrentRequests: 24,
  mcpRequestsPerMinute: 300,
};

const NO_CAPACITY: PlanLimits = {
  apps: 0,
  keywordMarkets: 0,
  competitorsPerApp: 0,
  ...INDIE_RATES,
  mcpRequestsPerMinute: 0,
  onDemand: {
    refresh: { limit: 0, windowSeconds: DAY_SECONDS },
    runDaily: { limit: 0, windowSeconds: DAY_SECONDS },
    score: { limit: 0, windowSeconds: DAY_SECONDS },
    suggestions: { limit: 0, windowSeconds: HOUR_SECONDS },
  },
};

const INDIE: PlanLimits = {
  apps: 5,
  keywordMarkets: 1_000,
  competitorsPerApp: 10,
  ...INDIE_RATES,
  onDemand: {
    refresh: { limit: 50, windowSeconds: DAY_SECONDS },
    runDaily: { limit: 5, windowSeconds: DAY_SECONDS },
    score: { limit: 100, windowSeconds: DAY_SECONDS },
    suggestions: { limit: 60, windowSeconds: HOUR_SECONDS },
  },
};

const ULTIMATE: PlanLimits = {
  apps: 50,
  keywordMarkets: 10_000,
  competitorsPerApp: 25,
  ...ULTIMATE_RATES,
  onDemand: {
    refresh: { limit: 500, windowSeconds: DAY_SECONDS },
    runDaily: { limit: 20, windowSeconds: DAY_SECONDS },
    score: { limit: 1_000, windowSeconds: DAY_SECONDS },
    suggestions: { limit: 300, windowSeconds: HOUR_SECONDS },
  },
};

export const SELF_HOSTED_LIMITS: PlanLimits = {
  apps: null,
  keywordMarkets: null,
  competitorsPerApp: INDIE.competitorsPerApp,
  apiRequestsPerMinute: null,
  apiWritesPerMinute: null,
  apiRequestsPerDay: null,
  apiConcurrentRequests: null,
  mcpRequestsPerMinute: null,
  onDemand: null,
};

export const PLAN_LIMITS: Record<PlanName, PlanLimits> = {
  free: NO_CAPACITY,
  trial: INDIE,
  indie: INDIE,
  ultimate: ULTIMATE,
};

export const PLANS: Record<PlanName, PlanDefinition> = {
  free: {
    name: 'free',
    displayName: 'Free',
    prices: NO_PRICE,
    limits: PLAN_LIMITS.free,
  },
  trial: {
    name: 'trial',
    displayName: 'Trial',
    prices: NO_PRICE,
    limits: PLAN_LIMITS.trial,
  },
  indie: {
    name: 'indie',
    displayName: 'Indie',
    prices: { monthlyUsd: 10, annualUsd: 100 },
    limits: PLAN_LIMITS.indie,
  },
  ultimate: {
    name: 'ultimate',
    displayName: 'Ultimate',
    prices: { monthlyUsd: 99, annualUsd: 990 },
    limits: PLAN_LIMITS.ultimate,
  },
};

export const PLAN_UPGRADE: Record<PlanName, PaidPlanName | null> = {
  free: 'indie',
  trial: 'indie',
  indie: 'ultimate',
  ultimate: null,
};

const PLAN_ALIASES: Record<string, PlanName> = {
  free: 'free',
  trial: 'trial',
  indie: 'indie',
  ultimate: 'ultimate',
  [LEGACY_PREMIUM_PLAN]: 'indie',
};

export function planOf(plan: string | null | undefined): PlanName {
  if (!plan) return FREE_PLAN;
  return PLAN_ALIASES[plan.trim().toLowerCase()] ?? FREE_PLAN;
}

export function isPaidPlan(plan: PlanName): plan is PaidPlanName {
  return PAID_PLAN_NAMES.includes(plan as PaidPlanName);
}

export function paidPlanOf(
  plan: string | null | undefined,
): PaidPlanName | null {
  const resolved = planOf(plan);
  return isPaidPlan(resolved) ? resolved : null;
}

export function nextPlan(plan: PlanName): PaidPlanName | null {
  return PLAN_UPGRADE[plan];
}

export interface PlanEntitlement {
  plan: string;
  trialEndsAt: Date | null;
  planExpiresAt: Date | null;
}

export function effectivePlan(
  entitlement: PlanEntitlement,
  now: Date,
): PlanName {
  const paid = paidPlanOf(entitlement.plan);
  if (
    paid &&
    (entitlement.planExpiresAt === null || entitlement.planExpiresAt > now)
  ) {
    return paid;
  }
  if (entitlement.trialEndsAt !== null && entitlement.trialEndsAt > now) {
    return TRIAL_PLAN;
  }
  return FREE_PLAN;
}

export const QUOTA_RESOURCES = [
  'apps',
  'keywordMarkets',
  'competitors',
] as const;

export type QuotaResource = (typeof QUOTA_RESOURCES)[number];

export interface QuotaUsage {
  used: number;
  limit: PlanLimit;
}

export interface QuotaDetail {
  resource: QuotaResource;
  plan: PlanName;
  limit: number;
  used: number;
  requested: number;
  upgradeTo: PaidPlanName | null;
}
