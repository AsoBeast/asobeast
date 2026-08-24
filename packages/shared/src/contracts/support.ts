import type { PlanLimits, PlanName } from './plans';

export const SUPPORT_ACTIONS = [
  'list',
  'view',
  'reconcile',
  'suspend',
  'restore',
  'run-daily',
] as const;

export type SupportAction = (typeof SUPPORT_ACTIONS)[number];

export const SUPPORT_OUTCOMES = ['attempted', 'succeeded', 'failed'] as const;

export type SupportOutcome = (typeof SUPPORT_OUTCOMES)[number];

export const SUPPORT_MUTATIONS: SupportAction[] = [
  'reconcile',
  'suspend',
  'restore',
  'run-daily',
];

export interface SupportWorkspaceSummary {
  workspaceId: string;
  name: string;
  plan: PlanName;
  storedPlan: string;
  createdAt: string;
  suspendedAt: string | null;
  suspendedReason: string | null;
  trialEndsAt: string | null;
  planExpiresAt: string | null;
  subscriptionStatus: string | null;
  hasSubscription: boolean;
  members: number;
  apps: number;
  competitors: number;
  keywordMarkets: number;
}

export interface SupportRunDay {
  date: string;
  captured: number;
  unresolved: number;
}

export interface SupportFailedJob {
  id: string;
  name: string;
  queue: string;
  attempts: number;
  failedAt: string | null;
  reason: string;
}

export interface SupportAccessEntry {
  actorEmail: string;
  action: SupportAction;
  outcome: SupportOutcome;
  reason: string | null;
  detail: string | null;
  at: string;
}

export interface SupportWorkspaceDetail extends SupportWorkspaceSummary {
  limits: PlanLimits;
  runHistory: SupportRunDay[];
  failedJobs: SupportFailedJob[];
  recentAccess: SupportAccessEntry[];
}

export interface SupportActionResult {
  action: SupportAction;
  workspaceId: string;
  detail: string;
}
