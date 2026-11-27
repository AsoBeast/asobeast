import {
  formatDate,
  formatDayMonth,
  formatMeasure,
  formatNumber,
} from "@/lib/format";
import type { Point } from "@/lib/monotone-curve";
import { utcDayNumber } from "@/lib/utc-day";
import type { CardBox } from "./card-layout";
import type { ShareLinePoint } from "./headline";

export type CardChartKind = "rank" | "visibility";

export type CardDomain = readonly [number, number];

export interface CardTick {
  label: string;
  y: number;
}

export interface CardMark {
  x: number;
  y: number;
  label: string;
}

export interface CardChartShape {
  traces: Point[][][];
  ticks: CardTick[];
  start: CardMark | null;
  startLabelled: boolean;
  end: CardMark | null;
}

const MIN_SPAN: Record<CardChartKind, number> = { rank: 3, visibility: 8 };
const BOUNDS: Record<CardChartKind, CardDomain> = {
  rank: [0.4, Infinity],
  visibility: [0, 100],
};
const PADDING_SHARE = 0.15;
const MAX_TICKS = 3;
const NICE_STEPS = [1, 2, 5];

export function fittedDomain(
  values: readonly number[],
  kind: CardChartKind,
): CardDomain {
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = Math.max(high - low, MIN_SPAN[kind]);
  const reach = span / 2 + span * PADDING_SHARE;
  const [floor, ceiling] = BOUNDS[kind];
  const start = Math.max(
    floor,
    Math.min((low + high) / 2 - reach, ceiling - 2 * reach),
  );
  return [start, Math.min(ceiling, start + 2 * reach)];
}

function multiplesWithin([low, high]: CardDomain, step: number): number[] {
  const first = Math.ceil(low / step);
  const last = Math.floor(high / step);
  return Array.from(
    { length: Math.max(last - first + 1, 0) },
    (_, index) => (first + index) * step,
  );
}

export function roundTicks(domain: CardDomain): number[] {
  for (let power = 1; ; power *= 10) {
    for (const step of NICE_STEPS) {
      const ticks = multiplesWithin(domain, step * power);
      if (ticks.length <= MAX_TICKS) return ticks;
    }
  }
}

export function valueLabel(value: number, kind: CardChartKind): string {
  return kind === "rank"
    ? `#${formatMeasure(value)}`
    : formatNumber(Math.round(value));
}

export function axisLabels(from: string, to: string): [string, string] {
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return [sameYear ? formatDayMonth(from) : formatDate(from), formatDate(to)];
}

function scaleOf(
  [low, high]: CardDomain,
  kind: CardChartKind,
  plot: CardBox,
): (value: number) => number {
  const share = (value: number) => (value - low) / (high - low);
  return kind === "rank"
    ? (value) => plot.y + share(value) * plot.height
    : (value) => plot.y + plot.height - share(value) * plot.height;
}

function tracesOf(
  line: readonly ShareLinePoint[],
  place: (day: number, value: number) => Point,
): Point[][][] {
  const traces: Point[][][] = [];
  let previous: number | null = null;
  for (const { date, value } of line) {
    const day = utcDayNumber(date);
    const trace = traces.at(-1);
    if (value === null) {
      previous = null;
      continue;
    }
    if (previous === null || trace === undefined) {
      traces.push([[place(day, value)]]);
    } else if (day - previous > 1) {
      trace.push([place(day, value)]);
    } else {
      trace[trace.length - 1].push(place(day, value));
    }
    previous = day;
  }
  return traces;
}

const EMPTY_SHAPE: CardChartShape = {
  traces: [],
  ticks: [],
  start: null,
  startLabelled: false,
  end: null,
};

export function cardChartShape(
  line: readonly ShareLinePoint[],
  kind: CardChartKind,
  plot: CardBox,
  clearance: number,
): CardChartShape {
  const values = line.flatMap(({ value }) => (value === null ? [] : [value]));
  const first = line[0];
  const last = line.at(-1);
  if (values.length === 0 || first === undefined || last === undefined) {
    return EMPTY_SHAPE;
  }
  const domain = fittedDomain(values, kind);
  const y = scaleOf(domain, kind, plot);
  const firstDay = utcDayNumber(first.date);
  const days = Math.max(utcDayNumber(last.date) - firstDay, 1);
  const x = (day: number) => plot.x + ((day - firstDay) / days) * plot.width;
  const markOf = ({ date, value }: ShareLinePoint): CardMark | null =>
    value === null
      ? null
      : {
          x: x(utcDayNumber(date)),
          y: y(value),
          label: valueLabel(value, kind),
        };
  const ticks = roundTicks(domain).map((tick) => ({
    label: valueLabel(tick, kind),
    y: y(tick),
  }));
  const start = markOf(first);
  return {
    traces: tracesOf(line, (day, value) => [x(day), y(value)]),
    ticks,
    start,
    startLabelled:
      start !== null &&
      ticks.every((tick) => Math.abs(tick.y - start.y) >= clearance),
    end: markOf(last),
  };
}
