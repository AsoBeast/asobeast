import {
  ADMIN_SIGNUP_DAYS,
  PLAN_NAMES,
  WORKSPACE_STAGES,
  type AdminCount,
  type AdminOverview,
  type AdminSignupDay,
} from '@asobeast/shared';
import { planScopeOf } from '../auth/plan-limits';
import {
  cancelingOf,
  workspaceStageOf,
  type WorkspaceFlagSource,
} from '../billing/workspace-stage';

const DAY_MS = 24 * 60 * 60_000;

export interface DailyCount {
  date: string;
  count: number;
}

export interface KeyedCount {
  key: string;
  count: number;
}

export interface WorkspaceRow extends WorkspaceFlagSource {
  suspendedAt: Date | null;
  deletionDueAt: Date | null;
}

const utcDate = (moment: Date) => moment.toISOString().slice(0, 10);

export function signupWindowStart(now: Date, days = ADMIN_SIGNUP_DAYS): Date {
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  return new Date(today - (days - 1) * DAY_MS);
}

export function countsByKey<K extends string>(
  keys: readonly K[],
  rows: KeyedCount[],
): AdminCount<K>[] {
  return keys.map((key) => ({
    key,
    count: rows
      .filter((row) => row.key === key)
      .reduce((total, row) => total + row.count, 0),
  }));
}

export function signupSeries(
  users: DailyCount[],
  workspaces: DailyCount[],
  now: Date,
  days = ADMIN_SIGNUP_DAYS,
): AdminSignupDay[] {
  const start = signupWindowStart(now, days).getTime();
  const countOn = (rows: DailyCount[], date: string) =>
    rows.find((row) => row.date === date)?.count ?? 0;
  return Array.from({ length: days }, (_, index) => {
    const date = utcDate(new Date(start + index * DAY_MS));
    return {
      date,
      users: countOn(users, date),
      workspaces: countOn(workspaces, date),
    };
  });
}

export function tallyWorkspaces(
  rows: WorkspaceRow[],
  billing: boolean,
  now: Date,
): AdminOverview['workspaces'] {
  const plans = rows.map((row) => ({
    key: planScopeOf(billing, row, now).plan,
    count: 1,
  }));
  const staged = rows.map((row) => ({
    row,
    stage: workspaceStageOf(billing, row, now),
  }));
  return {
    total: rows.length,
    suspended: rows.filter((row) => row.suspendedAt !== null).length,
    pendingDeletion: rows.filter((row) => row.deletionDueAt !== null).length,
    byPlan: countsByKey(PLAN_NAMES, plans),
    byStage: countsByKey(
      WORKSPACE_STAGES,
      staged.map(({ stage }) => ({ key: stage, count: 1 })),
    ),
    canceling: staged.filter(({ row, stage }) => cancelingOf(stage, row))
      .length,
  };
}
