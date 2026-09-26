import {
  CHANGE_FIELDS,
  CHANGE_IMPACT_WINDOWS,
  ChangeField,
  ChangeImpactItem,
  ChangeImpactMovement,
  ChangeImpactStatus,
  ChangeImpactWindow,
  ChangeImpactWindowDays,
} from '@asobeast/shared';
import {
  addDays,
  Metric,
  metricAt,
  Ranking,
  rankingAt,
  startOfUtcDay,
  toDateKey,
} from '../analytics/analytics.support';
import { visibility } from '../analytics/visibility';

export const IMPACT_BASELINE_MAX_AGE_DAYS = 3;
export const IMPACT_WINDOW_TOLERANCE_DAYS = 2;
export const CHANGE_IMPACT_MAX_CHANGES = 12;

export interface ImpactEvent {
  field: ChangeField;
  capturedAt: Date;
}

export interface ChangeDay {
  day: Date;
  fields: ChangeField[];
}

export interface ImpactKeyword {
  metrics: Metric[];
  rankings: Ranking[];
}

export interface ImpactReadPlan {
  rankingDates: Date[];
  metricsUntil: Date | null;
}

export interface ChangeImpactInput {
  changes: ChangeDay[];
  keywords: ImpactKeyword[];
  today: Date;
}

export interface ChangeImpactMeasurement {
  totalChanges: number;
  items: ChangeImpactItem[];
}

interface Pair {
  before: number | null;
  after: number | null;
  traffic: number | null;
}

type Shift = Exclude<keyof ChangeImpactMovement, 'measured'>;

interface ItemContext {
  change: ChangeDay;
  later: Date[];
  keywords: ImpactKeyword[];
  captures: number[];
  today: Date;
}

interface WindowContext extends ItemContext {
  baseline: Date | null;
}

const roundToTenth = (value: number): number => Math.round(value * 10) / 10;

const measuredChanges = (changes: ChangeDay[]): ChangeDay[] =>
  changes.slice(0, CHANGE_IMPACT_MAX_CHANGES);

const daysBack = (from: Date, count: number): Date[] =>
  Array.from({ length: count }, (_, index) => addDays(from, -index));

const isAfter = (date: Date, limit: Date): boolean =>
  date.getTime() > limit.getTime();

export function changeDays(events: ImpactEvent[]): ChangeDay[] {
  const byDay = new Map<number, Set<ChangeField>>();
  for (const event of events) {
    const day = startOfUtcDay(event.capturedAt).getTime();
    const fields = byDay.get(day) ?? new Set<ChangeField>();
    fields.add(event.field);
    byDay.set(day, fields);
  }
  return [...byDay.entries()]
    .sort(([left], [right]) => right - left)
    .map(([time, fields]) => ({
      day: new Date(time),
      fields: CHANGE_FIELDS.filter((field) => fields.has(field)),
    }));
}

export function impactReadPlan(
  changes: ChangeDay[],
  today: Date,
): ImpactReadPlan {
  const measured = measuredChanges(changes);
  const dates = new Map<number, Date>();
  for (const { day } of measured) {
    const targets = CHANGE_IMPACT_WINDOWS.map((days) =>
      addDays(day, days),
    ).filter((target) => !isAfter(target, today));
    const candidates = [
      ...daysBack(addDays(day, -1), IMPACT_BASELINE_MAX_AGE_DAYS),
      ...targets.flatMap((target) =>
        daysBack(target, IMPACT_WINDOW_TOLERANCE_DAYS + 1),
      ),
    ];
    for (const date of candidates) {
      dates.set(date.getTime(), date);
    }
  }
  return {
    rankingDates: [...dates.values()].sort(
      (left, right) => left.getTime() - right.getTime(),
    ),
    metricsUntil: measured.length === 0 ? null : addDays(measured[0].day, -1),
  };
}

const captureDates = (keywords: ImpactKeyword[]): number[] =>
  [
    ...new Set(
      keywords.flatMap((keyword) =>
        keyword.rankings.map((ranking) => ranking.date.getTime()),
      ),
    ),
  ].sort((left, right) => left - right);

const latestCapture = (
  captures: number[],
  from: Date,
  to: Date,
): Date | null => {
  const found = captures
    .filter((time) => time >= from.getTime() && time <= to.getTime())
    .at(-1);
  return found === undefined ? null : new Date(found);
};

const pairsOn = (
  keywords: ImpactKeyword[],
  baseline: Date,
  measuredOn: Date,
): Pair[] =>
  keywords.flatMap((keyword) => {
    const before = rankingAt(keyword.rankings, baseline);
    const after = rankingAt(keyword.rankings, measuredOn);
    if (!before || !after) {
      return [];
    }
    return [
      {
        before: before.position,
        after: after.position,
        traffic: metricAt(keyword.metrics, baseline)?.traffic ?? null,
      },
    ];
  });

const shiftOf = (pair: Pair): Shift | null => {
  if (pair.before === null) {
    return pair.after === null ? null : 'entered';
  }
  if (pair.after === null) {
    return 'exited';
  }
  if (pair.after === pair.before) {
    return 'unchanged';
  }
  return pair.after < pair.before ? 'improved' : 'declined';
};

const movementOf = (pairs: Pair[]): ChangeImpactMovement => {
  const movement: ChangeImpactMovement = {
    improved: 0,
    declined: 0,
    unchanged: 0,
    entered: 0,
    exited: 0,
    measured: pairs.length,
  };
  for (const pair of pairs) {
    const shift = shiftOf(pair);
    if (shift) {
      movement[shift] += 1;
    }
  }
  return movement;
};

const median = (values: number[]): number | null => {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return roundToTenth(
    sorted.length % 2 === 0
      ? (sorted[middle - 1] + sorted[middle]) / 2
      : sorted[middle],
  );
};

const rankedMoves = (pairs: Pair[]): number[] =>
  pairs.flatMap((pair) =>
    pair.before === null || pair.after === null
      ? []
      : [pair.after - pair.before],
  );

const visibilityOf = (pairs: Pair[], side: 'before' | 'after'): number =>
  visibility(
    pairs.map((pair) => ({ traffic: pair.traffic, position: pair[side] })),
  );

const statusOf = (
  context: WindowContext,
  target: Date,
  measured: number,
): ChangeImpactStatus => {
  if (context.baseline === null) {
    return 'unmeasured';
  }
  if (isAfter(target, context.today)) {
    return 'pending';
  }
  return measured > 0 ? 'measured' : 'unmeasured';
};

const measurementOf = (
  context: WindowContext,
  target: Date,
): { measuredOn: Date | null; pairs: Pair[] } => {
  if (context.baseline === null || isAfter(target, context.today)) {
    return { measuredOn: null, pairs: [] };
  }
  const capture = latestCapture(
    context.captures,
    addDays(target, -IMPACT_WINDOW_TOLERANCE_DAYS),
    target,
  );
  const pairs = capture
    ? pairsOn(context.keywords, context.baseline, capture)
    : [];
  return { measuredOn: pairs.length > 0 ? capture : null, pairs };
};

function windowFor(
  context: WindowContext,
  days: ChangeImpactWindowDays,
): ChangeImpactWindow {
  const target = addDays(context.change.day, days);
  const { measuredOn, pairs } = measurementOf(context, target);
  const until = measuredOn ?? target;
  const base = {
    days,
    status: statusOf(context, target, pairs.length),
    targetDate: toDateKey(target),
    measuredOn: measuredOn ? toDateKey(measuredOn) : null,
    overlappingChanges: context.later
      .filter((day) => !isAfter(day, until))
      .map(toDateKey),
  };
  if (pairs.length === 0) {
    return {
      ...base,
      movement: null,
      medianPositionChange: null,
      visibilityBefore: null,
      visibilityAfter: null,
      visibilityChange: null,
    };
  }
  const before = visibilityOf(pairs, 'before');
  const after = visibilityOf(pairs, 'after');
  return {
    ...base,
    movement: movementOf(pairs),
    medianPositionChange: median(rankedMoves(pairs)),
    visibilityBefore: before,
    visibilityAfter: after,
    visibilityChange: roundToTenth(after - before),
  };
}

function itemFor(context: ItemContext): ChangeImpactItem {
  const { day } = context.change;
  const baseline = latestCapture(
    context.captures,
    addDays(day, -IMPACT_BASELINE_MAX_AGE_DAYS),
    addDays(day, -1),
  );
  return {
    changedOn: toDateKey(day),
    fields: context.change.fields,
    baselineDate: baseline ? toDateKey(baseline) : null,
    windows: CHANGE_IMPACT_WINDOWS.map((days) =>
      windowFor({ ...context, baseline }, days),
    ),
  };
}

export function measureChangeImpact(
  input: ChangeImpactInput,
): ChangeImpactMeasurement {
  const captures = captureDates(input.keywords);
  const measured = measuredChanges(input.changes);
  return {
    totalChanges: input.changes.length,
    items: measured.map((change, index) =>
      itemFor({
        change,
        later: measured
          .slice(0, index)
          .map((newer) => newer.day)
          .reverse(),
        keywords: input.keywords,
        captures,
        today: input.today,
      }),
    ),
  };
}
