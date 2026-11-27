import { formatNumber } from "@/lib/format";
import { utcDayNumber } from "@/lib/utc-day";
import type { CardBox } from "./card-layout";
import type { ShareLinePoint } from "./headline";

export type CardChartKind = "rank" | "visibility";

export interface CardPoint {
  x: number;
  y: number;
}

export interface CardTick {
  label: string;
  y: number;
}

export interface CardChartShape {
  runs: CardPoint[][];
  dots: CardPoint[];
  ticks: CardTick[];
  end: CardPoint | null;
}

const RANK_TICKS = [1, 10, 25, 50, 100];
const NICE_STEPS = [1, 2, 5, 10];

function niceCeiling(value: number): number {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = NICE_STEPS.find((candidate) => candidate * power >= value);
  return (step ?? 10) * power;
}

type Scale = (value: number | null) => number;

function rankBottom(line: readonly ShareLinePoint[], depth: number): number {
  const worst = Math.max(...line.map(({ value }) => value ?? depth));
  const bound = RANK_TICKS.find((tick) => tick > 1 && tick >= worst);
  return bound === undefined ? depth : Math.min(bound, depth);
}

function rankScale(box: CardBox, bottom: number): Scale {
  const span = Math.max(bottom - 1, 1);
  return (value) => {
    const position = Math.min(Math.max(value ?? bottom, 1), bottom);
    return Math.round(box.y + Math.sqrt((position - 1) / span) * box.height);
  };
}

function linearScale(box: CardBox, top: number): Scale {
  return (value) =>
    Math.round(box.y + box.height - ((value ?? 0) / top) * box.height);
}

function scaleFor(
  line: readonly ShareLinePoint[],
  kind: CardChartKind,
  box: CardBox,
  depth: number,
): { scale: Scale; ticks: number[]; label: (tick: number) => string } {
  if (kind === "rank") {
    const bottom = rankBottom(line, depth);
    return {
      scale: rankScale(box, bottom),
      ticks: [...RANK_TICKS.filter((tick) => tick < bottom), bottom],
      label: String,
    };
  }
  const top = niceCeiling(Math.max(...line.map(({ value }) => value ?? 0)));
  return {
    scale: linearScale(box, top),
    ticks: [0, top / 2, top],
    label: formatNumber,
  };
}

function splitRuns(points: readonly (CardPoint & { day: number })[]) {
  const runs: CardPoint[][] = [];
  let previous: number | null = null;
  for (const { day, x, y } of points) {
    if (previous === null || day - previous > 1) runs.push([]);
    runs[runs.length - 1].push({ x, y });
    previous = day;
  }
  return runs;
}

export function cardChartShape(
  line: readonly ShareLinePoint[],
  kind: CardChartKind,
  box: CardBox,
  depth: number,
): CardChartShape {
  const { scale, ticks, label } = scaleFor(line, kind, box, depth);
  const first = utcDayNumber(line[0]?.date ?? "");
  const span = Math.max(utcDayNumber(line.at(-1)?.date ?? "") - first, 1);
  const runs = splitRuns(
    line.map(({ date, value }) => {
      const day = utcDayNumber(date);
      return {
        day,
        x: Math.round(box.x + ((day - first) / span) * box.width),
        y: scale(value),
      };
    }),
  );
  return {
    runs: runs.filter((run) => run.length > 1),
    dots: runs.filter((run) => run.length === 1).map(([dot]) => dot),
    ticks: ticks.map((tick) => ({ label: label(tick), y: scale(tick) })),
    end: runs.at(-1)?.at(-1) ?? null,
  };
}
