import {
  type DefaultingListing,
  localizationLanguage,
  storefrontLanguage,
  type Store,
} from "@asobeast/shared";
import { draftScopeOf } from "@/lib/listing-draft";

export function densityLanguage(
  store: Store,
  market: string,
  localization: string | null | undefined,
  app?: DefaultingListing,
): string | null {
  const scope = draftScopeOf(store, market, localization ?? undefined, app);
  return scope.store === "APP_STORE"
    ? localizationLanguage(scope.localization).toLowerCase()
    : storefrontLanguage(scope.country);
}
