import type { KeywordRecentPosition } from "@asobeast/shared";
import { DEFAULT_TREND_WINDOW, TREND_WINDOW_DAYS } from "@/lib/trend-window";

export const TREND_WIDTH = 72;
export const TREND_HEIGHT = 22;

const INSET = 3;
const DAY_MS = 86_400_000;

export interface PositionTrendShape {
  path: string;
  end: { x: number; y: number };
  first: number;
  last: number;
}

interface Ranked {
  day: number;
  position: number;
}

const round = (value: number): number => Math.round(value * 10) / 10;

function rankedChecks(
  checks: readonly KeywordRecentPosition[],
  days: number,
): Ranked[][] {
  const newest = Date.parse(checks[checks.length - 1].date);
  const start = newest - (days - 1) * DAY_MS;
  const runs: Ranked[][] = [[]];
  for (const check of checks) {
    const day = Math.round((Date.parse(check.date) - start) / DAY_MS);
    if (day < 0) continue;
    const run = runs[runs.length - 1];
    const previous = run[run.length - 1];
    if (check.position === null || (previous && day - previous.day > 1)) {
      runs.push([]);
    }
    if (check.position !== null) {
      runs[runs.length - 1].push({ day, position: check.position });
    }
  }
  return runs.filter((run) => run.length > 0);
}

export function positionTrendShape(
  checks: readonly KeywordRecentPosition[] | undefined,
  days: number = TREND_WINDOW_DAYS[DEFAULT_TREND_WINDOW],
): PositionTrendShape | null {
  if (!checks || checks.length === 0) return null;
  const runs = rankedChecks(checks, days);
  const ranked = runs.flat();
  if (ranked.length < 2) return null;

  const roots = ranked.map((point) => Math.sqrt(point.position));
  const best = Math.min(...roots);
  const span = Math.max(...roots) - best;
  const x = (day: number) =>
    round(INSET + (day / (days - 1)) * (TREND_WIDTH - 2 * INSET));
  const y = (position: number) =>
    round(
      span === 0
        ? TREND_HEIGHT / 2
        : INSET +
            ((Math.sqrt(position) - best) / span) * (TREND_HEIGHT - 2 * INSET),
    );

  const last = ranked[ranked.length - 1];
  return {
    path: runs
      .map((run) =>
        run
          .map(
            (point, index) =>
              `${index === 0 ? "M" : "L"}${x(point.day)} ${y(point.position)}`,
          )
          .join("")
          .concat(run.length === 1 ? "h0" : ""),
      )
      .join(""),
    end: { x: x(last.day), y: y(last.position) },
    first: ranked[0].position,
    last: last.position,
  };
}
