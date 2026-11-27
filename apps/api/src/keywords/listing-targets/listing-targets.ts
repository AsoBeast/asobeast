import {
  isFloorAnswer,
  LISTING_TARGET_LIMIT,
  ListingTargetCandidate,
  ListingTargetItem,
  ListingTargetsResult,
  PlacementSuggestion,
  TargetScores,
  targetSlotRole,
  toDifficulty100,
  TrackedKeywordItem,
} from '@asobeast/shared';
import { fitsOwnListing } from '../keyword-class';
import { pairKey } from '../keyword-import';
import { byStrength } from './placement';

export const TARGET_CANDIDATE_LIMIT = 50;

type TrackedIndex = ReadonlyMap<string, TrackedKeywordItem>;

export interface StoredTargets {
  slots: readonly string[];
  updatedAt: Date;
}

export interface TargetsInput {
  appId: string;
  localization: string;
  readers: readonly string[];
  stored: StoredTargets | null;
  tracked: readonly TrackedKeywordItem[];
}

export const targetSlots = (
  stored: readonly string[] | null,
): (string | null)[] =>
  Array.from(
    { length: LISTING_TARGET_LIMIT },
    (_, index) => stored?.[index] || null,
  );

export function targetScores(item: TrackedKeywordItem): TargetScores {
  return {
    country: item.country,
    keywordId: item.keywordId,
    popularity: item.volume,
    difficulty:
      item.difficulty === null ? null : toDifficulty100(item.difficulty),
    opportunity: item.opportunity,
    relevance: item.relevance,
    position: item.latestPosition,
    depth: item.latestDepth,
    checkedOn: item.latestCheckedOn ?? null,
    keywordClass: item.keywordClass,
    scoreOutdated: item.scoreOutdated,
    floorAnswer: isFloorAnswer(item.scoreSignals?.officialPopularityState),
  };
}

const indexTracked = (tracked: readonly TrackedKeywordItem[]): TrackedIndex =>
  new Map(tracked.map((item) => [pairKey(item.country, item.text), item]));

const readerRows = (
  text: string,
  readers: readonly string[],
  tracked: TrackedIndex,
): TrackedKeywordItem[] =>
  readers.flatMap((country) => {
    const item = tracked.get(pairKey(country, text));
    return item ? [item] : [];
  });

const leadOf = (
  rows: readonly TrackedKeywordItem[],
): TrackedKeywordItem | undefined => rows.find((row) => row.active) ?? rows[0];

export function targetItem(
  text: string,
  index: number,
  readers: readonly string[],
  tracked: TrackedIndex,
): ListingTargetItem {
  const rows = readerRows(text, readers, tracked);
  const lead = leadOf(rows);
  return {
    position: index + 1,
    role: targetSlotRole(index),
    text,
    trackedIn: rows.map(({ country, keywordId, active }) => ({
      country,
      keywordId,
      active,
    })),
    untrackedIn: readers.filter(
      (country) => !tracked.has(pairKey(country, text)),
    ),
    lead: lead ? targetScores(lead) : null,
  };
}

export function targetCandidates(
  readers: readonly string[],
  tracked: readonly TrackedKeywordItem[],
  taken: ReadonlySet<string>,
): ListingTargetCandidate[] {
  const order = new Map(readers.map((country, index) => [country, index]));
  const groups = new Map<string, TrackedKeywordItem[]>();
  const brands = new Set<string>();
  for (const item of tracked) {
    if (!order.has(item.country) || taken.has(item.text)) continue;
    if (!fitsOwnListing(item.keywordClass)) brands.add(item.text);
    if (!item.active) continue;
    groups.set(item.text, [...(groups.get(item.text) ?? []), item]);
  }
  return [...groups.entries()]
    .filter(([text]) => !brands.has(text))
    .map(([text, rows]) => {
      const sorted = [...rows].sort(
        (left, right) =>
          (order.get(left.country) ?? 0) - (order.get(right.country) ?? 0),
      );
      return {
        text,
        markets: sorted.map(({ country }) => country),
        lead: targetScores(sorted[0]),
      };
    })
    .sort(byStrength)
    .slice(0, TARGET_CANDIDATE_LIMIT);
}

export function listingTargetsOf({
  appId,
  localization,
  readers,
  stored,
  tracked,
}: TargetsInput): ListingTargetsResult {
  const index = indexTracked(tracked);
  const slots = targetSlots(stored?.slots ?? null);
  return {
    appId,
    localization,
    readers: [...readers],
    slots: slots.map((text, position) =>
      text === null ? null : targetItem(text, position, readers, index),
    ),
    candidates: targetCandidates(
      readers,
      tracked,
      new Set(slots.filter((text) => text !== null)),
    ),
    updatedAt: stored?.updatedAt.toISOString() ?? null,
  };
}

const withPlacement = <T extends { text: string }>(
  item: T,
  verdicts: ReadonlyMap<string, PlacementSuggestion>,
): T => {
  const placement = verdicts.get(item.text);
  return placement ? { ...item, placement } : item;
};

export const withPlacements = (
  result: ListingTargetsResult,
  verdicts: ReadonlyMap<string, PlacementSuggestion>,
): ListingTargetsResult => ({
  ...result,
  slots: result.slots.map((slot) => slot && withPlacement(slot, verdicts)),
  candidates: result.candidates.map((candidate) =>
    withPlacement(candidate, verdicts),
  ),
});
