import {
  localizationLanguage,
  storefrontLanguage,
  type Store,
} from "@asobeast/shared";
import { draftScopeOf } from "@/lib/listing-draft";

export function densityLanguage(
  store: Store,
  market: string,
  localization: string | null | undefined,
): string | null {
  const scope = draftScopeOf(store, market, localization ?? undefined);
  return scope.store === "APP_STORE"
    ? localizationLanguage(scope.localization).toLowerCase()
    : storefrontLanguage(scope.country);
}
