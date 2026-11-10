import type {
  KeywordInspection,
  KeywordInspectionList,
  KeywordInspectionRequest,
  Store,
} from "@asobeast/shared";
import { apiFetch, withQuery } from "./client";

export interface KeywordInspectionListQuery {
  keyword?: string;
  store?: Store;
  country?: string;
  limit?: number;
}

export function listKeywordInspections(
  query: KeywordInspectionListQuery = {},
): Promise<KeywordInspectionList> {
  const params = new URLSearchParams({
    ...(query.keyword ? { keyword: query.keyword } : {}),
    ...(query.store ? { store: query.store } : {}),
    ...(query.country ? { country: query.country } : {}),
    ...(query.limit === undefined ? {} : { limit: String(query.limit) }),
  });
  return apiFetch<KeywordInspectionList>(
    withQuery("/keyword-inspections", params),
  );
}

export function getKeywordInspection(id: string): Promise<KeywordInspection> {
  return apiFetch<KeywordInspection>(
    `/keyword-inspections/${encodeURIComponent(id)}`,
  );
}

export function requestKeywordInspection(
  request: KeywordInspectionRequest,
): Promise<KeywordInspection> {
  return apiFetch<KeywordInspection>("/keyword-inspections", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export function deleteKeywordInspection(id: string): Promise<void> {
  return apiFetch<void>(`/keyword-inspections/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
