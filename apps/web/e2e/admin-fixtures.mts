import {
  PLAN_LIMITS,
  type AdminApp,
  type AdminAppList,
  type AdminOverview,
  type AdminPayingCount,
  type AdminSignupDay,
  type AdminUser,
  type AdminUserList,
  type CapacityReport,
  type ProxyOutcomeCounts,
  type ProxyPoolHealth,
  type SupportAccessEntry,
  type SupportFailedJob,
  type SupportRunDay,
  type SupportWorkspaceDetail,
  type SupportWorkspaceSummary,
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

const NOBODY_PAYING: AdminPayingCount[] = [
  { plan: "indie", interval: "month", count: 0 },
  { plan: "indie", interval: "year", count: 0 },
  { plan: "ultimate", interval: "month", count: 0 },
  { plan: "ultimate", interval: "year", count: 0 },
];

export const ADMIN_OVERVIEW: AdminOverview = {
  generatedAt: new Date().toISOString(),
  billing: true,
  workspaces: {
    total: 8,
    suspended: 1,
    pendingDeletion: 1,
    byPlan: [
      { key: "free", count: 3 },
      { key: "trial", count: 1 },
      { key: "indie", count: 2 },
      { key: "ultimate", count: 2 },
    ],
    byStage: [
      { key: "trialing", count: 2 },
      { key: "paying", count: 2 },
      { key: "payment-failed", count: 1 },
      { key: "comped", count: 0 },
      { key: "trial-ended", count: 1 },
      { key: "churned", count: 1 },
      { key: "no-plan", count: 1 },
      { key: "self-hosted", count: 0 },
    ],
    canceling: 1,
    payingByPlan: [
      { plan: "indie", interval: "month", count: 1 },
      { plan: "indie", interval: "year", count: 0 },
      { plan: "ultimate", interval: "month", count: 0 },
      { plan: "ultimate", interval: "year", count: 1 },
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
  activation: {
    importedLast30Days: 12,
    rankedWithinADay: 9,
    completedSetup: 7,
  },
};

export const ADMIN_OVERVIEW_SELF_HOSTED: AdminOverview = {
  ...ADMIN_OVERVIEW,
  billing: false,
  workspaces: {
    ...ADMIN_OVERVIEW.workspaces,
    byPlan: [
      { key: "free", count: 8 },
      { key: "trial", count: 0 },
      { key: "indie", count: 0 },
      { key: "ultimate", count: 0 },
    ],
    byStage: [
      { key: "trialing", count: 0 },
      { key: "paying", count: 0 },
      { key: "payment-failed", count: 0 },
      { key: "comped", count: 0 },
      { key: "trial-ended", count: 0 },
      { key: "churned", count: 0 },
      { key: "no-plan", count: 0 },
      { key: "self-hosted", count: 8 },
    ],
    canceling: 0,
    payingByPlan: NOBODY_PAYING,
  },
};

export const ADMIN_OVERVIEW_NOBODY_PAYING: AdminOverview = {
  ...ADMIN_OVERVIEW,
  workspaces: { ...ADMIN_OVERVIEW.workspaces, payingByPlan: NOBODY_PAYING },
};

export const CAPACITY_REPORT: CapacityReport = {
  requestsPerDay: 1520,
  capacityPerDay: 36000,
  utilization: 0.042,
  workspaces: [
    { workspaceId: "ws_ana", requests: 900 },
    { workspaceId: "ws_default", requests: 500 },
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
  operatorWorkspace: false,
  suspendedAt: null,
  suspendedReason: null,
  trialEndsAt: null,
  planExpiresAt: null,
  subscriptionStatus: null,
  hasSubscription: false,
  cancelAtPeriodEnd: false,
  trialStartedAt: null,
  firstPaidAt: null,
  billingInterval: null,
  deletionRequestedAt: null,
  deletionRequestedBy: null,
  deletionDueAt: null,
} as const;

export const SUPPORT_WORKSPACES: SupportWorkspaceSummary[] = [
  {
    ...WORKSPACE_DEFAULTS,
    workspaceId: "ws_default",
    name: "Default",
    operatorWorkspace: true,
    plan: "free",
    storedPlan: "free",
    stage: "no-plan",
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
    stage: "paying",
    createdAt: utcTimestampDaysAgo(20),
    subscriptionStatus: "active",
    hasSubscription: true,
    planExpiresAt: utcTimestampDaysAgo(-16),
    trialStartedAt: utcTimestampDaysAgo(19),
    firstPaidAt: utcTimestampDaysAgo(12),
    billingInterval: "month",
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
    stage: "trialing",
    createdAt: utcTimestampDaysAgo(5),
    trialEndsAt: utcTimestampDaysAgo(-5),
    suspendedAt: utcTimestampDaysAgo(2),
    suspendedReason: "Sustained rate limit abuse",
    members: 1,
    apps: 0,
    competitors: 0,
    keywordMarkets: 0,
  },
  {
    ...WORKSPACE_DEFAULTS,
    workspaceId: "ws_card_trial",
    name: "Northwind Labs",
    plan: "indie",
    storedPlan: "indie",
    stage: "trialing",
    createdAt: utcTimestampDaysAgo(2),
    subscriptionStatus: "trialing",
    hasSubscription: true,
    trialStartedAt: utcTimestampDaysAgo(5),
    trialEndsAt: utcTimestampDaysAgo(-2),
    planExpiresAt: utcTimestampDaysAgo(-2),
    billingInterval: "month",
    members: 1,
    apps: 1,
    competitors: 2,
    keywordMarkets: 12,
  },
  {
    ...WORKSPACE_DEFAULTS,
    workspaceId: "ws_canceling",
    name: "Harbor Apps",
    plan: "ultimate",
    storedPlan: "ultimate",
    stage: "paying",
    createdAt: utcTimestampDaysAgo(60),
    subscriptionStatus: "active",
    hasSubscription: true,
    cancelAtPeriodEnd: true,
    trialStartedAt: utcTimestampDaysAgo(59),
    firstPaidAt: utcTimestampDaysAgo(52),
    planExpiresAt: utcTimestampDaysAgo(-17),
    billingInterval: "year",
    members: 3,
    apps: 4,
    competitors: 9,
    keywordMarkets: 160,
  },
  {
    ...WORKSPACE_DEFAULTS,
    workspaceId: "ws_churned",
    name: "Quiet Pixel",
    plan: "free",
    storedPlan: "free",
    stage: "churned",
    createdAt: utcTimestampDaysAgo(120),
    subscriptionStatus: "canceled",
    hasSubscription: true,
    trialStartedAt: utcTimestampDaysAgo(119),
    firstPaidAt: utcTimestampDaysAgo(112),
    planExpiresAt: utcTimestampDaysAgo(21),
    members: 1,
    apps: 1,
    competitors: 0,
    keywordMarkets: 8,
  },
  {
    ...WORKSPACE_DEFAULTS,
    workspaceId: "ws_failed",
    name: "Fjord Tools",
    plan: "ultimate",
    storedPlan: "ultimate",
    stage: "payment-failed",
    createdAt: utcTimestampDaysAgo(90),
    subscriptionStatus: "past_due",
    hasSubscription: true,
    trialStartedAt: utcTimestampDaysAgo(89),
    firstPaidAt: utcTimestampDaysAgo(82),
    planExpiresAt: utcTimestampDaysAgo(-4),
    billingInterval: "month",
    members: 2,
    apps: 3,
    competitors: 4,
    keywordMarkets: 60,
  },
  {
    ...WORKSPACE_DEFAULTS,
    workspaceId: "ws_leaving",
    name: "Kestrel Apps",
    plan: "free",
    storedPlan: "free",
    stage: "trial-ended",
    createdAt: utcTimestampDaysAgo(14),
    subscriptionStatus: "canceled",
    hasSubscription: true,
    trialStartedAt: utcTimestampDaysAgo(13),
    trialEndsAt: utcTimestampDaysAgo(6),
    deletionRequestedAt: utcTimestampDaysAgo(1),
    deletionRequestedBy: "kai@kestrel.example.com",
    deletionDueAt: utcTimestampDaysAgo(-6),
    members: 1,
    apps: 1,
    competitors: 1,
    keywordMarkets: 5,
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
    workspaceStage: workspace?.stage,
    ...overrides,
  };
};

export const ADMIN_USERS: AdminUser[] = [
  user({
    id: "u-nia",
    email: "nia@northwind.example.com",
    workspaceId: "ws_card_trial",
    createdAt: utcTimestampDaysAgo(2),
  }),
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
    country: "cn",
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

export const SUPPORT_OPERATOR_EMAIL = "owner@example.com";

const CURRENT_VIEW: SupportAccessEntry = {
  actorEmail: SUPPORT_OPERATOR_EMAIL,
  action: "view",
  outcome: "attempted",
  reason: null,
  detail: null,
  at: utcTimestampDaysAgo(0),
};

export const SUSPEND_REASON = "Chargeback opened on the last invoice";

export const ANA_CHECK_DAYS = [0, 1, 2, 3, 5, 6];

export const ANA_UNCHECKED_DAY = 4;

const ANA_RUN_HISTORY: SupportRunDay[] = ANA_CHECK_DAYS.map((daysAgo) => ({
  date: utcDaysAgo(daysAgo),
  captured: 40,
  unresolved: daysAgo === 2 ? 6 : 0,
}));

export const ANA_LONG_FAILURE =
  `Store answered 503 Service Unavailable for every attempt while checking the keyword ranking of com.ana.apps in the United States storefront, ${"retrying later ".repeat(4)}`.trim();

const ANA_FAILED_JOBS: SupportFailedJob[] = [
  {
    id: "4182",
    name: "check-keyword",
    queue: "appstore",
    attempts: 3,
    failedAt: utcTimestampDaysAgo(0),
    reason: ANA_LONG_FAILURE,
  },
  {
    id: "977",
    name: "refresh-app",
    queue: "gplay",
    attempts: 1,
    failedAt: null,
    reason: "Listing could not be read",
  },
];

const ANA_ACCESS: SupportAccessEntry[] = [
  CURRENT_VIEW,
  {
    actorEmail: SUPPORT_OPERATOR_EMAIL,
    action: "suspend",
    outcome: "succeeded",
    reason: SUSPEND_REASON,
    detail: "every write and on-demand action is now refused",
    at: utcTimestampDaysAgo(3),
  },
  {
    actorEmail: SUPPORT_OPERATOR_EMAIL,
    action: "restore",
    outcome: "succeeded",
    reason: "Customer paid the invoice",
    detail: "the workspace may write again",
    at: utcTimestampDaysAgo(2),
  },
  {
    actorEmail: SUPPORT_OPERATOR_EMAIL,
    action: "run-daily",
    outcome: "failed",
    reason: "Customer asked for fresh ranks",
    detail: "Redis is unreachable",
    at: utcTimestampDaysAgo(1),
  },
  {
    actorEmail: SUPPORT_OPERATOR_EMAIL,
    action: "view",
    outcome: "succeeded",
    reason: null,
    detail: null,
    at: utcTimestampDaysAgo(4),
  },
];

const QUIET_LISTS = {
  runHistory: [],
  failedJobs: [],
  recentAccess: [CURRENT_VIEW],
};

const DETAIL_LISTS: Record<
  string,
  Pick<SupportWorkspaceDetail, "runHistory" | "failedJobs" | "recentAccess">
> = {
  ws_ana: {
    runHistory: ANA_RUN_HISTORY,
    failedJobs: ANA_FAILED_JOBS,
    recentAccess: ANA_ACCESS,
  },
};

export function supportWorkspaceDetail(
  workspaceId: string,
): SupportWorkspaceDetail | undefined {
  const summary = SUPPORT_WORKSPACES.find(
    (workspace) => workspace.workspaceId === workspaceId,
  );
  if (!summary) return undefined;
  return {
    ...summary,
    limits: PLAN_LIMITS[summary.plan],
    ...(DETAIL_LISTS[workspaceId] ?? QUIET_LISTS),
  };
}
