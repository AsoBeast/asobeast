import {
  PortfolioHistory,
  PortfolioHistoryDays,
  PortfolioHistoryPoint,
  PortfolioMovement,
  PortfolioRangeChange,
  visibility,
  VisibilityKeyword,
} from '@asobeast/shared';
import {
  addDays,
  DAY_MS,
  keywordsAt,
  KeywordWindow,
  toDateKey,
  TrackedRow,
} from './analytics.support';
import { mergePortfolioMovers, rankInsight } from './portfolio-insights';

const TOP_TEN = 10;
const RANGE_MOVER_LIMIT = 8;
const BASELINE_SHIFTS = [0, 1, -1];

export interface HistoryMember extends KeywordWindow {
  appId: string;
}

interface CheckedRow {
  positions: Map<number, number | null>;
  traffic: Map<number, number | null>;
}

interface CheckedMember {
  appId: string;
  rows: TrackedRow[];
  reference: Date;
  checks: CheckedRow[];
  days: number[];
  before: Map<number, number>;
}

const NO_MOVEMENT: PortfolioMovement = { up: 0, down: 0, entered: 0, lost: 0 };

const offsetOf = (date: Date, reference: Date): number =>
  Math.round((date.getTime() - reference.getTime()) / DAY_MS);

const rankOf = (position: number | null): number =>
  position ?? Number.POSITIVE_INFINITY;

function trafficByDay(
  row: TrackedRow,
  reference: Date,
  days: number[],
): Map<number, number | null> {
  const { metrics } = row.keyword;
  const traffic = new Map<number, number | null>();
  let index = 0;
  for (const day of [...days].reverse()) {
    const date = addDays(reference, day).getTime();
    while (index < metrics.length && metrics[index].date.getTime() > date) {
      index += 1;
    }
    traffic.set(day, metrics[index]?.traffic ?? null);
  }
  return traffic;
}

function checked(member: HistoryMember): CheckedMember | null {
  const reference = member.referenceDate;
  if (!reference) {
    return null;
  }
  const positions = member.rows.map(
    (row) =>
      new Map(
        row.keyword.rankings.map((ranking) => [
          offsetOf(ranking.date, reference),
          ranking.position,
        ]),
      ),
  );
  const days = [...new Set(positions.flatMap((each) => [...each.keys()]))].sort(
    (a, b) => a - b,
  );
  return {
    appId: member.appId,
    rows: member.rows,
    reference,
    days,
    before: new Map(days.slice(1).map((day, index) => [day, days[index]])),
    checks: member.rows.map((row, index) => ({
      positions: positions[index],
      traffic: trafficByDay(row, reference, days),
    })),
  };
}

function movedSince(
  { positions }: CheckedRow,
  day: number,
  before: number | undefined,
): 'climbed' | 'fell' | null {
  if (before === undefined) {
    return null;
  }
  const now = positions.get(day);
  const then = positions.get(before);
  if (now === undefined || then === undefined || now === then) {
    return null;
  }
  return rankOf(now) < rankOf(then) ? 'climbed' : 'fell';
}

function dayPoint(
  members: CheckedMember[],
  day: number,
  newest: Date,
): PortfolioHistoryPoint | null {
  const captured = members.filter((member) => member.days.includes(day));
  if (captured.length === 0) {
    return null;
  }
  const totals = { top10: 0, climbed: 0, fell: 0 };
  const keywords: VisibilityKeyword[] = [];

  for (const member of captured) {
    const before = member.before.get(day);
    for (const check of member.checks) {
      const position = check.positions.get(day) ?? null;
      keywords.push({ traffic: check.traffic.get(day) ?? null, position });
      if (position !== null && position <= TOP_TEN) {
        totals.top10 += 1;
      }
      const moved = movedSince(check, day, before);
      if (moved) {
        totals[moved] += 1;
      }
    }
  }

  return {
    date: toDateKey(addDays(newest, day)),
    visibility: visibility(keywords),
    ...totals,
  };
}

function period(
  members: CheckedMember[],
  newest: Date,
  from: number,
  to: number,
): PortfolioHistoryPoint[] {
  const points: PortfolioHistoryPoint[] = [];
  for (let day = from; day <= to; day += 1) {
    const point = dayPoint(members, day, newest);
    if (point) {
      points.push(point);
    }
  }
  return points;
}

function baselineOf(member: CheckedMember, days: number): number | null {
  return (
    BASELINE_SHIFTS.map((shift) => shift - days).find((day) =>
      member.days.includes(day),
    ) ?? null
  );
}

function rangeChange(
  members: CheckedMember[],
  days: PortfolioHistoryDays,
): PortfolioRangeChange {
  const compared = members.flatMap((member) => {
    const baseline = baselineOf(member, days);
    return baseline === null ? [] : [{ member, baseline }];
  });
  if (compared.length === 0) {
    return {
      compared: false,
      visibilityDelta: null,
      top10Delta: null,
      movement: NO_MOVEMENT,
      appsMoved: 0,
      movers: { up: [], down: [] },
    };
  }

  const ranked = compared.map(({ member, baseline }) => ({
    appId: member.appId,
    ...rankInsight(member.rows, member.reference, -baseline),
  }));
  const now = visibility(
    compared.flatMap(({ member }) => keywordsAt(member.rows, member.reference)),
  );
  const then = visibility(
    compared.flatMap(({ member, baseline }) =>
      keywordsAt(member.rows, addDays(member.reference, baseline)),
    ),
  );

  return {
    compared: true,
    visibilityDelta: Math.round((now - then) * 10) / 10,
    top10Delta: ranked.reduce((total, app) => total + (app.top10Delta ?? 0), 0),
    movement: ranked.reduce(
      (total, { movement }) => ({
        up: total.up + movement.up,
        down: total.down + movement.down,
        entered: total.entered + movement.entered,
        lost: total.lost + movement.lost,
      }),
      NO_MOVEMENT,
    ),
    appsMoved: ranked.filter(({ movement }) => movement.up + movement.down > 0)
      .length,
    movers: mergePortfolioMovers(ranked, RANGE_MOVER_LIMIT),
  };
}

export function portfolioHistory(
  windows: HistoryMember[],
  days: PortfolioHistoryDays,
): PortfolioHistory {
  const members = windows.flatMap((window) => checked(window) ?? []);
  const change = rangeChange(members, days);
  if (members.length === 0) {
    return { days, points: [], previous: [], change };
  }
  const newest = new Date(
    Math.max(...members.map((member) => member.reference.getTime())),
  );
  return {
    days,
    points: period(members, newest, 1 - days, 0),
    previous: period(members, newest, 1 - 2 * days, -days),
    change,
  };
}
