import type { Store } from '../index';
import type { PlanName } from './plans';

export const ADMIN_LIST_LIMIT = 1000;

export const ADMIN_SIGNUP_DAYS = 30;

export interface AdminCount<K extends string> {
  key: K;
  count: number;
}

export interface AdminSignupDay {
  date: string;
  users: number;
  workspaces: number;
}

export interface AdminOverview {
  generatedAt: string;
  billing: boolean;
  workspaces: {
    total: number;
    suspended: number;
    pendingDeletion: number;
    byPlan: AdminCount<PlanName>[];
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
