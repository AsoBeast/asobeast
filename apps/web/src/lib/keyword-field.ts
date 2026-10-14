import {
  type AppStoreLocalization,
  type KeywordFieldQuery,
  keywordFieldLocalizations,
  readLocalizations,
} from "@asobeast/shared";

export function fieldLocalizations(
  home: string,
  market: string,
): readonly AppStoreLocalization[] {
  return market === home
    ? keywordFieldLocalizations(market)
    : readLocalizations(market);
}

export function fieldLocalization(
  home: string,
  market: string,
  requested: AppStoreLocalization | null,
): AppStoreLocalization | undefined {
  const read = fieldLocalizations(home, market);
  return requested !== null && read.includes(requested) ? requested : read[0];
}

export function keywordFieldQuery(
  home: string,
  market: string,
  requested: AppStoreLocalization | null,
): KeywordFieldQuery {
  const localization = fieldLocalization(home, market, requested);
  return {
    ...(market === home ? {} : { country: market }),
    ...(localization === undefined ||
    localization === fieldLocalizations(home, market)[0]
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
