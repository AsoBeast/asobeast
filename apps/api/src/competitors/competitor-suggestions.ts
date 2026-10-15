import {
  COMPETITOR_SUGGESTIONS_LIMIT,
  CompetitorDiscoveryItem,
  CompetitorSuggestion,
} from '@asobeast/shared';
import { SearchItem } from '../store-providers/types';

function fromSerp(
  item: CompetitorDiscoveryItem,
  similarIcon: string | undefined,
): CompetitorSuggestion {
  return {
    storeAppId: item.storeAppId,
    title: item.title,
    developer: item.developer,
    iconUrl: item.iconUrl ?? similarIcon ?? null,
    source: 'serp',
    appearances: item.appearances,
    bestPosition: item.bestPosition,
  };
}

function fromSimilar(item: SearchItem): CompetitorSuggestion {
  return {
    storeAppId: item.storeAppId,
    title: item.title,
    developer: item.developer ?? null,
    iconUrl: item.iconUrl ?? null,
    source: 'similar',
    appearances: null,
    bestPosition: null,
  };
}

export function mergeSuggestions(
  serp: readonly CompetitorDiscoveryItem[],
  similar: readonly SearchItem[],
  exclude: ReadonlySet<string>,
  limit = COMPETITOR_SUGGESTIONS_LIMIT,
): CompetitorSuggestion[] {
  const seen = new Set(exclude);
  const merged: CompetitorSuggestion[] = [];
  const similarIcons = new Map(
    similar.map((item) => [item.storeAppId, item.iconUrl]),
  );
  for (const suggestion of [
    ...serp.map((item) => fromSerp(item, similarIcons.get(item.storeAppId))),
    ...similar.map(fromSimilar),
  ]) {
    if (merged.length === limit) break;
    if (seen.has(suggestion.storeAppId)) continue;
    seen.add(suggestion.storeAppId);
    merged.push(suggestion);
  }
  return merged;
}
