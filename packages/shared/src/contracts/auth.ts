import type { PaidPlanName, PlanLimits, PlanName, QuotaUsage } from './plans';

export interface AuthStatus {
  billing: boolean;
  registrationOpen: boolean;
  setupRequired: boolean;
  authenticated: boolean;
}

export interface AuthUser {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  role: string;
  plan: string;
  trialEndsAt: string | null;
  planExpiresAt: string | null;
  entitled: boolean;
  platformOperator: boolean;
}

export const API_TOKEN_SCOPES = ['read', 'write'] as const;

export type ApiTokenScope = (typeof API_TOKEN_SCOPES)[number];

export const DEFAULT_API_TOKEN_SCOPE: ApiTokenScope = 'read';

export const API_TOKEN_MAX_EXPIRY_DAYS = 365;

export interface ApiTokenItem {
  id: string;
  name: string;
  prefix: string;
  scope: ApiTokenScope;
  expiresAt: string | null;
  expired: boolean;
  lastUsedAt: string | null;
  usageCount: number;
  createdAt: string;
}

export interface ApiTokenCreated extends ApiTokenItem {
  token: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ChangePasswordRequest {
  current: string;
  next: string;
}

export interface ApiTokenCreateRequest {
  name: string;
  scope?: ApiTokenScope;
  expiresInDays?: number;
}

export interface AccountPlanUsage {
  apps: QuotaUsage;
  keywordMarkets: QuotaUsage;
}

export interface AccountPlan {
  plan: PlanName;
  displayName: string;
  billing: boolean;
  entitled: boolean;
  hasBillingAccount: boolean;
  subscribed: boolean;
  subscriptionStalled: boolean;
  cancelAtPeriodEnd: boolean;
  trialEndsAt: string | null;
  renewsAt: string | null;
  upgradeTo: PaidPlanName | null;
  upgradePath: string;
  limits: PlanLimits;
  usage: AccountPlanUsage;
}

export const WORKSPACE_ROLES = ['owner', 'member'] as const;

export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export interface WorkspaceMember {
  id: string;
  email: string;
  name: string | null;
  role: WorkspaceRole;
  createdAt: string;
}

export interface WorkspaceInviteItem {
  id: string;
  email: string;
  role: WorkspaceRole;
  expiresAt: string;
  createdAt: string;
}

export interface WorkspaceInviteCreated extends WorkspaceInviteItem {
  acceptPath: string;
  delivered: boolean;
}

export interface WorkspaceTeam {
  members: WorkspaceMember[];
  invites: WorkspaceInviteItem[];
}

export interface InviteMemberRequest {
  email: string;
}

export interface AcceptInviteRequest {
  token: string;
  password: string;
  name?: string;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface RequestPasswordResetRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}
