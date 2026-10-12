import type {
  AppLocalizationsResult,
  AppStoreLocalization,
  LocalizedKeywordFieldRequest,
  LocalizedKeywordFieldResult,
} from "@asobeast/shared";
import { apiFetch } from "./client";

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
