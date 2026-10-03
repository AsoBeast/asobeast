import type { AdminOverview, AdminSignupDay } from "@asobeast/shared";
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
