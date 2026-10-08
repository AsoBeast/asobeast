import type { ChangeImpactReport, ChangeTimeline } from "@asobeast/shared";
import { apiFetch, withQuery } from "./client";

export function getChanges(
  appId: string,
  days?: number,
  country?: string,
): Promise<ChangeTimeline> {
  const params = new URLSearchParams();
  if (days !== undefined) params.set("days", String(days));
  if (country !== undefined) params.set("country", country);
  return apiFetch<ChangeTimeline>(withQuery(`/apps/${appId}/changes`, params));
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
