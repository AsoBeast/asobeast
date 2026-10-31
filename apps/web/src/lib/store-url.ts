import type { Store } from "@asobeast/shared";

export function storeUrl(
  store: Store,
  storeAppId: string,
  country: string,
): string {
  return store === "APP_STORE"
    ? `https://apps.apple.com/${country}/app/id${storeAppId}`
    : `https://play.google.com/store/apps/details?id=${encodeURIComponent(storeAppId)}&gl=${country}`;
}
