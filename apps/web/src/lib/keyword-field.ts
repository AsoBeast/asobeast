import {
  type AppStoreLocalization,
  type KeywordFieldQuery,
  readLocalizations,
} from "@asobeast/shared";

export function fieldLocalization(
  market: string,
  requested: AppStoreLocalization | null,
): AppStoreLocalization | undefined {
  const read = readLocalizations(market);
  return requested !== null && read.includes(requested) ? requested : read[0];
}

export function keywordFieldQuery(
  home: string,
  market: string,
  requested: AppStoreLocalization | null,
): KeywordFieldQuery {
  const localization = fieldLocalization(market, requested);
  return {
    ...(market === home ? {} : { country: market }),
    ...(localization === undefined ||
    localization === readLocalizations(market)[0]
      ? {}
      : { localization }),
  };
}

export function keywordFieldHref(
  id: string,
  home: string,
  market: string,
  localization: AppStoreLocalization | undefined,
): string {
  const query = keywordFieldQuery(home, market, localization ?? null);
  const params = new URLSearchParams({
    ...(query.country ? { country: query.country } : {}),
    ...(query.localization ? { fieldLocale: query.localization } : {}),
  });
  const search = params.toString();
  return `/apps/${id}/keywords${search ? `?${search}` : ""}`;
}
