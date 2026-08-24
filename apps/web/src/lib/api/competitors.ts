import type {
  CompetitorAddRequest,
  CompetitorDiscovery,
  CompetitorItem,
} from "@asobeast/shared";
import { apiFetch } from "./client";

export function getCompetitors(appId: string): Promise<CompetitorItem[]> {
  return apiFetch<CompetitorItem[]>(`/apps/${appId}/competitors`);
}

export function addCompetitor(
  appId: string,
  url: string,
): Promise<CompetitorItem> {
  return apiFetch<CompetitorItem>(`/apps/${appId}/competitors`, {
    method: "POST",
    body: JSON.stringify({ url } satisfies CompetitorAddRequest),
  });
}

export function removeCompetitor(
  appId: string,
  competitorId: string,
): Promise<void> {
  return apiFetch<void>(`/apps/${appId}/competitors/${competitorId}`, {
    method: "DELETE",
  });
}

export function getCompetitorDiscovery(
  appId: string,
  days?: number,
): Promise<CompetitorDiscovery> {
  const query = days !== undefined ? `?days=${days}` : "";
  return apiFetch<CompetitorDiscovery>(
    `/apps/${appId}/competitors/discovery${query}`,
  );
}
