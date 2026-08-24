import { isRanked, KeywordMover, KeywordMovers } from '@asobeast/shared';
import { addDays, DAY_MS, Ranking, TrackedRow } from './analytics.support';

const MOVER_WINDOW_DAYS = 7;
const MOVER_TOLERANCE_MS = DAY_MS;
const MOVER_LIMIT = 5;
const UNRANKED_RANK = Number.MAX_SAFE_INTEGER;

export function movers(
  rows: TrackedRow[],
  referenceDate: Date | null,
): KeywordMovers {
  if (!referenceDate) {
    return { up: [], down: [] };
  }
  const target = addDays(referenceDate, -MOVER_WINDOW_DAYS);
  const up: Array<KeywordMover & { change: number }> = [];
  const down: Array<KeywordMover & { change: number }> = [];

  for (const row of rows) {
    const toCapture = captureAt(row.keyword.rankings, referenceDate);
    const fromCapture = nearestCapture(row.keyword.rankings, target);
    if (!toCapture || !fromCapture) {
      continue;
    }
    const to = rankedPosition(toCapture);
    const from = rankedPosition(fromCapture);
    const { depth: toDepth } = toCapture;
    const { depth: fromDepth } = fromCapture;
    const change = (from ?? UNRANKED_RANK) - (to ?? UNRANKED_RANK);
    const mover: KeywordMover & { change: number } = {
      keywordId: row.keywordId,
      text: row.keyword.text,
      from,
      fromDepth,
      to,
      toDepth,
      change,
    };
    if (to !== null && change > 0) {
      up.push(mover);
    } else if (from !== null && change < 0) {
      down.push(mover);
    }
  }

  return {
    up: up
      .sort((a, b) => b.change - a.change)
      .slice(0, MOVER_LIMIT)
      .map(strip),
    down: down
      .sort((a, b) => a.change - b.change)
      .slice(0, MOVER_LIMIT)
      .map(strip),
  };
}

const rankedPosition = (capture: Ranking): number | null =>
  isRanked(capture.position) ? capture.position : null;

const captureAt = (rankings: Ranking[], date: Date): Ranking | null =>
  rankings.find((ranking) => ranking.date.getTime() === date.getTime()) ?? null;

const nearestCapture = (rankings: Ranking[], target: Date): Ranking | null => {
  let closest: Ranking | null = null;
  for (const ranking of rankings) {
    const distance = Math.abs(ranking.date.getTime() - target.getTime());
    if (distance > MOVER_TOLERANCE_MS) {
      continue;
    }
    if (
      closest === null ||
      distance < Math.abs(closest.date.getTime() - target.getTime())
    ) {
      closest = ranking;
    }
  }
  return closest;
};

const strip = (mover: KeywordMover & { change: number }): KeywordMover => ({
  keywordId: mover.keywordId,
  text: mover.text,
  from: mover.from,
  fromDepth: mover.fromDepth,
  to: mover.to,
  toDepth: mover.toDepth,
});
