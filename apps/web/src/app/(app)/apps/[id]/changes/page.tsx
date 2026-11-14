import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { changeWindowRange } from "@/components/changes/change-activity";
import { ChangesView } from "@/components/changes/ChangesView";
import { getQueryClient } from "@/lib/get-query-client";
import { queryMarket, resolveMarket } from "@/lib/market";
import {
  appDetailOptions,
  changeImpactOptions,
  changesOptions,
  keywordCountriesOptions,
  listingMarketsOptions,
  visibilityOptions,
} from "@/lib/queries";
import { todayUtc } from "@/lib/ranges";
import {
  changeDaysParser,
  countryParser,
  marketParser,
} from "@/lib/search-params";

export default async function ChangesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    days?: string | string[];
    country?: string | string[];
    market?: string | string[];
  }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const days = changeDaysParser.parseServerSide(sp.days);

  const queryClient = getQueryClient();
  const [app, markets] = await Promise.all([
    queryClient.fetchQuery(appDetailOptions(id)),
    queryClient.fetchQuery(listingMarketsOptions(id)).catch(() => []),
  ]);
  const market = countryParser.parseServerSide(sp.country) || app.country;
  const listing = resolveMarket(
    marketParser.parseServerSide(sp.market),
    markets,
    app.country,
  );
  await Promise.all([
    queryClient.prefetchQuery(
      changesOptions(id, days, queryMarket(listing, app.country)),
    ),
    queryClient.prefetchQuery(keywordCountriesOptions(id)),
    queryClient.prefetchQuery(changeImpactOptions(id, days, market)),
    queryClient.prefetchQuery(
      visibilityOptions(id, changeWindowRange(todayUtc(), days), market),
    ),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ChangesView id={id} store={app.store} homeCountry={app.country} />
    </HydrationBoundary>
  );
}
