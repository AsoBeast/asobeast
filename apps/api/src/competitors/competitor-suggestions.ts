import {
  COMPETITOR_SUGGESTIONS_LIMIT,
  CompetitorDiscoveryItem,
  CompetitorSuggestion,
} from '@asobeast/shared';
import { SearchItem } from '../store-providers/types';

export function withSimilarIcons(
  serp: readonly CompetitorDiscoveryItem[],
  similar: readonly SearchItem[],
): CompetitorDiscoveryItem[] {
  const icons = new Map(similar.map((item) => [item.storeAppId, item.iconUrl]));
  return serp.map((item) => ({
    ...item,
    iconUrl: item.iconUrl ?? icons.get(item.storeAppId) ?? null,
  }));
}

function fromSerp(item: CompetitorDiscoveryItem): CompetitorSuggestion {
  return {
    storeAppId: item.storeAppId,
    title: item.title,
    developer: item.developer,
    iconUrl: item.iconUrl ?? null,
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
  for (const suggestion of [
    ...serp.map(fromSerp),
    ...similar.map(fromSimilar),
  ]) {
    if (merged.length === limit) break;
    if (seen.has(suggestion.storeAppId)) continue;
    seen.add(suggestion.storeAppId);
    merged.push(suggestion);
  }
  return merged;
}
