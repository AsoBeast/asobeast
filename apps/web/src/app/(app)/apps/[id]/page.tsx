import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { ActionsSummaryCard } from "@/components/actions/ActionsSummaryCard";
import { MarketSwitcher } from "@/components/app-detail/MarketSwitcher";
import { PrintReportButton } from "@/components/app-detail/PrintReportButton";
import { MarketSwitcherSkeleton } from "@/components/app-detail/skeletons";
import { TOP_ACTION_LIMIT } from "@/lib/action-filters";
import { ActionsSummaryCardSkeleton } from "@/components/actions/skeletons";
import { AlertsNudge } from "@/components/onboarding/AlertsNudge";
import { FirstRunTimeline } from "@/components/onboarding/FirstRunTimeline";
import { CategoryRankCard } from "@/components/overview/CategoryRankCard";
import { CoverageCard } from "@/components/overview/CoverageCard";
import { FunnelCard } from "@/components/overview/FunnelCard";
import { MoversCard } from "@/components/overview/MoversCard";
import { OverviewReportHeader } from "@/components/overview/OverviewReportHeader";
import { RankDistributionChart } from "@/components/overview/RankDistributionChart";
import { RankDistributionHistoryChart } from "@/components/overview/RankDistributionHistoryChart";
import {
  ChartCardSkeleton,
  FunnelCardSkeleton,
  PanelCardSkeleton,
  StatCardsSkeleton,
} from "@/components/overview/skeletons";
import { SnapshotFacts } from "@/components/overview/SnapshotFacts";
import { StatCards } from "@/components/overview/StatCards";
import { VisibilityChart } from "@/components/overview/VisibilityChart";
import { Skeleton } from "@/components/ui/skeleton";
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
  storeConnectionsOptions,
  visibilityOptions,
} from "@/lib/queries";
import { FUNNEL_SERIES_DAYS } from "@/lib/funnel";
import { keywordScope, queryMarket, resolveMarket } from "@/lib/market";
import { presetToRange } from "@/lib/ranges";
import { marketParser, rangeParser } from "@/lib/search-params";

export default async function AppOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    categoryRange?: string | string[];
    market?: string | string[];
  }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const categoryRange = rangeParser.parseServerSide(sp.categoryRange);

  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(
    categoryRanksOptions(id, presetToRange(categoryRange)),
  );
  void queryClient.prefetchQuery(actionSummaryFor(id));
  void queryClient.prefetchQuery(
    actionsOptions({ status: ["OPEN"], limit: TOP_ACTION_LIMIT }, id),
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
    void queryClient.prefetchQuery(
      visibilityOptions(id, presetToRange("30d"), country),
    );
    void queryClient.prefetchQuery(
      rankDistributionHistoryOptions(id, presetToRange("30d"), country),
    );
  });
  const [app, markets] = await Promise.all([
    queryClient.fetchQuery(appDetailOptions(id)),
    listingMarkets,
    queryClient.prefetchQuery(storeConnectionsOptions),
  ]);
  const funnel = app.store === "APP_STORE" && !app.isCompetitor;
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

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="page-wide flex flex-col gap-6">
        <Suspense fallback={null}>
          <OverviewReportHeader id={id} />
        </Suspense>

        <FirstRunTimeline id={id} />

        <AlertsNudge id={id} />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Suspense fallback={<Skeleton className="h-12 w-full max-w-md" />}>
            <SnapshotFacts id={id} />
          </Suspense>
          <div className="flex flex-wrap items-center gap-3">
            <Suspense fallback={<MarketSwitcherSkeleton />}>
              <MarketSwitcher id={id} allowAll />
            </Suspense>
            <PrintReportButton />
          </div>
        </div>

        <Suspense fallback={<StatCardsSkeleton />}>
          <StatCards id={id} />
        </Suspense>

        {funnel ? (
          <Suspense fallback={<FunnelCardSkeleton />}>
            <FunnelCard id={id} />
          </Suspense>
        ) : null}

        <Suspense fallback={<ActionsSummaryCardSkeleton />}>
          <ActionsSummaryCard appId={id} />
        </Suspense>

        <div className="grid gap-6 lg:grid-cols-3 print:grid-cols-1 [&>*]:min-w-0">
          <div className="lg:col-span-2 print:col-span-1">
            <VisibilityChart id={id} />
          </div>
          <Suspense fallback={<ChartCardSkeleton />}>
            <RankDistributionChart id={id} />
          </Suspense>
        </div>

        <RankDistributionHistoryChart id={id} />

        <CategoryRankCard id={id} />

        <div className="grid gap-6 lg:grid-cols-2 print:grid-cols-1">
          <Suspense fallback={<PanelCardSkeleton />}>
            <MoversCard id={id} />
          </Suspense>
          <Suspense fallback={<PanelCardSkeleton />}>
            <CoverageCard id={id} />
          </Suspense>
        </div>
      </div>
    </HydrationBoundary>
  );
}
