import {
  DISCOVERY_LIST_LIMIT,
  type KeywordDiscoveryDismissRequest,
  type KeywordDiscoveryDismissResult,
  type KeywordDiscoveryList,
  type KeywordDiscoveryRefreshResult,
  type KeywordDiscoverySettings,
  type KeywordDiscoverySettingsRequest,
  type KeywordDiscoveryTrackRequest,
  type KeywordDiscoveryTrackResult,
} from "@asobeast/shared";
import { apiFetch, marketParams, withQuery } from "./client";

const discoveriesPath = (appId: string): string =>
  `/apps/${appId}/keyword-discoveries`;

export function getKeywordDiscoveries(
  appId: string,
  country?: string,
): Promise<KeywordDiscoveryList> {
  const params = marketParams(country);
  params.set("limit", String(DISCOVERY_LIST_LIMIT.max));
  return apiFetch<KeywordDiscoveryList>(
    withQuery(discoveriesPath(appId), params),
  );
}

export function trackKeywordDiscoveries(
  appId: string,
  request: KeywordDiscoveryTrackRequest,
): Promise<KeywordDiscoveryTrackResult> {
  return apiFetch<KeywordDiscoveryTrackResult>(
    `${discoveriesPath(appId)}/track`,
    { method: "POST", body: JSON.stringify(request) },
  );
}

export function dismissKeywordDiscoveries(
  appId: string,
  keywordIds: string[],
): Promise<KeywordDiscoveryDismissResult> {
  return apiFetch<KeywordDiscoveryDismissResult>(
    `${discoveriesPath(appId)}/dismiss`,
    {
      method: "POST",
      body: JSON.stringify({
        keywordIds,
      } satisfies KeywordDiscoveryDismissRequest),
    },
  );
}

export function refreshKeywordDiscoveries(
  appId: string,
): Promise<KeywordDiscoveryRefreshResult> {
  return apiFetch<KeywordDiscoveryRefreshResult>(
    `${discoveriesPath(appId)}/refresh`,
    { method: "POST" },
  );
}

export function setKeywordDiscoverySettings(
  appId: string,
  autoTrackRanked: boolean,
): Promise<KeywordDiscoverySettings> {
  return apiFetch<KeywordDiscoverySettings>(
    `${discoveriesPath(appId)}/settings`,
    {
      method: "PATCH",
      body: JSON.stringify({
        autoTrackRanked,
      } satisfies KeywordDiscoverySettingsRequest),
    },
  );
}
