"use client";

import { useQuery } from "@tanstack/react-query";
import type { AppStoreLocalization } from "@asobeast/shared";
import type { DraftScope } from "@/lib/listing-draft";
import { appLocalizationsOptions } from "@/lib/queries";

export function useDraftKeywordField(appId: string, scope: DraftScope) {
  const appStore = scope.store === "APP_STORE";
  const read = useQuery({
    ...appLocalizationsOptions(appId),
    retry: false,
    enabled: appStore,
  });
  const { data } = read;
  const localization: AppStoreLocalization | null = appStore
    ? scope.localization
    : null;
  const listed =
    localization !== null &&
    (data?.localizations.some((item) => item.localization === localization) ??
      false);
  return {
    managed: data?.storeManaged === true,
    settled: !appStore || data !== undefined,
    read,
    sync: data?.storeSync ?? null,
    handoff: listed ? localization : null,
  };
}

export type DraftKeywordField = ReturnType<typeof useDraftKeywordField>;
