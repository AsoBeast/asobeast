import { Store } from '@prisma/client';
import type { KeywordBreakdownSegment, SerpEntryItem } from '@asobeast/shared';
import { placementJudge } from './serp-placement';

type ListingLine = Pick<
  SerpEntryItem,
  | 'placement'
  | 'subtitle'
  | 'subtitleSegments'
  | 'shortDescription'
  | 'shortDescriptionSegments'
>;

interface ListedRow {
  storeAppId: string;
  title: string;
  shortDescription: string | null;
}

const subtitleLine = (
  subtitle: string | null | undefined,
  segments: KeywordBreakdownSegment[] | undefined,
): ListingLine => ({
  ...(subtitle !== undefined ? { subtitle } : {}),
  ...(segments ? { subtitleSegments: segments } : {}),
});

const shortDescriptionLine = (
  text: string | undefined,
  segments: KeywordBreakdownSegment[] | undefined,
): ListingLine => ({
  ...(text !== undefined ? { shortDescription: text } : {}),
  ...(segments ? { shortDescriptionSegments: segments } : {}),
});

export function listingJudge(
  store: Store,
  keyword: string,
  subtitles: ReadonlyMap<string, string | null>,
): (row: ListedRow) => ListingLine {
  const judge = placementJudge(keyword);
  const play = store === Store.GOOGLE_PLAY;
  return (row) => {
    const second = play
      ? (row.shortDescription ?? undefined)
      : subtitles.get(row.storeAppId);
    const { placement, secondSegments } = judge(row.title, second);
    return {
      ...(placement ? { placement } : {}),
      ...(play
        ? shortDescriptionLine(second ?? undefined, secondSegments)
        : subtitleLine(second, secondSegments)),
    };
  };
}
