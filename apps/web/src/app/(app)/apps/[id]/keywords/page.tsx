import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { TrackedKeywordItem } from "@asobeast/shared";
import { KeywordsWorkspace } from "@/components/keywords/KeywordsWorkspace";
import {
  chartedSelection,
  defaultSeed,
} from "@/components/keywords/dynamics-selection";
import { hasMarketReads, ownsKeywordFields } from "@/lib/app-localizations";
import { getQueryClient } from "@/lib/get-query-client";
import { queryMarket } from "@/lib/market";
import { presetDays, presetToRange } from "@/lib/ranges";
import {
  appDetailOptions,
  changesOptions,
  keywordCountriesOptions,
  keywordFieldOptions,
  keywordsOptions,
  marketKeywordFieldsOptions,
  rankingsOptions,
} from "@/lib/queries";
import {
  combinationParsers,
  COMBINATION_URL_KEYS,
  countryParser,
  keywordChartSelectionParser,
  rangeParser,
} from "@/lib/search-params";

export default async function KeywordsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    country?: string | string[];
    combos?: string | string[];
    keywords?: string | string[];
    range?: string | string[];
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
  const selection = keywordChartSelectionParser.parseServerSide(sp.keywords);
  const range = rangeParser.parseServerSide(sp.range);

  await Promise.all([
    queryClient.prefetchQuery(keywordCountriesOptions(id)),
    queryClient.prefetchQuery(keywordsOptions(id, market)),
    isAppStore && combinationsOpen
      ? queryClient.prefetchQuery(keywordFieldOptions(id))
      : null,
  ]);
  const tracked =
    queryClient.getQueryData<TrackedKeywordItem[]>(
      keywordsOptions(id, market).queryKey,
    ) ?? [];
  const charted =
    selection.mode === "hidden"
      ? []
      : chartedSelection(
          selection.mode === "chart" ? selection.ids : defaultSeed(tracked),
          tracked,
        ).charted;
  if (charted.length > 0) {
    await Promise.all([
      queryClient.prefetchQuery(
        rankingsOptions(id, { ...presetToRange(range), keywordIds: charted }),
      ),
      queryClient.prefetchQuery(
        changesOptions(id, presetDays(range), queryMarket(market, app.country)),
      ),
    ]);
  }
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
        />
      </div>
    </HydrationBoundary>
  );
}
