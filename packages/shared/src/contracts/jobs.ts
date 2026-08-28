import type { Store } from '../index';
import type { PlanName, QuotaUsage } from './plans';

export interface FanOutSummary {
  apps: number;
  keywords: number;
  categories: number;
  reviews: number;
}

export interface RunDailyResult {
  enqueued: FanOutSummary;
}

export interface ScoreEnqueueResult {
  enqueued: true;
}

export interface StoreDailyBudget {
  store: Store;
  apps: number;
  keywords: number;
  categories: number;
  reviews: number;
  total: number;
  capacityPerDay: number;
  utilization: number;
}

export interface BudgetQuota {
  plan: PlanName;
  apps: QuotaUsage;
  keywordMarkets: QuotaUsage;
  overLimitSince: string | null;
}

export interface BudgetCompletion {
  startsAt: string | null;
  completesAt: string | null;
  hours: number | null;
}

export interface DailyBudget {
  apps: number;
  keywords: number;
  categories: number;
  reviews: number;
  total: number;
  capacityPerDay: number;
  utilization: number;
  stores: StoreDailyBudget[];
  quota: BudgetQuota | null;
  completion: BudgetCompletion;
}

export interface WorkspaceDemand {
  workspaceId: string;
  requests: number;
}

export interface CapacityReport {
  requestsPerDay: number;
  capacityPerDay: number;
  utilization: number;
  workspaces: WorkspaceDemand[];
}

export const RUN_STATES = ['idle', 'running', 'complete', 'delayed'] as const;

export type RunState = (typeof RUN_STATES)[number];

export interface StoreRunStatus {
  store: Store;
  tracked: number;
  captured: number;
}

export interface WorkspaceRunStatus {
  state: RunState;
  startedAt: string | null;
  lastCaptureAt: string | null;
  tracked: number;
  captured: number;
  stores: StoreRunStatus[];
}

export const FIRST_RUN_STAGES = [
  'metadata',
  'keywords',
  'rankings',
  'scores',
  'reviews',
  'history',
] as const;

export type FirstRunStage = (typeof FIRST_RUN_STAGES)[number];

export const FIRST_RUN_HISTORY_DAYS = 7;

export interface FirstRunStageStatus {
  stage: FirstRunStage;
  ready: number;
  total: number;
  complete: boolean;
  expectedBy: string | null;
}

export interface FirstRunStatus {
  appId: string;
  complete: boolean;
  stages: FirstRunStageStatus[];
}
