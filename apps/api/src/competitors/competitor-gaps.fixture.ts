import { KeywordComparisonRow, TrackedKeywordItem } from '@asobeast/shared';
import { trackedKeyword } from '../actions/rules/rule-context.fixture';
import { GapRow } from './competitor-gap-lists';

export const PRIMARY = 'app-you';
export const RIVAL = 'app-rival';
export const OTHER = 'app-other';

export interface GapRowInput {
  keywordId?: string;
  text?: string;
  country?: string;
  you?: number | null;
  positions?: Record<string, number | null>;
  unchecked?: string[];
  difficulty?: number | null;
  volume?: number | null;
  opportunity?: number | null;
  latestCheckedOn?: string | null;
  tracked?: boolean;
}

export function gapEntry(input: GapRowInput = {}): GapRow {
  const keywordId = input.keywordId ?? `kw-${input.text ?? 'habit tracker'}`;
  const text = input.text ?? 'habit tracker';
  const country = input.country ?? 'us';
  const row: KeywordComparisonRow = {
    keywordId,
    text,
    country,
    traffic: 5,
    difficulty: input.difficulty ?? null,
    you: input.you ?? null,
    positions: input.positions ?? {},
    gap: false,
    ...(input.unchecked ? { unchecked: input.unchecked } : {}),
  };
  const item =
    input.tracked === false
      ? undefined
      : trackedKeyword({
          keywordId,
          text,
          country,
          volume: input.volume ?? null,
          opportunity: input.opportunity ?? null,
          latestCheckedOn: input.latestCheckedOn,
        });
  return { row, item };
}

export const trackedById = (
  entries: readonly GapRow[],
): Map<string, TrackedKeywordItem> =>
  new Map(
    entries.flatMap(({ item }) => (item ? [[item.keywordId, item]] : [])),
  );
