import {
  isOfficialPopularityState,
  OfficialPopularityListing,
  ScoreSignals,
  SERP_FLAGS,
  SerpFlag,
  SUGGEST_REACH_STATUSES,
  SuggestReachStatus,
} from '@asobeast/shared';
import { finiteNumbers, median } from './curves';
import { entryDifficulty } from './difficulty';
import { KeywordStats } from './formulas';
import { officialSignals } from './official-signals';
import { serpFlags } from './serp-flags';
import { serpRelevance } from './serp-signals';

export function buildScoreSignals(
  stats: KeywordStats,
  estimatedTraffic: number,
): ScoreSignals {
  const { suggest } = stats;
  const counts = finiteNumbers(stats.top10.map((item) => item.ratingCount));
  return {
    suggestReach: suggest.status,
    suggestPrefixLength: suggest.status === 'hit' ? suggest.prefixLength : null,
    suggestPosition:
      suggest.status === 'hit' || suggest.status === 'listed'
        ? suggest.position
        : null,
    serpRelevance: serpRelevance(stats.top10, stats.keywordText),
    medianRatingCount: counts.length === 0 ? null : median(counts),
    flags: serpFlags(stats),
    officialPopularity:
      stats.official && 'value' in stats.official ? stats.official.value : null,
    estimatedTraffic,
    entryDifficulty: entryDifficulty(stats),
    ...officialSignals(stats.official),
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isNumberOrNull = (value: unknown): value is number | null =>
  value === null || isNumber(value);

const isReachStatus = (value: unknown): value is SuggestReachStatus =>
  SUGGEST_REACH_STATUSES.some((status) => status === value);

const isFlagList = (value: unknown): value is SerpFlag[] =>
  Array.isArray(value) &&
  value.every((flag) => SERP_FLAGS.some((known) => known === flag));

const isListing = (value: unknown): value is OfficialPopularityListing =>
  isRecord(value) && isNumber(value.value) && typeof value.week === 'string';

function readOfficialSignals(
  signals: Record<string, unknown>,
): Partial<ScoreSignals> {
  const state = signals.officialPopularityState;
  const floor = signals.officialPopularityFloor;
  const week = signals.officialPopularityWeek;
  const last = signals.officialPopularityLastAboveFloor;
  return {
    ...(isOfficialPopularityState(state)
      ? { officialPopularityState: state }
      : {}),
    ...(isNumber(floor) ? { officialPopularityFloor: floor } : {}),
    ...(typeof week === 'string' ? { officialPopularityWeek: week } : {}),
    ...(isListing(last)
      ? {
          officialPopularityLastAboveFloor: {
            value: last.value,
            week: last.week,
          },
        }
      : {}),
  };
}

export function readScoreSignals(stats: unknown): ScoreSignals | null {
  const signals = isRecord(stats) ? stats.signals : undefined;
  const entryDifficulty = isRecord(signals)
    ? (signals.entryDifficulty ?? null)
    : null;
  if (
    !isRecord(signals) ||
    !isReachStatus(signals.suggestReach) ||
    !isNumberOrNull(signals.suggestPrefixLength) ||
    !isNumberOrNull(signals.suggestPosition) ||
    !isNumber(signals.serpRelevance) ||
    !isNumberOrNull(signals.medianRatingCount) ||
    !isFlagList(signals.flags) ||
    !isNumberOrNull(signals.officialPopularity) ||
    !isNumberOrNull(signals.estimatedTraffic) ||
    !isNumberOrNull(entryDifficulty)
  ) {
    return null;
  }
  return {
    suggestReach: signals.suggestReach,
    suggestPrefixLength: signals.suggestPrefixLength,
    suggestPosition: signals.suggestPosition,
    serpRelevance: signals.serpRelevance,
    medianRatingCount: signals.medianRatingCount,
    flags: signals.flags,
    officialPopularity: signals.officialPopularity,
    estimatedTraffic: signals.estimatedTraffic,
    entryDifficulty,
    ...readOfficialSignals(signals),
  };
}
