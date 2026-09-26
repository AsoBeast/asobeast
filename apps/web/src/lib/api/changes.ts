import type { ChangeImpactReport, ChangeTimeline } from "@asobeast/shared";
import { apiFetch, withQuery } from "./client";

export function getChanges(
  appId: string,
  days?: number,
): Promise<ChangeTimeline> {
  const query = days !== undefined ? `?days=${days}` : "";
  return apiFetch<ChangeTimeline>(`/apps/${appId}/changes${query}`);
}

export function getChangeImpact(
  appId: string,
  days: number,
  country: string,
): Promise<ChangeImpactReport> {
  const params = new URLSearchParams({ days: String(days), country });
  return apiFetch<ChangeImpactReport>(
    withQuery(`/apps/${appId}/changes/impact`, params),
  );
}

export function getRecentChanges(limit?: number): Promise<ChangeTimeline> {
  const query = limit !== undefined ? `?limit=${limit}` : "";
  return apiFetch<ChangeTimeline>(`/changes/recent${query}`);
}
