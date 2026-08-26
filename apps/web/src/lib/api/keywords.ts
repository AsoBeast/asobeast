import type {
  KeywordAddRequest,
  KeywordComparison,
  KeywordCountrySummary,
  KeywordFieldRequest,
  KeywordFieldResult,
  KeywordSort,
  KeywordSuggestion,
  KeywordSuggestionStrategy,
  KeywordUpdateRequest,
  ScoreEnqueueResult,
  SpiderEnqueueResult,
  SpiderStartRequest,
  SpiderStatus,
  TrackedKeywordItem,
} from "@asobeast/shared";
import { apiFetch, withQuery } from "./client";

export function getKeywords(
  appId: string,
  sort?: KeywordSort,
  country?: string,
): Promise<TrackedKeywordItem[]> {
  const params = new URLSearchParams();
  if (sort) params.set("sort", sort);
  if (country) params.set("country", country);
  return apiFetch<TrackedKeywordItem[]>(
    withQuery(`/apps/${appId}/keywords`, params),
  );
}

export function getKeywordCountries(
  appId: string,
): Promise<KeywordCountrySummary[]> {
  return apiFetch<KeywordCountrySummary[]>(`/apps/${appId}/keyword-countries`);
}

export function addKeywords(
  appId: string,
  keywords: string[],
  country?: string,
): Promise<TrackedKeywordItem[]> {
  return apiFetch<TrackedKeywordItem[]>(`/apps/${appId}/keywords`, {
    method: "POST",
    body: JSON.stringify({ keywords, country } satisfies KeywordAddRequest),
  });
}

export function updateKeyword(
  appId: string,
  keywordId: string,
  body: KeywordUpdateRequest,
): Promise<TrackedKeywordItem> {
  return apiFetch<TrackedKeywordItem>(`/apps/${appId}/keywords/${keywordId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function removeKeyword(appId: string, keywordId: string): Promise<void> {
  return apiFetch<void>(`/apps/${appId}/keywords/${keywordId}`, {
    method: "DELETE",
  });
}

export function getSuggestions(
  appId: string,
  strategy: KeywordSuggestionStrategy,
  limit?: number,
  country?: string,
): Promise<KeywordSuggestion[]> {
  const params = new URLSearchParams({ strategy });
  if (limit !== undefined) params.set("limit", String(limit));
  if (country) params.set("country", country);
  return apiFetch<KeywordSuggestion[]>(
    withQuery(`/apps/${appId}/keywords/suggestions`, params),
  );
}

export function startSpider(
  appId: string,
  term: string,
  country?: string,
): Promise<SpiderEnqueueResult> {
  return apiFetch<SpiderEnqueueResult>(`/apps/${appId}/keywords/spider`, {
    method: "POST",
    body: JSON.stringify({ term, country } satisfies SpiderStartRequest),
  });
}

export function getSpiderStatus(
  appId: string,
  term: string,
  country?: string,
): Promise<SpiderStatus> {
  const params = new URLSearchParams({ term });
  if (country) params.set("country", country);
  return apiFetch<SpiderStatus>(
    withQuery(`/apps/${appId}/keywords/spider`, params),
  );
}

export function getComparison(
  appId: string,
  onlyGaps?: boolean,
): Promise<KeywordComparison> {
  const params = new URLSearchParams();
  if (onlyGaps) params.set("onlyGaps", "true");
  return apiFetch<KeywordComparison>(
    withQuery(`/apps/${appId}/keywords/compare`, params),
  );
}

export function getKeywordField(appId: string): Promise<KeywordFieldResult> {
  return apiFetch<KeywordFieldResult>(`/apps/${appId}/keyword-field`);
}

export function setKeywordField(
  appId: string,
  text: string,
): Promise<KeywordFieldResult> {
  return apiFetch<KeywordFieldResult>(`/apps/${appId}/keyword-field`, {
    method: "PUT",
    body: JSON.stringify({ text } satisfies KeywordFieldRequest),
  });
}

export function scoreKeyword(keywordId: string): Promise<ScoreEnqueueResult> {
  return apiFetch<ScoreEnqueueResult>(`/keywords/${keywordId}/score`, {
    method: "POST",
  });
}
