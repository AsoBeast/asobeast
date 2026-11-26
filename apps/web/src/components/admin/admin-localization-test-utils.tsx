import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import {
  PLAN_LIMITS,
  type AdminApp,
  type AdminConversion,
  type AdminOverview,
  type AdminUser,
  type CapacityReport,
  type ProxyPoolHealth,
  type SupportWorkspaceDetail,
} from "@asobeast/shared";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  adminAppsOptions,
  adminCapacityOptions,
  adminConversionOptions,
  adminDeparturesOptions,
  adminOverviewOptions,
  adminProxyPoolOptions,
  adminUsersOptions,
  adminWorkspaceOptions,
  adminWorkspacesOptions,
  authStatusOptions,
} from "@/lib/queries";
import { TestIntlProvider } from "@/test/intl-provider";

export const OVERVIEW: AdminOverview = {
  generatedAt: "2026-11-25T10:00:00.000Z",
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
      { key: "trial-ended", count: 1 },
      { key: "churned", count: 1 },
      { key: "no-plan", count: 1 },
    ],
    canceling: 1,
    payingByPlan: [
      { plan: "indie", interval: "month", count: 1 },
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
  keywords: { trackedMarkets: 1_234, searched: 987, storefronts: 5 },
  aiCallsThisMonth: 42,
  signups: [],
  activation: {
    importedLast30Days: 12,
    rankedWithinADay: 9,
    completedSetup: 7,
  },
};

export const CONVERSION: AdminConversion = {
  generatedAt: "2026-11-25T10:00:00.000Z",
  billing: true,
  days: 30,
  funnel: [
    { key: "signed-up", count: 11 },
    { key: "confirmed-email", count: 9 },
    { key: "trial-started", count: 7 },
    { key: "first-app", count: 6 },
    { key: "ranked-within-a-day", count: 4 },
    { key: "paid", count: 2 },
  ],
  trialToPaid: {
    current: { paid: 4, ended: 11 },
    previous: { paid: 2, ended: 9 },
  },
  trials: { inProgress: 2, endingSoon: 1 },
  medianDays: { signupToFirstApp: 0.5, signupToTrial: 1.5, trialToPaid: 7 },
  cohorts: [
    {
      weekStart: "2026-11-16",
      signedUp: 2,
      confirmedEmail: 1,
      trialStarted: 1,
      firstApp: 1,
      paid: 1,
      stillPaying: 1,
    },
  ],
  departures: {
    total: 1,
    byStage: [{ key: "paying", count: 1 }],
    byReason: [{ key: "too-expensive", count: 1 }],
  },
  departuresRecordedSince: "2026-11-15",
};

export const WORKSPACE = {
  workspaceId: "ws_ana",
  name: "Ana Apps",
  operatorWorkspace: false,
  plan: "indie" as const,
  storedPlan: "indie",
  createdAt: "2026-10-30T09:00:00.000Z",
  suspendedAt: null,
  suspendedReason: null,
  trialEndsAt: null,
  planExpiresAt: "2026-12-04T00:00:00.000Z",
  subscriptionStatus: "active",
  hasSubscription: true,
  members: 2,
  apps: 2,
  competitors: 3,
  keywordMarkets: 40,
  stage: "paying" as const,
};

const SUSPENDED_WORKSPACE = {
  ...WORKSPACE,
  workspaceId: "ws_lapsed",
  name: "Lapsed Studio",
  suspendedAt: "2026-11-17T08:05:00.000Z",
  suspendedReason: "Sustained rate limit abuse",
};

const DETAIL: SupportWorkspaceDetail = {
  ...WORKSPACE,
  limits: PLAN_LIMITS.indie,
  runHistory: [{ date: "2026-11-24", captured: 40, unresolved: 6 }],
  failedJobs: [
    {
      id: "4182",
      name: "check-keyword",
      queue: "appstore",
      attempts: 3,
      failedAt: "2026-11-25T08:05:00.000Z",
      reason: "Store answered 503 Service Unavailable",
    },
  ],
  recentAccess: [
    {
      actorEmail: "owner@example.com",
      action: "view",
      outcome: "attempted",
      reason: null,
      detail: "API-provided detail",
      at: "2026-11-25T08:05:00.000Z",
    },
  ],
};

const USER: AdminUser = {
  id: "u_ana",
  email: "ana@example.com",
  name: "Ana Nowak",
  role: "owner",
  emailVerified: true,
  platformOperator: true,
  createdAt: "2026-10-30T09:00:00.000Z",
  workspaceId: "ws_ana",
  workspaceName: "Ana Apps",
  workspacePlan: "indie",
  workspaceStage: "paying",
};

const APP: AdminApp = {
  id: "app_ana",
  workspaceId: "ws_ana",
  workspaceName: "Ana Apps",
  store: "APP_STORE",
  storeAppId: "com.ana.habits",
  country: "cn",
  name: null,
  iconUrl: null,
  competitors: 2,
  keywordMarkets: 25,
  createdAt: "2026-10-30T09:00:00.000Z",
};

const CAPACITY: CapacityReport = {
  requestsPerDay: 1_520,
  capacityPerDay: 36_000,
  utilization: 0.042,
  stores: [
    {
      store: "APP_STORE",
      requestsPerDay: 1_100,
      capacityPerDay: 21_600,
      utilization: 0.051,
    },
  ],
  workspaces: [{ workspaceId: "ws_ana", requests: 900 }],
};

const POOL: ProxyPoolHealth = {
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
      outcomes: {
        SUCCESS: 970,
        TRANSPORT: 0,
        RATE_LIMITED: 0,
        BLOCKED: 30,
        SILENT: 0,
      },
      requestsLastHour: 600,
      capacityPerHour: 5_400,
    },
  ],
  endpoints: [],
  residential: {
    configured: true,
    month: "2026-11",
    requests: 40,
    spendUsd: 1.5,
    capUsd: 10,
    fallbackRate: 0.01,
  },
  alerts: ["pool.healthy.low"],
};

export function chineseMarkup(
  node: React.ReactNode,
  seed?: (client: QueryClient) => void,
): string {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(adminOverviewOptions.queryKey, OVERVIEW);
  client.setQueryData(adminConversionOptions(30).queryKey, CONVERSION);
  client.setQueryData(adminConversionOptions(90).queryKey, CONVERSION);
  client.setQueryData(adminDeparturesOptions.queryKey, {
    items: [
      {
        id: "departure-1",
        erasedOn: "2026-11-20",
        requestedOn: "2026-11-10",
        createdOn: "2026-10-01",
        stage: "paying",
        plan: "ultimate",
        everPaid: true,
        apps: 4,
        keywordMarkets: 120,
        members: 3,
        reason: "too-expensive",
      },
    ],
    total: 1,
    limit: 1_000,
  });
  client.setQueryData(adminCapacityOptions.queryKey, CAPACITY);
  client.setQueryData(adminProxyPoolOptions.queryKey, POOL);
  client.setQueryData(adminWorkspacesOptions.queryKey, [
    WORKSPACE,
    SUSPENDED_WORKSPACE,
  ]);
  client.setQueryData(adminWorkspaceOptions("ws_ana").queryKey, DETAIL);
  client.setQueryData(adminUsersOptions().queryKey, {
    items: [USER],
    total: 1,
    limit: 1_000,
  });
  client.setQueryData(adminAppsOptions().queryKey, {
    items: [APP],
    total: 1,
    limit: 1_000,
  });
  client.setQueryData(authStatusOptions.queryKey, {
    billing: true,
    registrationOpen: true,
    setupRequired: false,
    authenticated: true,
  });
  seed?.(client);
  return renderToStaticMarkup(
    <TestIntlProvider locale="zh-CN">
      <QueryClientProvider client={client}>
        <TooltipProvider>{node}</TooltipProvider>
      </QueryClientProvider>
    </TestIntlProvider>,
  );
}
