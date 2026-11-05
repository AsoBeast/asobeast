import { Store } from '@prisma/client';
import {
  addUtcDays,
  DISCOVERY_CHECKS_PER_RUN,
  DISCOVERY_RECHECK_DAYS,
  RANK_DEPTH,
} from '@asobeast/shared';

export interface ScheduledRow {
  keywordId: string;
  text: string;
  country: string;
  relevance: number;
  position: number | null;
  depth: number | null;
  checkedOn: string | null;
  dismissed: boolean;
}

export function weekStartOf(now: Date): Date {
  const daysSinceMonday = (now.getUTCDay() + 6) % 7;
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - daysSinceMonday,
    ),
  );
}

const missesDeepSearch = (row: ScheduledRow): boolean =>
  row.position === null && row.depth !== null && row.depth < RANK_DEPTH;

export function isDue(row: ScheduledRow, today: string): boolean {
  if (row.dismissed) return false;
  if (row.checkedOn === null || missesDeepSearch(row)) return true;
  return row.checkedOn <= addUtcDays(today, -DISCOVERY_RECHECK_DAYS);
}

const NEVER_CHECKED = '';

const byCheckOrder = (left: ScheduledRow, right: ScheduledRow): number =>
  (left.checkedOn ?? NEVER_CHECKED).localeCompare(
    right.checkedOn ?? NEVER_CHECKED,
  ) ||
  right.relevance - left.relevance ||
  left.text.localeCompare(right.text);

export function selectChecks<T extends ScheduledRow>(
  rows: readonly T[],
  remaining: number,
  today: string,
): T[] {
  if (remaining <= 0) return [];
  return rows
    .filter((row) => isDue(row, today))
    .sort(byCheckOrder)
    .slice(0, remaining);
}

export const remainingChecks = (store: Store, used: number): number =>
  Math.max(0, DISCOVERY_CHECKS_PER_RUN[store] - used);
