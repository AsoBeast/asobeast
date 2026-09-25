import { useSuspenseQuery } from "@tanstack/react-query";
import { storefrontRows, type StorefrontRow } from "@/lib/localizations";
import { appDetailOptions, keywordCountriesOptions } from "@/lib/queries";

export function useStorefrontRows(id: string): StorefrontRow[] {
  const { data: app } = useSuspenseQuery(appDetailOptions(id));
  const { data: markets } = useSuspenseQuery(keywordCountriesOptions(id));
  return storefrontRows(
    app.country,
    markets.map((market) => market.country),
  );
}
