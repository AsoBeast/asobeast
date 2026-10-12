import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { KeywordsWorkspace } from "@/components/keywords/KeywordsWorkspace";
import { hasMarketReads } from "@/lib/app-localizations";
import { getQueryClient } from "@/lib/get-query-client";
import {
  appDetailOptions,
  keywordCountriesOptions,
  keywordFieldOptions,
  keywordsOptions,
  marketKeywordFieldsOptions,
} from "@/lib/queries";
import {
  combinationParsers,
  COMBINATION_URL_KEYS,
  countryParser,
} from "@/lib/search-params";

export default async function KeywordsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    country?: string | string[];
    combos?: string | string[];
  }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const queryClient = getQueryClient();
  const app = await queryClient.fetchQuery(appDetailOptions(id));
  const market = countryParser.parseServerSide(sp.country) || app.country;
  const isAppStore = app.store === "APP_STORE";
  const combinationsOpen = combinationParsers.open.parseServerSide(
    sp[COMBINATION_URL_KEYS.open],
  );

  await Promise.all([
    queryClient.prefetchQuery(keywordCountriesOptions(id)),
    queryClient.prefetchQuery(keywordsOptions(id, market)),
    isAppStore && combinationsOpen
      ? queryClient.prefetchQuery(keywordFieldOptions(id))
      : null,
  ]);
  if (isAppStore && hasMarketReads(app.country, market)) {
    void queryClient.prefetchQuery(marketKeywordFieldsOptions(id, market));
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="page-full">
        <KeywordsWorkspace
          id={id}
          homeCountry={app.country}
          store={app.store}
        />
      </div>
    </HydrationBoundary>
  );
}
