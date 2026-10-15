import type {
  ChartCaptureRequest,
  ChartCompareWindow,
  ChartFollowItem,
  ChartFollowRequest,
  ChartKey,
  ChartPage,
} from "@asobeast/shared";
import { apiFetch, withQuery } from "./client";

export interface ChartPageQuery extends ChartKey {
  date?: string;
  compare: ChartCompareWindow;
}

export function getChart(query: ChartPageQuery): Promise<ChartPage> {
  const params = new URLSearchParams({
    store: query.store,
    country: query.country,
    collection: query.collection,
    genre: query.genre,
    device: query.device,
    compare: query.compare,
    ...(query.date ? { date: query.date } : {}),
  });
  return apiFetch<ChartPage>(withQuery("/charts", params));
}

export function captureChart(key: ChartCaptureRequest): Promise<ChartPage> {
  return apiFetch<ChartPage>("/charts/capture", {
    method: "POST",
    body: JSON.stringify(key),
  });
}

export function followChart(key: ChartFollowRequest): Promise<ChartFollowItem> {
  return apiFetch<ChartFollowItem>("/charts/follows", {
    method: "POST",
    body: JSON.stringify(key),
  });
}

export function unfollowChart(id: string): Promise<void> {
  return apiFetch<void>(`/charts/follows/${id}`, { method: "DELETE" });
}
