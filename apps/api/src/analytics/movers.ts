import { isRanked, KeywordMover, KeywordMovers } from '@asobeast/shared';
import { addDays, Ranking, rankingAt, TrackedRow } from './analytics.support';
import { baselineCheck } from './baseline';

const MOVER_WINDOW_DAYS = 7;
const MOVER_LIMIT = 5;
export const UNRANKED_RANK = Number.MAX_SAFE_INTEGER;

export interface RankedMover extends KeywordMover {
  country: string;
  change: number;
}

export interface RankedMovers {
  up: RankedMover[];
  down: RankedMover[];
}

export function rankedMovers(
  rows: TrackedRow[],
  referenceDate: Date | null,
  days = MOVER_WINDOW_DAYS,
): RankedMovers {
  if (!referenceDate) {
    return { up: [], down: [] };
  }
  const target = addDays(referenceDate, -days);
  const up: RankedMover[] = [];
  const down: RankedMover[] = [];

  for (const row of rows) {
    const toCapture = rankingAt(row.keyword.rankings, referenceDate);
    const fromCapture = baselineCheck(row.keyword.rankings, target);
    if (!toCapture || !fromCapture) {
      continue;
    }
    const to = rankedPosition(toCapture);
    const from = rankedPosition(fromCapture);
    const { depth: toDepth } = toCapture;
    const { depth: fromDepth } = fromCapture;
    const change = (from ?? UNRANKED_RANK) - (to ?? UNRANKED_RANK);
    const mover: RankedMover = {
      keywordId: row.keywordId,
      text: row.keyword.text,
      country: row.keyword.country,
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
    up: up.sort((a, b) => b.change - a.change),
    down: down.sort((a, b) => a.change - b.change),
  };
}

export function movers(
  rows: TrackedRow[],
  referenceDate: Date | null,
): KeywordMovers {
  const ranked = rankedMovers(rows, referenceDate);
  return {
    up: ranked.up.slice(0, MOVER_LIMIT).map(strip),
    down: ranked.down.slice(0, MOVER_LIMIT).map(strip),
  };
}

const rankedPosition = (capture: Ranking): number | null =>
  isRanked(capture.position) ? capture.position : null;

const strip = (mover: RankedMover): KeywordMover => ({
  keywordId: mover.keywordId,
  text: mover.text,
  from: mover.from,
  fromDepth: mover.fromDepth,
  to: mover.to,
  toDepth: mover.toDepth,
});
