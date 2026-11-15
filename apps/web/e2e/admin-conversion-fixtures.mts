import type {
  AdminCohortWeek,
  AdminConversion,
  AdminConversionWindow,
  AdminDeparture,
  AdminDepartureList,
} from "@asobeast/shared";
import { utcDaysAgo } from "./fixtures.mts";

const DAY_MS = 24 * 60 * 60_000;

const STAGE_KEYS = [
  "trialing",
  "paying",
  "payment-failed",
  "comped",
  "trial-ended",
  "churned",
  "no-plan",
  "self-hosted",
] as const;

const REASON_KEYS = [
  "too-expensive",
  "missing-feature",
  "not-using",
  "switched-tool",
  "other",
  "unanswered",
] as const;

function mondayWeeksAgo(weeks: number): string {
  const today = new Date(`${utcDaysAgo(0)}T00:00:00.000Z`);
  const sinceMonday = (today.getUTCDay() + 6) % 7;
  return new Date(today.getTime() - (sinceMonday + weeks * 7) * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

const COHORT_SIGNUPS = [2, 3, 1, 4, 2, 5, 3, 2];

const cohorts = (billing: boolean, empty: boolean): AdminCohortWeek[] =>
  COHORT_SIGNUPS.map((signups, index) => {
    const signedUp = empty ? 0 : signups;
    const week: AdminCohortWeek = {
      weekStart: mondayWeeksAgo(COHORT_SIGNUPS.length - 1 - index),
      signedUp,
      confirmedEmail: Math.max(0, signedUp - 1),
      firstApp: Math.floor(signedUp / 2),
    };
    if (!billing) return week;
    return {
      ...week,
      trialStarted: Math.floor(signedUp / 2),
      paid: index < 5 ? Math.floor(signedUp / 3) : 0,
      stillPaying: index < 5 ? Math.floor(signedUp / 4) : 0,
    };
  });

const counted = <K extends string>(
  keys: readonly K[],
  counts: Partial<Record<K, number>>,
) => keys.map((key) => ({ key, count: counts[key] ?? 0 }));

const WINDOW_SCALE: Record<AdminConversionWindow, number> = { 30: 1, 90: 3 };

export function adminConversion(
  days: AdminConversionWindow,
  billing: boolean,
  empty: boolean,
): AdminConversion {
  const scale = empty ? 0 : WINDOW_SCALE[days];
  const steps = [
    { key: "signed-up", count: 11 * scale },
    { key: "confirmed-email", count: 9 * scale },
    { key: "first-app", count: 6 * scale },
    { key: "ranked-within-a-day", count: 4 * scale },
  ] as const;
  const departures = empty
    ? {
        total: 0,
        byStage: counted(STAGE_KEYS, {}),
        byReason: counted(REASON_KEYS, {}),
      }
    : {
        total: 3,
        byStage: counted(STAGE_KEYS, {
          [billing ? "trial-ended" : "self-hosted"]: 2,
          [billing ? "paying" : "self-hosted"]: billing ? 1 : 3,
        }),
        byReason: counted(REASON_KEYS, {
          "too-expensive": 1,
          "not-using": 1,
          unanswered: 1,
        }),
      };
  const shared = {
    generatedAt: new Date().toISOString(),
    billing,
    days,
    cohorts: cohorts(billing, empty),
    departures,
    departuresRecordedSince: utcDaysAgo(10),
  };
  if (!billing) {
    return {
      ...shared,
      funnel: [...steps],
      medianDays: { signupToFirstApp: empty ? null : 0.5 },
    };
  }
  return {
    ...shared,
    funnel: [
      ...steps,
      { key: "trial-started", count: 7 * scale },
      { key: "paid", count: 2 * scale },
    ],
    trialToPaid: {
      current: { paid: 4 * scale, ended: 11 * scale },
      previous: { paid: 2 * scale, ended: 9 * scale },
    },
    trials: { inProgress: 2, endingSoon: 1 },
    medianDays: empty
      ? { signupToFirstApp: null, signupToTrial: null, trialToPaid: null }
      : { signupToFirstApp: 0.5, signupToTrial: 1.5, trialToPaid: 7 },
  };
}

const departure = (
  overrides: Pick<AdminDeparture, "id" | "erasedOn"> & Partial<AdminDeparture>,
): AdminDeparture => ({
  createdOn: utcDaysAgo(40),
  requestedOn: utcDaysAgo(12),
  stage: "trial-ended",
  plan: "free",
  everPaid: false,
  apps: 1,
  keywordMarkets: 6,
  members: 1,
  reason: null,
  ...overrides,
});

export const ADMIN_DEPARTURES: AdminDeparture[] = [
  departure({
    id: "4f0c6c1e-9a52-4a8f-9a3e-0d7a1c2b3e01",
    erasedOn: utcDaysAgo(2),
    requestedOn: utcDaysAgo(9),
    stage: "paying",
    plan: "ultimate",
    everPaid: true,
    apps: 4,
    keywordMarkets: 120,
    members: 3,
    reason: "too-expensive",
  }),
  departure({
    id: "4f0c6c1e-9a52-4a8f-9a3e-0d7a1c2b3e02",
    erasedOn: utcDaysAgo(5),
    reason: "not-using",
  }),
  departure({
    id: "4f0c6c1e-9a52-4a8f-9a3e-0d7a1c2b3e03",
    erasedOn: utcDaysAgo(8),
  }),
];

export const adminDepartureList = (empty: boolean): AdminDepartureList => ({
  items: empty ? [] : ADMIN_DEPARTURES,
  total: empty ? 0 : ADMIN_DEPARTURES.length,
  limit: 1000,
});
