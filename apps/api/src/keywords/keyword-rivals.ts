import { isCheckFresh } from '@asobeast/shared';
import { KeywordSerpDays, SerpDays } from './keyword-serp-days';

function newestDay(days: SerpDays): string | null {
  const keys = [...days.keys()].sort();
  return keys.length === 0 ? null : keys[keys.length - 1];
}

function distinctIn(
  storeAppIds: readonly string[],
  competitors: ReadonlySet<string>,
): number {
  return new Set(storeAppIds.filter((id) => competitors.has(id))).size;
}

export function competitorsInTop10(
  days: KeywordSerpDays,
  competitorStoreAppIds: ReadonlySet<string>,
  today: string,
): Map<string, number | null> {
  const counts = new Map<string, number | null>();
  if (competitorStoreAppIds.size === 0) {
    return counts;
  }
  for (const [keywordId, byDate] of days) {
    const newest = newestDay(byDate);
    counts.set(
      keywordId,
      newest !== null && isCheckFresh(newest, today)
        ? distinctIn(byDate.get(newest) ?? [], competitorStoreAppIds)
        : null,
    );
  }
  return counts;
}
