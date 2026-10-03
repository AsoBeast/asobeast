import type {
  AdminApp,
  AdminAppList,
  AdminOverview,
  AdminSignupDay,
  AdminUser,
  AdminUserList,
  CapacityReport,
  ProxyOutcomeCounts,
  ProxyPoolHealth,
  SupportWorkspaceSummary,
} from "@asobeast/shared";
import { utcDaysAgo, utcTimestampDaysAgo } from "./fixtures.mts";

const SIGNUP_DAYS = 30;

const SIGNUPS_BY_DAYS_AGO = new Map([
  [0, { users: 2, workspaces: 1 }],
  [3, { users: 1, workspaces: 1 }],
  [9, { users: 1, workspaces: 0 }],
  [17, { users: 1, workspaces: 1 }],
]);

const SIGNUPS: AdminSignupDay[] = Array.from(
  { length: SIGNUP_DAYS },
  (_, index) => {
    const daysAgo = SIGNUP_DAYS - 1 - index;
    return {
      date: utcDaysAgo(daysAgo),
      ...(SIGNUPS_BY_DAYS_AGO.get(daysAgo) ?? { users: 0, workspaces: 0 }),
    };
  },
);

export const ADMIN_OVERVIEW: AdminOverview = {
  generatedAt: new Date().toISOString(),
  billing: true,
  workspaces: {
    total: 3,
    suspended: 1,
    pendingDeletion: 0,
    byPlan: [
      { key: "free", count: 1 },
      { key: "trial", count: 1 },
      { key: "indie", count: 1 },
      { key: "ultimate", count: 0 },
    ],
  },
  users: {
    total: 5,
    emailVerified: 3,
    joinedLast7Days: 3,
    joinedLast30Days: 5,
  },
  apps: {
    tracked: 4,
    competitors: 6,
    byStore: [
      { key: "APP_STORE", count: 2 },
      { key: "GOOGLE_PLAY", count: 2 },
    ],
  },
  keywords: { trackedMarkets: 1234, searched: 987, storefronts: 5 },
  aiCallsThisMonth: 42,
  signups: SIGNUPS,
};

export const ADMIN_OVERVIEW_SELF_HOSTED: AdminOverview = {
  ...ADMIN_OVERVIEW,
  billing: false,
  workspaces: {
    ...ADMIN_OVERVIEW.workspaces,
    byPlan: [
      { key: "free", count: 3 },
      { key: "trial", count: 0 },
      { key: "indie", count: 0 },
      { key: "ultimate", count: 0 },
    ],
  },
};

export const CAPACITY_REPORT: CapacityReport = {
  requestsPerDay: 1520,
  capacityPerDay: 36000,
  utilization: 0.042,
  workspaces: [
    { workspaceId: "ws_ana", name: "Ana Apps", requests: 900 },
    { workspaceId: "ws_default", name: "Default", requests: 500 },
    { workspaceId: "ws_unnamed", requests: 120 },
  ],
  stores: [
    {
      store: "APP_STORE",
      requestsPerDay: 1100,
      capacityPerDay: 21600,
      utilization: 0.051,
    },
    {
      store: "GOOGLE_PLAY",
      requestsPerDay: 420,
      capacityPerDay: 14400,
      utilization: 0.029,
    },
  ],
};

const NO_OUTCOMES: ProxyOutcomeCounts = {
  SUCCESS: 0,
  TRANSPORT: 0,
  RATE_LIMITED: 0,
  BLOCKED: 0,
  SILENT: 0,
};

export const PROXY_POOL_OFF: ProxyPoolHealth = {
  enabled: false,
  provider: "none",
  total: 0,
  pending: 0,
  retired: 0,
  stores: [],
  endpoints: [],
  residential: {
    configured: false,
    month: utcDaysAgo(0).slice(0, 7),
    requests: 0,
    spendUsd: 0,
    capUsd: 0,
    fallbackRate: 0,
  },
  alerts: [],
};

export const PROXY_POOL_ON: ProxyPoolHealth = {
  ...PROXY_POOL_OFF,
  enabled: true,
  provider: "webshare",
  total: 12,
  pending: 1,
  retired: 2,
  stores: [
    {
      store: "APP_STORE",
      endpoints: 6,
      healthy: 5,
      coolingDown: 1,
      successRate: 0.97,
      outcomes: { ...NO_OUTCOMES, SUCCESS: 970, BLOCKED: 30 },
      requestsLastHour: 600,
      capacityPerHour: 5400,
    },
    {
      store: "GOOGLE_PLAY",
      endpoints: 6,
      healthy: 2,
      coolingDown: 4,
      successRate: 0.71,
      outcomes: { ...NO_OUTCOMES, SUCCESS: 710, RATE_LIMITED: 290 },
      requestsLastHour: 300,
      capacityPerHour: 3600,
    },
  ],
  residential: {
    ...PROXY_POOL_OFF.residential,
    configured: true,
    requests: 40,
    spendUsd: 1.5,
    capUsd: 10,
    fallbackRate: 0.01,
  },
  alerts: ["pool.healthy.low"],
};

const WORKSPACE_DEFAULTS = {
  suspendedAt: null,
  suspendedReason: null,
  trialEndsAt: null,
  planExpiresAt: null,
  subscriptionStatus: null,
  hasSubscription: false,
} as const;

export const SUPPORT_WORKSPACES: SupportWorkspaceSummary[] = [
  {
    ...WORKSPACE_DEFAULTS,
    workspaceId: "ws_default",
    name: "Default",
    plan: "free",
    storedPlan: "free",
    createdAt: utcTimestampDaysAgo(400),
    members: 2,
    apps: 2,
    competitors: 3,
    keywordMarkets: 30,
  },
  {
    ...WORKSPACE_DEFAULTS,
    workspaceId: "ws_ana",
    name: "Ana Apps",
    plan: "indie",
    storedPlan: "indie",
    createdAt: utcTimestampDaysAgo(20),
    subscriptionStatus: "active",
    hasSubscription: true,
    members: 2,
    apps: 2,
    competitors: 3,
    keywordMarkets: 40,
  },
  {
    ...WORKSPACE_DEFAULTS,
    workspaceId: "ws_lapsed",
    name: "Lapsed Studio",
    plan: "trial",
    storedPlan: "free",
    createdAt: utcTimestampDaysAgo(5),
    trialEndsAt: utcTimestampDaysAgo(-3),
    suspendedAt: utcTimestampDaysAgo(2),
    suspendedReason: "Sustained rate limit abuse",
    members: 1,
    apps: 0,
    competitors: 0,
    keywordMarkets: 0,
  },
];

const user = (
  overrides: Pick<AdminUser, "id" | "email" | "workspaceId"> &
    Partial<AdminUser>,
): AdminUser => {
  const workspace = SUPPORT_WORKSPACES.find(
    (candidate) => candidate.workspaceId === overrides.workspaceId,
  );
  return {
    name: null,
    role: "owner",
    emailVerified: true,
    platformOperator: false,
    createdAt: utcTimestampDaysAgo(1),
    workspaceName: workspace?.name ?? overrides.workspaceId,
    workspacePlan: workspace?.plan ?? "free",
    ...overrides,
  };
};

export const ADMIN_USERS: AdminUser[] = [
  user({
    id: "u-lee",
    email: "lee@lapsed.example.com",
    workspaceId: "ws_lapsed",
    emailVerified: false,
    createdAt: utcTimestampDaysAgo(5),
  }),
  user({
    id: "u-ben",
    email: "ben@example.com",
    workspaceId: "ws_ana",
    role: "member",
    emailVerified: false,
    createdAt: utcTimestampDaysAgo(10),
  }),
  user({
    id: "u-ana",
    email: "ana@example.com",
    name: "Ana Nowak",
    workspaceId: "ws_ana",
    createdAt: utcTimestampDaysAgo(20),
  }),
  user({
    id: "u3",
    email: "member@example.com",
    name: "Member",
    workspaceId: "ws_default",
    role: "member",
    createdAt: utcTimestampDaysAgo(100),
  }),
  user({
    id: "u1",
    email: "owner@example.com",
    name: "Owner",
    workspaceId: "ws_default",
    platformOperator: true,
    createdAt: utcTimestampDaysAgo(400),
  }),
];

export const ADMIN_LIST_TRUNCATED_TOTAL = 1204;

export function adminList<T extends { workspaceId: string }>(
  items: readonly T[],
  workspaceId: string | null,
  truncated: boolean,
): { items: T[]; total: number; limit: number } {
  const matching = workspaceId
    ? items.filter((item) => item.workspaceId === workspaceId)
    : [...items];
  return {
    items: matching,
    total: truncated ? ADMIN_LIST_TRUNCATED_TOTAL : matching.length,
    limit: 1000,
  };
}

export const adminUserList = (
  workspaceId: string | null,
  truncated: boolean,
): AdminUserList => adminList(ADMIN_USERS, workspaceId, truncated);

const app = (
  overrides: Pick<AdminApp, "id" | "workspaceId" | "store" | "storeAppId"> &
    Partial<AdminApp>,
): AdminApp => ({
  workspaceName:
    SUPPORT_WORKSPACES.find(
      (workspace) => workspace.workspaceId === overrides.workspaceId,
    )?.name ?? overrides.workspaceId,
  country: "us",
  name: null,
  iconUrl: null,
  competitors: 0,
  keywordMarkets: 0,
  createdAt: utcTimestampDaysAgo(1),
  ...overrides,
});

export const ADMIN_APPS: AdminApp[] = [
  app({
    id: "admin-app-ana-ios",
    workspaceId: "ws_ana",
    store: "APP_STORE",
    storeAppId: "100000001",
    name: "Ana Habits",
    competitors: 2,
    keywordMarkets: 25,
    createdAt: utcTimestampDaysAgo(3),
  }),
  app({
    id: "admin-app-ana-play",
    workspaceId: "ws_ana",
    store: "GOOGLE_PLAY",
    storeAppId: "com.ana.habits",
    country: "de",
    competitors: 1,
    keywordMarkets: 15,
    createdAt: utcTimestampDaysAgo(6),
  }),
  app({
    id: "admin-app-default-ios",
    workspaceId: "ws_default",
    store: "APP_STORE",
    storeAppId: "200000001",
    name: "Focus Timer",
    competitors: 2,
    keywordMarkets: 20,
    createdAt: utcTimestampDaysAgo(300),
  }),
  app({
    id: "admin-app-default-play",
    workspaceId: "ws_default",
    store: "GOOGLE_PLAY",
    storeAppId: "com.example.habits",
    country: "gb",
    name: "Habit Tracker",
    competitors: 1,
    keywordMarkets: 10,
    createdAt: utcTimestampDaysAgo(200),
  }),
];

export const adminAppList = (
  workspaceId: string | null,
  truncated: boolean,
): AdminAppList => adminList(ADMIN_APPS, workspaceId, truncated);
