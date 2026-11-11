import { Suspense } from "react";
import { cookies } from "next/headers";
import {
  dehydrate,
  HydrationBoundary,
  type QueryClient,
} from "@tanstack/react-query";
import { ActionsSummaryCard } from "@/components/actions/ActionsSummaryCard";
import { MarketSwitcher } from "@/components/app-detail/MarketSwitcher";
import { PrintReportButton } from "@/components/app-detail/PrintReportButton";
import { MarketSwitcherSkeleton } from "@/components/app-detail/skeletons";
import { TOP_ACTION_LIMIT } from "@/lib/action-filters";
import { AlertsNudge } from "@/components/onboarding/AlertsNudge";
import { FirstRunTimeline } from "@/components/onboarding/FirstRunTimeline";
import { CategoryRankCard } from "@/components/overview/CategoryRankCard";
import { CoverageCard } from "@/components/overview/CoverageCard";
import { FunnelCard } from "@/components/overview/FunnelCard";
import { MoversCard } from "@/components/overview/MoversCard";
import { RatingsByMarketCard } from "@/components/overview/RatingsByMarketCard";
import { KNOWN_SECTIONS } from "@/components/layout/known-sections";
import { OverviewReportHeader } from "@/components/overview/OverviewReportHeader";
import { OverviewPulse } from "@/components/overview/OverviewPulse";
import { RATING_CHANGE_RANGE } from "@/components/overview/rating-trend";
import {
  CoverageCardSkeleton,
  FunnelCardSkeleton,
  OverviewPulseSkeleton,
  SnapshotFactsSkeleton,
} from "@/components/overview/skeletons";
import {
  SPLIT_NARROW,
  SPLIT_ROW,
  SPLIT_WIDE,
} from "@/components/overview/layout-classes";
import {
  DoNextCardSkeleton,
  PortfolioMoversCardSkeleton,
} from "@/components/dashboard/skeletons";
import { SnapshotFacts } from "@/components/overview/SnapshotFacts";
import {
  COLLAPSED_COOKIE_NAME,
  parseCollapsed,
} from "@/lib/collapsed-sections";
import { getQueryClient } from "@/lib/get-query-client";
import {
  actionsOptions,
  actionSummaryFor,
  appDetailOptions,
  appListingOptions,
  appSummaryOptions,
  categoryRanksOptions,
  firstRunOptions,
  funnelOptions,
  listingMarketsOptions,
  rankDistributionHistoryOptions,
  ratingsHistoryOptions,
  storeConnectionsOptions,
  visibilityOptions,
} from "@/lib/queries";
import { FUNNEL_SERIES_DAYS } from "@/lib/funnel";
import { keywordScope, queryMarket, resolveMarket } from "@/lib/market";
import { presetToRange } from "@/lib/ranges";
import { ratesByMarket } from "@/lib/ratings-by-market";
import {
  marketParser,
  rangeParser,
  visibilityRangeParser,
  visibilityViewParser,
  type VisibilityView,
} from "@/lib/search-params";

interface ChartScope {
  id: string;
  range: ReturnType<typeof presetToRange>;
  country: string | undefined;
}

const CHART_PREFETCH: Record<
  VisibilityView,
  (client: QueryClient, scope: ChartScope) => Promise<void>
> = {
  visibility: (client, { id, range, country }) =>
    client.prefetchQuery(visibilityOptions(id, range, country)),
  share: (client, { id, range, country }) =>
    client.prefetchQuery(visibilityOptions(id, range, country, "competitors")),
  top10: (client, { id, range, country }) =>
    client.prefetchQuery(rankDistributionHistoryOptions(id, range, country)),
  rating: (client, { id, range }) =>
    client.prefetchQuery(ratingsHistoryOptions(id, range)),
};

export default async function AppOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    categoryRange?: string | string[];
    market?: string | string[];
    range?: string | string[];
    visView?: string | string[];
  }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const categoryRange = rangeParser.parseServerSide(sp.categoryRange);
  const chartRange = presetToRange(
    visibilityRangeParser.parseServerSide(sp.range),
  );
  const view = visibilityViewParser.parseServerSide(sp.visView);
  const collapsed = parseCollapsed(
    (await cookies()).get(COLLAPSED_COOKIE_NAME)?.value,
    KNOWN_SECTIONS,
  );

  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(
    categoryRanksOptions(id, presetToRange(categoryRange)),
  );
  void queryClient.prefetchQuery(actionSummaryFor(id));
  void queryClient.prefetchQuery(
    actionsOptions({ status: ["OPEN"], limit: TOP_ACTION_LIMIT }, id),
  );
  void queryClient.prefetchQuery(
    ratingsHistoryOptions(id, presetToRange(RATING_CHANGE_RANGE)),
  );
  const firstRun = queryClient.prefetchQuery(firstRunOptions(id));
  const requested = marketParser.parseServerSide(sp.market);
  const listingMarkets = queryClient
    .fetchQuery(listingMarketsOptions(id))
    .catch(() => []);
  const scope = requested
    ? listingMarkets.then((markets) => keywordScope(requested, markets))
    : Promise.resolve(undefined);
  void scope.then((country) => {
    void queryClient.prefetchQuery(appSummaryOptions(id, country));
    void CHART_PREFETCH[view](queryClient, { id, range: chartRange, country });
  });
  const [app, markets] = await Promise.all([
    queryClient.fetchQuery(appDetailOptions(id)),
    listingMarkets,
    queryClient.prefetchQuery(storeConnectionsOptions),
  ]);
  const funnel = !app.isCompetitor;
  if (funnel) {
    void scope.then((country) =>
      queryClient.prefetchQuery(funnelOptions(id, FUNNEL_SERIES_DAYS, country)),
    );
  }
  const market = resolveMarket(requested, markets, app.country);
  await queryClient.prefetchQuery(
    appListingOptions(id, queryMarket(market, app.country)),
  );
  await firstRun;
  const byMarket = ratesByMarket(app.store);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="page-wide @container/overview flex flex-col gap-6">
        <Suspense fallback={null}>
          <OverviewReportHeader id={id} />
        </Suspense>

        <FirstRunTimeline id={id} />

        <AlertsNudge id={id} />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Suspense fallback={<SnapshotFactsSkeleton />}>
            <SnapshotFacts id={id} />
          </Suspense>
          <div className="flex flex-wrap items-center gap-3">
            <Suspense fallback={<MarketSwitcherSkeleton />}>
              <MarketSwitcher id={id} allowAll />
            </Suspense>
            <PrintReportButton />
          </div>
        </div>

        <Suspense fallback={<OverviewPulseSkeleton />}>
          <OverviewPulse id={id} />
        </Suspense>

        <div className={SPLIT_ROW}>
          <div className={SPLIT_WIDE}>
            <Suspense fallback={<PortfolioMoversCardSkeleton />}>
              <MoversCard id={id} />
            </Suspense>
          </div>
          <div className={SPLIT_NARROW}>
            <Suspense fallback={<DoNextCardSkeleton />}>
              <ActionsSummaryCard appId={id} />
            </Suspense>
            <Suspense fallback={<CoverageCardSkeleton />}>
              <CoverageCard id={id} />
            </Suspense>
          </div>
        </div>

        <Suspense fallback={<FunnelCardSkeleton store={app.store} />}>
          <FunnelCard id={id} store={app.store} />
        </Suspense>

        {byMarket ? (
          <div className={SPLIT_ROW}>
            <div className={SPLIT_WIDE}>
              <CategoryRankCard id={id} />
            </div>
            <div className={SPLIT_NARROW}>
              <RatingsByMarketCard
                id={id}
                canTrack={!app.isCompetitor}
                collapsed={[...collapsed]}
              />
            </div>
          </div>
        ) : (
          <CategoryRankCard id={id} />
        )}
      </div>
    </HydrationBoundary>
  );
}
