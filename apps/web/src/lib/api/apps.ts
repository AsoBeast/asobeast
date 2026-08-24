import type {
  AppDetail,
  AppGroupSummary,
  AppImportRequest,
  AppLinkRequest,
  AppListItem,
  MarketAvailabilityResult,
} from "@asobeast/shared";
import { apiFetch, withQuery } from "./client";

export function getApps(): Promise<AppListItem[]> {
  return apiFetch<AppListItem[]>("/apps");
}

export function getApp(id: string): Promise<AppDetail> {
  return apiFetch<AppDetail>(`/apps/${id}`);
}

export function importApp(url: string, country?: string): Promise<AppDetail> {
  return apiFetch<AppDetail>("/apps", {
    method: "POST",
    body: JSON.stringify({ url, country } satisfies AppImportRequest),
  });
}

export function deleteApp(id: string): Promise<void> {
  return apiFetch<void>(`/apps/${id}`, { method: "DELETE" });
}

export function linkApp(id: string, appId: string): Promise<AppGroupSummary> {
  return apiFetch<AppGroupSummary>(`/apps/${id}/link`, {
    method: "POST",
    body: JSON.stringify({ appId } satisfies AppLinkRequest),
  });
}

export function unlinkApp(id: string): Promise<void> {
  return apiFetch<void>(`/apps/${id}/link`, { method: "DELETE" });
}

export function getMarketAvailability(
  appId: string,
  country: string,
): Promise<MarketAvailabilityResult> {
  const params = new URLSearchParams({ country });
  return apiFetch<MarketAvailabilityResult>(
    withQuery(`/apps/${appId}/market-availability`, params),
  );
}
