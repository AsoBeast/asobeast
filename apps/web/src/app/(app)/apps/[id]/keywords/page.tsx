import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { KeywordsWorkspace } from "@/components/keywords/KeywordsWorkspace";
import { hasMarketReads, ownsKeywordFields } from "@/lib/app-localizations";
import { getQueryClient } from "@/lib/get-query-client";
import {
  appDetailOptions,
  keywordCountriesOptions,
  keywordDiscoveriesOptions,
  keywordFieldOptions,
  keywordsOptions,
  marketKeywordFieldsOptions,
} from "@/lib/queries";
import {
  combinationParsers,
  COMBINATION_URL_KEYS,
  countryParser,
  keywordsTabParser,
} from "@/lib/search-params";

export default async function KeywordsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    country?: string | string[];
    combos?: string | string[];
    tab?: string | string[];
  }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const queryClient = getQueryClient();
  const app = await queryClient.fetchQuery(appDetailOptions(id));
  const market = countryParser.parseServerSide(sp.country) || app.country;
  const isAppStore = app.store === "APP_STORE";
  const discoveries = !app.isCompetitor;
  const discovered =
    discoveries && keywordsTabParser.parseServerSide(sp.tab) === "discovered";
  const combinationsOpen = combinationParsers.open.parseServerSide(
    sp[COMBINATION_URL_KEYS.open],
  );

  await Promise.all([
    queryClient.prefetchQuery(keywordCountriesOptions(id)),
    queryClient.prefetchQuery(keywordsOptions(id, market)),
    isAppStore && combinationsOpen
      ? queryClient.prefetchQuery(keywordFieldOptions(id))
      : null,
    discovered
      ? queryClient.prefetchQuery(keywordDiscoveriesOptions(id, market))
      : null,
  ]);
  const keywordFields = ownsKeywordFields(app);
  if (keywordFields && hasMarketReads(app.country, market)) {
    void queryClient.prefetchQuery(marketKeywordFieldsOptions(id, market));
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="page-full">
        <KeywordsWorkspace
          id={id}
          homeCountry={app.country}
          store={app.store}
          keywordFields={keywordFields}
          discoveries={discoveries}
        />
      </div>
    </HydrationBoundary>
  );
}
