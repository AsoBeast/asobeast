import type {
  CategoryRankSeries,
  RankingSeries,
  SerpMovers,
  SerpSnapshot,
} from "@asobeast/shared";
import { apiFetch, withQuery } from "./client";
import type { RangeParams, RankingParams } from "./client";

export function getRankings(
  appId: string,
  { from, to, keywordIds }: RankingParams = {},
): Promise<RankingSeries> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (keywordIds && keywordIds.length > 0) {
    params.set("keywordIds", keywordIds.join(","));
  }
  return apiFetch<RankingSeries>(withQuery(`/apps/${appId}/rankings`, params));
}

export function getSerp(
  keywordId: string,
  date?: string,
): Promise<SerpSnapshot> {
  const query = date ? `?date=${date}` : "";
  return apiFetch<SerpSnapshot>(`/keywords/${keywordId}/serp${query}`);
}

export function getSerpMovers(
  appId: string,
  days?: number,
): Promise<SerpMovers> {
  const query = days !== undefined ? `?days=${days}` : "";
  return apiFetch<SerpMovers>(`/apps/${appId}/serp-movers${query}`);
}

export function getCategoryRanks(
  appId: string,
  { from, to }: RangeParams = {},
): Promise<CategoryRankSeries> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return apiFetch<CategoryRankSeries>(
    withQuery(`/apps/${appId}/category-ranks`, params),
  );
}
