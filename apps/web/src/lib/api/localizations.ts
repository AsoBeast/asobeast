import type {
  AddAppLocalizationRequest,
  AppLocalizationItem,
  AppLocalizationsResult,
  AppStoreLocalization,
  KeywordFieldPreviewRequest,
  KeywordFieldSavePreview,
  LocalizedKeywordFieldRequest,
  LocalizedKeywordFieldResult,
  MarketKeywordFields,
} from "@asobeast/shared";
import { apiFetch, withQuery } from "./client";

export function getAppLocalizations(
  appId: string,
): Promise<AppLocalizationsResult> {
  return apiFetch<AppLocalizationsResult>(`/apps/${appId}/localizations`);
}

export function saveLocalizedKeywordField(
  appId: string,
  localization: AppStoreLocalization,
  body: LocalizedKeywordFieldRequest,
): Promise<LocalizedKeywordFieldResult> {
  return apiFetch<LocalizedKeywordFieldResult>(
    `/apps/${appId}/keyword-fields/${localization}`,
    {
      method: "PUT",
      body: JSON.stringify(body satisfies LocalizedKeywordFieldRequest),
    },
  );
}

export function previewLocalizedKeywordField(
  appId: string,
  localization: AppStoreLocalization,
  body: KeywordFieldPreviewRequest,
): Promise<KeywordFieldSavePreview> {
  return apiFetch<KeywordFieldSavePreview>(
    `/apps/${appId}/keyword-fields/${localization}/preview`,
    {
      method: "POST",
      body: JSON.stringify(body satisfies KeywordFieldPreviewRequest),
    },
  );
}

export function addAppLocalization(
  appId: string,
  body: AddAppLocalizationRequest,
): Promise<AppLocalizationItem> {
  return apiFetch<AppLocalizationItem>(`/apps/${appId}/localizations`, {
    method: "POST",
    body: JSON.stringify(body satisfies AddAppLocalizationRequest),
  });
}

export function removeAppLocalization(
  appId: string,
  localization: AppStoreLocalization,
): Promise<void> {
  return apiFetch<void>(`/apps/${appId}/localizations/${localization}`, {
    method: "DELETE",
  });
}

export function getMarketKeywordFields(
  appId: string,
  country?: string,
): Promise<MarketKeywordFields> {
  const params = new URLSearchParams();
  if (country) params.set("country", country);
  return apiFetch<MarketKeywordFields>(
    withQuery(`/apps/${appId}/keyword-fields/market`, params),
  );
}
