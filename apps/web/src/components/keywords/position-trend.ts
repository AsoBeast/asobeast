import {
  KEYWORD_RECENT_POSITION_DAYS,
  type KeywordRecentPosition,
} from "@asobeast/shared";

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

function rankedChecks(checks: readonly KeywordRecentPosition[]): Ranked[][] {
  const newest = Date.parse(checks[checks.length - 1].date);
  const start = newest - (KEYWORD_RECENT_POSITION_DAYS - 1) * DAY_MS;
  const runs: Ranked[][] = [[]];
  for (const check of checks) {
    if (check.position === null) {
      runs.push([]);
      continue;
    }
    runs[runs.length - 1].push({
      day: Math.round((Date.parse(check.date) - start) / DAY_MS),
      position: check.position,
    });
  }
  return runs.filter((run) => run.length > 0);
}

export function positionTrendShape(
  checks: readonly KeywordRecentPosition[] | undefined,
): PositionTrendShape | null {
  if (!checks || checks.length === 0) return null;
  const runs = rankedChecks(checks);
  const ranked = runs.flat();
  if (ranked.length < 2) return null;

  const roots = ranked.map((point) => Math.sqrt(point.position));
  const best = Math.min(...roots);
  const span = Math.max(...roots) - best;
  const x = (day: number) =>
    round(
      INSET +
        (day / (KEYWORD_RECENT_POSITION_DAYS - 1)) * (TREND_WIDTH - 2 * INSET),
    );
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
          .join(""),
      )
      .join(""),
    end: { x: x(last.day), y: y(last.position) },
    first: ranked[0].position,
    last: last.position,
  };
}
