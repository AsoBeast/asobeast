import type { ChangeTimeline } from "@asobeast/shared";
import { apiFetch } from "./client";

export function getChanges(
  appId: string,
  days?: number,
): Promise<ChangeTimeline> {
  const query = days !== undefined ? `?days=${days}` : "";
  return apiFetch<ChangeTimeline>(`/apps/${appId}/changes${query}`);
}

export function getRecentChanges(limit?: number): Promise<ChangeTimeline> {
  const query = limit !== undefined ? `?limit=${limit}` : "";
  return apiFetch<ChangeTimeline>(`/changes/recent${query}`);
}
