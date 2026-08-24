import type {
  RatingsHistogram,
  RatingsHistory,
  ReviewList,
} from "@asobeast/shared";
import { apiFetch, withQuery } from "./client";
import type { RangeParams } from "./client";

export interface ReviewFilters {
  score?: number;
  version?: string;
  limit?: number;
}

export function getReviews(
  appId: string,
  { score, version, limit }: ReviewFilters = {},
): Promise<ReviewList> {
  const params = new URLSearchParams();
  if (score !== undefined) params.set("score", String(score));
  if (version) params.set("version", version);
  if (limit !== undefined) params.set("limit", String(limit));
  return apiFetch<ReviewList>(withQuery(`/apps/${appId}/reviews`, params));
}

export function getRatingsHistogram(appId: string): Promise<RatingsHistogram> {
  return apiFetch<RatingsHistogram>(`/apps/${appId}/reviews/histogram`);
}

export function getRatingsHistory(
  appId: string,
  { from, to }: RangeParams = {},
): Promise<RatingsHistory> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return apiFetch<RatingsHistory>(
    withQuery(`/apps/${appId}/ratings-history`, params),
  );
}
