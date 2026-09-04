import type { PaidPlanName, PlanName, QuotaDetail } from './plans';
import type { RateLimitDetail } from './rate-limits';

export interface PipelineHealth {
  lastDailyRunAt: string | null;
  stale: boolean;
  failedJobs: number;
  actions: { generatedAt: string | null; open: number };
}

export interface HealthStatus {
  status: 'ok' | 'error';
  db: 'up' | 'down';
  redis: 'up' | 'down';
  pipeline: PipelineHealth | null;
}

export interface EntitlementDetail {
  plan: PlanName;
  trialEndsAt: string | null;
  planExpiresAt: string | null;
  upgradeTo: PaidPlanName | null;
  upgradePath: string;
}

export type BillingConflictReason =
  'subscription_exists' | 'checkout_in_flight';

export type BillingRecovery = 'portal' | 'retry';

export const BILLING_RECOVERY: Record<BillingConflictReason, BillingRecovery> =
  {
    subscription_exists: 'portal',
    checkout_in_flight: 'retry',
  };

export interface BillingConflictDetail {
  reason: BillingConflictReason;
  recovery: BillingRecovery;
}

export interface ApiErrorEnvelope {
  statusCode: number;
  error: string;
  message: string;
  path: string;
  timestamp: string;
  quota?: QuotaDetail;
  entitlement?: EntitlementDetail;
  billing?: BillingConflictDetail;
  rateLimit?: RateLimitDetail;
  retryAfterSeconds?: number;
}
