import {
  ADMIN_BILLING_FUNNEL_STEPS,
  ADMIN_COHORT_WEEKS,
  ADMIN_DEPARTURE_REASONS,
  ADMIN_FUNNEL_STEPS,
  TRIAL_ENDING_SOON_DAYS,
  WORKSPACE_STAGES,
  type AdminCohortWeek,
  type AdminConversion,
  type AdminConversionWindow,
  type AdminDepartureTally,
  type AdminFunnelStepKey,
  type AdminMedianDays,
  type AdminTrialRate,
  type WorkspaceStage,
} from '@asobeast/shared';
import { isOperatorWorkspace } from '../auth/platform-operator';
import {
  startedTrial,
  workspaceStageOf,
  type WorkspaceStageSource,
} from '../billing/workspace-stage';
import { countsByKey } from './overview-tallies';

const DAY_MS = 24 * 60 * 60_000;
const WEEK_MS = 7 * DAY_MS;

export interface ConversionWorkspace extends WorkspaceStageSource {
  id: string;
  createdAt: Date;
}

export interface FunnelWorkspace extends ConversionWorkspace {
  confirmedEmail: boolean;
  firstAppAt: Date | null;
  rankedWithinADay: boolean;
}

export interface DepartureRow {
  stage: string;
  reason: string | null;
}

export interface ConversionInput {
  billing: boolean;
  days: AdminConversionWindow;
  now: Date;
  funnel: FunnelWorkspace[];
  workspaces: ConversionWorkspace[];
  departures: DepartureRow[];
  departuresRecordedSince: string | null;
}

interface Staged<T> {
  row: T;
  stage: WorkspaceStage;
}

const daysBetween = (from: Date, to: Date) =>
  (to.getTime() - from.getTime()) / DAY_MS;

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const value =
    sorted.length % 2 === 1
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2;
  return Math.round(value * 10) / 10;
}

export function weekStartOf(moment: Date): Date {
  const day = Date.UTC(
    moment.getUTCFullYear(),
    moment.getUTCMonth(),
    moment.getUTCDate(),
  );
  const sinceMonday = (new Date(day).getUTCDay() + 6) % 7;
  return new Date(day - sinceMonday * DAY_MS);
}

export function cohortStartOf(now: Date): Date {
  return new Date(
    weekStartOf(now).getTime() - (ADMIN_COHORT_WEEKS - 1) * WEEK_MS,
  );
}

export function windowStartOf(now: Date, days: number): Date {
  return new Date(now.getTime() - days * DAY_MS);
}

function counted<T extends ConversionWorkspace>(
  rows: T[],
  billing: boolean,
  now: Date,
): Staged<T>[] {
  return rows
    .filter((row) => !isOperatorWorkspace(row.id))
    .map((row) => ({ row, stage: workspaceStageOf(billing, row, now) }))
    .filter(({ stage }) => stage !== 'comped');
}

const STEP_TEST: Record<AdminFunnelStepKey, (row: FunnelWorkspace) => boolean> =
  {
    'signed-up': () => true,
    'confirmed-email': (row) => row.confirmedEmail,
    'first-app': (row) => row.firstAppAt !== null,
    'ranked-within-a-day': (row) => row.rankedWithinADay,
    'trial-started': startedTrial,
    paid: (row) => row.firstPaidAt !== null,
  };

function funnelOf(rows: FunnelWorkspace[], billing: boolean) {
  return ADMIN_FUNNEL_STEPS.filter(
    (step) => billing || !ADMIN_BILLING_FUNNEL_STEPS.includes(step),
  ).map((key) => ({
    key,
    count: rows.filter(STEP_TEST[key]).length,
  }));
}

function trialRate(
  rows: ConversionWorkspace[],
  from: Date,
  to: Date,
): AdminTrialRate {
  const ended = rows.filter(
    (row) =>
      row.trialEndsAt !== null &&
      row.trialEndsAt > from &&
      row.trialEndsAt <= to,
  );
  return {
    ended: ended.length,
    paid: ended.filter((row) => row.firstPaidAt !== null).length,
  };
}

function medianDaysOf(
  rows: FunnelWorkspace[],
  billing: boolean,
): AdminMedianDays {
  const signupToFirstApp = median(
    rows.flatMap((row) =>
      row.firstAppAt ? [daysBetween(row.createdAt, row.firstAppAt)] : [],
    ),
  );
  if (!billing) return { signupToFirstApp };
  return {
    signupToFirstApp,
    signupToTrial: median(
      rows.flatMap((row) =>
        row.trialStartedAt
          ? [daysBetween(row.createdAt, row.trialStartedAt)]
          : [],
      ),
    ),
    trialToPaid: median(
      rows.flatMap((row) =>
        row.trialStartedAt && row.firstPaidAt
          ? [daysBetween(row.trialStartedAt, row.firstPaidAt)]
          : [],
      ),
    ),
  };
}

function cohortOf(
  rows: Staged<FunnelWorkspace>[],
  weekStart: Date,
  billing: boolean,
): AdminCohortWeek {
  const weekEnd = weekStart.getTime() + WEEK_MS;
  const week = rows.filter(
    ({ row }) =>
      row.createdAt >= weekStart && row.createdAt.getTime() < weekEnd,
  );
  const signups = week.map(({ row }) => row);
  const base = {
    weekStart: weekStart.toISOString().slice(0, 10),
    signedUp: signups.length,
    confirmedEmail: signups.filter(STEP_TEST['confirmed-email']).length,
    firstApp: signups.filter(STEP_TEST['first-app']).length,
  };
  if (!billing) return base;
  return {
    ...base,
    trialStarted: signups.filter(STEP_TEST['trial-started']).length,
    paid: signups.filter(STEP_TEST.paid).length,
    stillPaying: week.filter(({ stage }) => stage === 'paying').length,
  };
}

function cohortsOf(
  rows: Staged<FunnelWorkspace>[],
  billing: boolean,
  now: Date,
): AdminCohortWeek[] {
  const first = cohortStartOf(now).getTime();
  return Array.from({ length: ADMIN_COHORT_WEEKS }, (_, index) =>
    cohortOf(rows, new Date(first + index * WEEK_MS), billing),
  );
}

export function departureTallyOf(rows: DepartureRow[]): AdminDepartureTally {
  return {
    total: rows.length,
    byStage: countsByKey(
      WORKSPACE_STAGES,
      rows.map((row) => ({ key: row.stage, count: 1 })),
    ),
    byReason: countsByKey(
      ADMIN_DEPARTURE_REASONS,
      rows.map((row) => ({ key: row.reason ?? 'unanswered', count: 1 })),
    ),
  };
}

function billingFiguresOf(
  workspaces: Staged<ConversionWorkspace>[],
  days: number,
  now: Date,
): Pick<AdminConversion, 'trialToPaid' | 'trials'> {
  const rows = workspaces.map(({ row }) => row);
  const start = windowStartOf(now, days);
  const trialing = workspaces.filter(({ stage }) => stage === 'trialing');
  const soon = now.getTime() + TRIAL_ENDING_SOON_DAYS * DAY_MS;
  return {
    trialToPaid: {
      current: trialRate(rows, start, now),
      previous: trialRate(rows, windowStartOf(start, days), start),
    },
    trials: {
      inProgress: trialing.length,
      endingSoon: trialing.filter(
        ({ row }) =>
          row.trialEndsAt !== null &&
          row.trialEndsAt > now &&
          row.trialEndsAt.getTime() <= soon,
      ).length,
    },
  };
}

export function conversionOf(input: ConversionInput): AdminConversion {
  const { billing, days, now } = input;
  const start = windowStartOf(now, days);
  const funnelRows = counted(input.funnel, billing, now);
  const inWindow = funnelRows
    .map(({ row }) => row)
    .filter((row) => row.createdAt >= start);
  return {
    generatedAt: now.toISOString(),
    billing,
    days,
    funnel: funnelOf(inWindow, billing),
    ...(billing
      ? billingFiguresOf(counted(input.workspaces, billing, now), days, now)
      : {}),
    medianDays: medianDaysOf(inWindow, billing),
    cohorts: cohortsOf(funnelRows, billing, now),
    departures: departureTallyOf(input.departures),
    departuresRecordedSince: input.departuresRecordedSince,
  };
}
