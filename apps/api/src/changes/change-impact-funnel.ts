import {
  STORE_FUNNEL_COMPLETE_AFTER_DAYS,
  type ChangeImpactFunnel,
  type ChangeImpactWindowDays,
  type Store,
} from '@asobeast/shared';
import {
  between,
  countsChange,
  countsOf,
  shiftDate,
  type FunnelDayRow,
} from '../store-connect/store-funnel';

export interface ChangeFunnelInput {
  rows: FunnelDayRow[];
  changedOn: string;
  days: ChangeImpactWindowDays;
  completeThrough: string;
  firstDate: string | null;
  store: Store;
}

export const PLAY_FINAL_AFTER_DAYS = 7;

const finalAfterDays = (store: Store): number =>
  store === 'GOOGLE_PLAY'
    ? PLAY_FINAL_AFTER_DAYS
    : STORE_FUNNEL_COMPLETE_AFTER_DAYS;

const UNMEASURED: ChangeImpactFunnel = {
  status: 'unmeasured',
  completeDays: 0,
  before: null,
  after: null,
  change: null,
};

const WAITING: ChangeImpactFunnel = { ...UNMEASURED, status: 'pending' };

const daysBetween = (from: string, to: string): number =>
  Math.round(
    (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) /
      86_400_000,
  ) + 1;

export function measureChangeFunnel({
  rows,
  changedOn,
  days,
  completeThrough,
  firstDate,
  store,
}: ChangeFunnelInput): ChangeImpactFunnel {
  const beforeFrom = shiftDate(changedOn, -days);
  const beforeTo = shiftDate(changedOn, -1);
  if (firstDate === null || firstDate > beforeFrom) return UNMEASURED;
  const afterEnd = shiftDate(changedOn, days - 1);
  const finalOn = shiftDate(afterEnd, finalAfterDays(store));
  if (beforeTo > completeThrough) return { ...WAITING, finalOn };
  const reportedBefore = between(rows, beforeFrom, beforeTo);
  if (reportedBefore.length === 0) return UNMEASURED;
  const before = countsOf(reportedBefore, store);
  const afterTo = [afterEnd, completeThrough].sort()[0];
  const completeDays = Math.max(0, daysBetween(changedOn, afterTo));
  if (completeDays === 0) return { ...WAITING, before, finalOn };
  const after = countsOf(between(rows, changedOn, afterTo), store);
  const measured = completeDays === days;
  return {
    status: measured ? 'measured' : 'pending',
    completeDays,
    before,
    after,
    change: measured ? countsChange(after, before) : null,
    finalOn,
  };
}
