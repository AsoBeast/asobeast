import type { Store } from '../index';
import type { DeletionReason } from './account';
import type { PlanName } from './plans';

export const ADMIN_LIST_LIMIT = 1000;

export const ADMIN_SIGNUP_DAYS = 30;

export const ACTIVATION_WINDOW_DAYS = 30;

export const WORKSPACE_STAGES = [
  'trialing',
  'paying',
  'payment-failed',
  'comped',
  'trial-ended',
  'churned',
  'no-plan',
  'self-hosted',
] as const;

export type WorkspaceStage = (typeof WORKSPACE_STAGES)[number];

export interface AdminCount<K extends string> {
  key: K;
  count: number;
}

export interface AdminSignupDay {
  date: string;
  users: number;
  workspaces: number;
}

export interface AdminActivation {
  importedLast30Days: number;
  rankedWithinADay: number;
  completedSetup: number;
}

export interface AdminOverview {
  generatedAt: string;
  billing: boolean;
  workspaces: {
    total: number;
    suspended: number;
    pendingDeletion: number;
    byPlan: AdminCount<PlanName>[];
    byStage?: AdminCount<WorkspaceStage>[];
    canceling?: number;
  };
  users: {
    total: number;
    emailVerified: number;
    joinedLast7Days: number;
    joinedLast30Days: number;
  };
  apps: {
    tracked: number;
    competitors: number;
    byStore: AdminCount<Store>[];
  };
  keywords: {
    trackedMarkets: number;
    searched: number;
    storefronts: number;
  };
  aiCallsThisMonth: number;
  signups: AdminSignupDay[];
  activation?: AdminActivation;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  emailVerified: boolean;
  platformOperator: boolean;
  createdAt: string;
  workspaceId: string;
  workspaceName: string;
  workspacePlan: PlanName;
  workspaceStage?: WorkspaceStage;
}

export interface AdminUserList {
  items: AdminUser[];
  total: number;
  limit: number;
}

export interface AdminApp {
  id: string;
  workspaceId: string;
  workspaceName: string;
  store: Store;
  storeAppId: string;
  country: string;
  name: string | null;
  iconUrl: string | null;
  competitors: number;
  keywordMarkets: number;
  createdAt: string;
}

export interface AdminAppList {
  items: AdminApp[];
  total: number;
  limit: number;
}

export const ADMIN_CONVERSION_WINDOWS = [30, 90] as const;

export type AdminConversionWindow = (typeof ADMIN_CONVERSION_WINDOWS)[number];

export const ADMIN_COHORT_WEEKS = 8;

export const TRIAL_ENDING_SOON_DAYS = 3;

export const ADMIN_FUNNEL_STEPS = [
  'signed-up',
  'confirmed-email',
  'first-app',
  'ranked-within-a-day',
  'trial-started',
  'paid',
] as const;

export type AdminFunnelStepKey = (typeof ADMIN_FUNNEL_STEPS)[number];

export const ADMIN_BILLING_FUNNEL_STEPS: readonly AdminFunnelStepKey[] = [
  'trial-started',
  'paid',
];

export type AdminDepartureReason = DeletionReason | 'unanswered';

export const ADMIN_DEPARTURE_REASONS: readonly AdminDepartureReason[] = [
  'too-expensive',
  'missing-feature',
  'not-using',
  'switched-tool',
  'other',
  'unanswered',
];

export interface AdminTrialRate {
  paid: number;
  ended: number;
}

export interface AdminMedianDays {
  signupToFirstApp: number | null;
  signupToTrial?: number | null;
  trialToPaid?: number | null;
}

export interface AdminCohortWeek {
  weekStart: string;
  signedUp: number;
  confirmedEmail: number;
  firstApp: number;
  trialStarted?: number;
  paid?: number;
  stillPaying?: number;
}

export interface AdminDepartureTally {
  total: number;
  byStage: AdminCount<WorkspaceStage>[];
  byReason: AdminCount<AdminDepartureReason>[];
}

export interface AdminConversion {
  generatedAt: string;
  billing: boolean;
  days: AdminConversionWindow;
  funnel: AdminCount<AdminFunnelStepKey>[];
  trialToPaid?: { current: AdminTrialRate; previous: AdminTrialRate };
  trials?: { inProgress: number; endingSoon: number };
  medianDays: AdminMedianDays;
  cohorts: AdminCohortWeek[];
  departures: AdminDepartureTally;
  departuresRecordedSince: string | null;
}

export interface AdminDeparture {
  id: string;
  erasedOn: string;
  createdOn: string;
  requestedOn: string;
  stage: WorkspaceStage;
  plan: PlanName;
  everPaid: boolean;
  apps: number;
  keywordMarkets: number;
  members: number;
  reason: DeletionReason | null;
}

export interface AdminDepartureList {
  items: AdminDeparture[];
  total: number;
  limit: number;
}
