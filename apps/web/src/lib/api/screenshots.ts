import type { AppScreenshots } from "@asobeast/shared";
import { apiFetch } from "./client";

export function getAppScreenshots(appId: string): Promise<AppScreenshots> {
  return apiFetch<AppScreenshots>(`/apps/${appId}/screenshots`);
}
