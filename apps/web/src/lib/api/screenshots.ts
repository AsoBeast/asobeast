import type { AppScreenshots } from "@asobeast/shared";
import { apiFetch, marketParams, withQuery } from "./client";

export function getAppScreenshots(
  appId: string,
  country?: string,
  localization?: string,
): Promise<AppScreenshots> {
  return apiFetch<AppScreenshots>(
    withQuery(
      `/apps/${appId}/screenshots`,
      marketParams(country, localization),
    ),
  );
}
