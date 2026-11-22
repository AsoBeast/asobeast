import {
  CHANGE_FIELDS,
  ChangeField,
  PortfolioAppHistory,
  PortfolioHistory,
  PortfolioHistoryDays,
  PortfolioHistoryPoint,
  PortfolioListingChange,
  PortfolioMovement,
  PortfolioPartChange,
  PortfolioRangeChange,
  PortfolioStoreHistory,
  Store,
  STORES,
  visibility,
  VisibilityKeyword,
} from '@asobeast/shared';
import {
  addDays,
  DAY_MS,
  KeywordWindow,
  rankingAt,
  toDateKey,
  TrackedRow,
} from './analytics.support';
import { isImpactField } from '../changes/change-impact';
import { hasBaseline, keywordsAtBaseline, keywordsNow } from './baseline';
import { mergePortfolioMovers, rankInsight } from './portfolio-insights';
import {
  bucketPositions,
  rankDistributionNow,
  RankDistributionBands,
} from './rank-distribution';

const TOP_TEN = 10;
const RANGE_MOVER_LIMIT = 8;
const LAST_RUN_DAYS = 1;

export interface HistoryMember extends KeywordWindow {
  appId: string;
  store: Store;
}

export interface ListingChangeStamp {
  appId: string;
  field: string;
  capturedAt: Date;
}

interface DayFigures {
  point: PortfolioHistoryPoint;
  bands: RankDistributionBands;
}

interface CheckedRow {
  positions: Map<number, number | null>;
  traffic: Map<number, number | null>;
}

interface CheckedMember {
  appId: string;
  store: Store;
  rows: TrackedRow[];
  reference: Date;
  lag: number;
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
  newest: Date,
  days: number[],
): Map<number, number | null> {
  const { metrics } = row.keyword;
  const traffic = new Map<number, number | null>();
  let index = 0;
  for (const day of [...days].reverse()) {
    const date = addDays(newest, day).getTime();
    while (index < metrics.length && metrics[index].date.getTime() > date) {
      index += 1;
    }
    traffic.set(day, metrics[index]?.traffic ?? null);
  }
  return traffic;
}

function checked(
  member: HistoryMember,
  reference: Date,
  newest: Date,
): CheckedMember {
  const positions = member.rows.map(
    (row) =>
      new Map(
        row.keyword.rankings.map((ranking) => [
          offsetOf(ranking.date, newest),
          ranking.position,
        ]),
      ),
  );
  const days = [...new Set(positions.flatMap((each) => [...each.keys()]))].sort(
    (a, b) => a - b,
  );
  return {
    appId: member.appId,
    store: member.store,
    rows: member.rows,
    reference,
    lag: offsetOf(reference, newest),
    days,
    before: new Map(days.slice(1).map((day, index) => [day, days[index]])),
    checks: member.rows.map((row, index) => ({
      positions: positions[index],
      traffic: trafficByDay(row, newest, days),
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

function latestCheck(days: number[], day: number): number | undefined {
  for (let index = days.length - 1; index >= 0; index -= 1) {
    if (days[index] <= day) {
      return days[index];
    }
  }
  return undefined;
}

function checkDayOf(
  check: CheckedRow,
  member: CheckedMember,
  day: number,
): number {
  if (check.positions.has(day) || day !== member.days.at(-1)) {
    return day;
  }
  const before = member.before.get(day);
  return before === day - 1 ? before : day;
}

function dayFigures(
  members: CheckedMember[],
  day: number,
  newest: Date,
): DayFigures | null {
  if (!members.some((member) => member.days.includes(day))) {
    return null;
  }
  const totals = { top10: 0, climbed: 0, fell: 0 };
  const keywords: VisibilityKeyword[] = [];

  for (const member of members) {
    const latest = latestCheck(member.days, day);
    if (latest === undefined) {
      continue;
    }
    const before = latest === day ? member.before.get(day) : undefined;
    for (const check of member.checks) {
      const checkDay = checkDayOf(check, member, latest);
      const position = check.positions.get(checkDay) ?? null;
      keywords.push({ traffic: check.traffic.get(checkDay) ?? null, position });
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
    point: {
      date: toDateKey(addDays(newest, day)),
      visibility: visibility(keywords),
      ...totals,
    },
    bands: bucketPositions(keywords.map((keyword) => keyword.position)),
  };
}

function period(
  members: CheckedMember[],
  newest: Date,
  from: number,
  to: number,
): DayFigures[] {
  const figures: DayFigures[] = [];
  for (let day = from; day <= to; day += 1) {
    const figure = dayFigures(members, day, newest);
    if (figure) {
      figures.push(figure);
    }
  }
  return figures;
}

const pointsOf = (figures: DayFigures[]): PortfolioHistoryPoint[] =>
  figures.map(({ point }) => point);

const startOf = (member: CheckedMember, days: number): Date =>
  addDays(member.reference, -days);

const comparedOver = (members: CheckedMember[], days: number) =>
  members.filter(
    (member) =>
      member.lag > -days && hasBaseline(member.rows, startOf(member, days)),
  );

function comparison(compared: CheckedMember[], days: number) {
  const ranked = compared.map((member) => ({
    appId: member.appId,
    ...rankInsight(member.rows, member.reference, days),
  }));
  const now = visibility(
    compared.flatMap((member) => keywordsNow(member.rows, member.reference)),
  );
  const then = visibility(
    compared.flatMap((member) =>
      keywordsAtBaseline(member.rows, startOf(member, days)),
    ),
  );
  return {
    ranked,
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
  };
}

function rangeChange(
  members: CheckedMember[],
  days: number,
): PortfolioRangeChange {
  const compared = comparedOver(members, days);
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

  const { ranked, ...deltas } = comparison(compared, days);
  return {
    compared: true,
    ...deltas,
    appsMoved: ranked.filter(({ movement }) => movement.up + movement.down > 0)
      .length,
    movers: mergePortfolioMovers(ranked, RANGE_MOVER_LIMIT),
  };
}

function partChange(
  members: CheckedMember[],
  days: number,
): PortfolioPartChange {
  const compared = comparedOver(members, days);
  const deltas =
    compared.length === 0
      ? { visibilityDelta: null, top10Delta: null, movement: NO_MOVEMENT }
      : comparison(compared, days);
  return {
    visibility: visibility(
      members.flatMap((member) => keywordsNow(member.rows, member.reference)),
    ),
    visibilityDelta: deltas.visibilityDelta,
    top10: members.reduce(
      (total, member) =>
        total + rankDistributionNow(member.rows, member.reference).top10,
      0,
    ),
    top10Delta: deltas.top10Delta,
    movement: deltas.movement,
  };
}

const checkedOnBothDays = (member: CheckedMember): CheckedMember => {
  const dayBefore = startOf(member, LAST_RUN_DAYS);
  return {
    ...member,
    rows: member.rows.filter(
      ({ keyword }) =>
        rankingAt(keyword.rankings, member.reference) !== null &&
        rankingAt(keyword.rankings, dayBefore) !== null,
    ),
  };
};

const appHistory = (
  member: CheckedMember,
  newest: Date,
  days: PortfolioHistoryDays,
): PortfolioAppHistory => ({
  appId: member.appId,
  points: pointsOf(period([member], newest, 1 - days, 0)),
  change: partChange([member], days),
  lastRun: partChange([checkedOnBothDays(member)], LAST_RUN_DAYS).movement,
});

const storeHistories = (
  members: CheckedMember[],
  days: PortfolioHistoryDays,
): PortfolioStoreHistory[] =>
  STORES.flatMap((store) => {
    const listed = members.filter((member) => member.store === store);
    return listed.length === 0
      ? []
      : [{ store, apps: listed.length, change: partChange(listed, days) }];
  });

function listingChanges(
  stamps: readonly ListingChangeStamp[],
  members: CheckedMember[],
  newest: Date,
  days: PortfolioHistoryDays,
): PortfolioListingChange[] {
  const charted = new Set(members.map((member) => member.appId));
  const first = toDateKey(addDays(newest, 1 - days));
  const last = toDateKey(newest);
  const fieldsByDay = new Map<string, Set<ChangeField>>();
  for (const { appId, field, capturedAt } of stamps) {
    const date = toDateKey(capturedAt);
    if (
      !charted.has(appId) ||
      !isImpactField(field) ||
      date < first ||
      date > last
    ) {
      continue;
    }
    const key = `${date} ${appId}`;
    fieldsByDay.set(key, (fieldsByDay.get(key) ?? new Set()).add(field));
  }
  return [...fieldsByDay]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, fields]) => {
      const [date, appId] = key.split(' ');
      return {
        date,
        appId,
        fields: CHANGE_FIELDS.filter((field) => fields.has(field)),
      };
    });
}

export function newestReference(windows: KeywordWindow[]): Date | null {
  const references = windows.flatMap(({ referenceDate }) =>
    referenceDate ? [referenceDate.getTime()] : [],
  );
  return references.length === 0 ? null : new Date(Math.max(...references));
}

export function portfolioHistory(
  windows: HistoryMember[],
  days: PortfolioHistoryDays,
  stamps: readonly ListingChangeStamp[] = [],
): PortfolioHistory {
  const newest = newestReference(windows) ?? new Date(0);
  const members = windows.flatMap((window) =>
    window.referenceDate ? [checked(window, window.referenceDate, newest)] : [],
  );
  const change = rangeChange(members, days);
  if (members.length === 0) {
    return { days, points: [], previous: [], change };
  }
  const current = period(members, newest, 1 - days, 0);
  return {
    days,
    points: pointsOf(current),
    previous: pointsOf(period(members, newest, 1 - 2 * days, -days)),
    change,
    bands: current.map(({ point, bands }) => ({ date: point.date, ...bands })),
    apps: members.map((member) => appHistory(member, newest, days)),
    stores: storeHistories(members, days),
    lastRun: rangeChange(members.map(checkedOnBothDays), LAST_RUN_DAYS),
    listingChanges: listingChanges(stamps, members, newest, days),
  };
}
