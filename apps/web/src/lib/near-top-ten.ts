import type { TrackedKeywordItem } from "@asobeast/shared";

const TOP = 10;
const REACH = 10;

export interface NearTopTenKeyword {
  keywordId: string;
  text: string;
  country: string;
  position: number;
  away: number;
}

export function nearTopTen(
  keywords: readonly TrackedKeywordItem[],
  limit: number,
): NearTopTenKeyword[] {
  return keywords
    .flatMap((keyword) => {
      const position = keyword.latestPosition;
      if (!keyword.active || position === null) return [];
      if (position <= TOP || position > TOP + REACH) return [];
      return [{ keyword, position }];
    })
    .sort(
      (a, b) =>
        a.position - b.position ||
        (b.keyword.volume ?? 0) - (a.keyword.volume ?? 0),
    )
    .slice(0, limit)
    .map(({ keyword, position }) => ({
      keywordId: keyword.keywordId,
      text: keyword.text,
      country: keyword.country,
      position,
      away: position - TOP,
    }));
}
