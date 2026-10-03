import type {
  AdminOverview,
  AdminSignupDay,
  CapacityReport,
  ProxyOutcomeCounts,
  ProxyPoolHealth,
} from "@asobeast/shared";
import { utcDaysAgo } from "./fixtures.mts";

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
