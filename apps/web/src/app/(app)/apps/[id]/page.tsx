import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { ActionsSummaryCard } from "@/components/actions/ActionsSummaryCard";
import { TOP_ACTION_LIMIT } from "@/lib/action-filters";
import { ActionsSummaryCardSkeleton } from "@/components/actions/skeletons";
import { CategoryRankCard } from "@/components/overview/CategoryRankCard";
import { CoverageCard } from "@/components/overview/CoverageCard";
import { MoversCard } from "@/components/overview/MoversCard";
import { RankDistributionChart } from "@/components/overview/RankDistributionChart";
import { RankDistributionHistoryChart } from "@/components/overview/RankDistributionHistoryChart";
import {
  ChartCardSkeleton,
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
  actionSummaryOptions,
  appSummaryOptions,
  categoryRanksOptions,
  rankDistributionHistoryOptions,
  visibilityOptions,
} from "@/lib/queries";
import { presetToRange } from "@/lib/ranges";
import { rangeParser } from "@/lib/search-params";

export default async function AppOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ categoryRange?: string | string[] }>;
}) {
  const { id } = await params;
  const categoryRange = rangeParser.parseServerSide(
    (await searchParams).categoryRange,
  );

  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(appSummaryOptions(id));
  void queryClient.prefetchQuery(visibilityOptions(id, presetToRange("30d")));
  void queryClient.prefetchQuery(
    categoryRanksOptions(id, presetToRange(categoryRange)),
  );
  void queryClient.prefetchQuery(
    rankDistributionHistoryOptions(id, presetToRange("30d")),
  );
  void queryClient.prefetchQuery(actionSummaryOptions);
  void queryClient.prefetchQuery(
    actionsOptions({ status: ["OPEN"], limit: TOP_ACTION_LIMIT }, id),
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="page-wide flex flex-col gap-6">
        <Suspense fallback={<Skeleton className="h-12 w-full max-w-md" />}>
          <SnapshotFacts id={id} />
        </Suspense>

        <Suspense fallback={<StatCardsSkeleton />}>
          <StatCards id={id} />
        </Suspense>

        <Suspense fallback={<ActionsSummaryCardSkeleton />}>
          <ActionsSummaryCard appId={id} />
        </Suspense>

        <div className="grid gap-6 lg:grid-cols-3 [&>*]:min-w-0">
          <div className="lg:col-span-2">
            <VisibilityChart id={id} />
          </div>
          <Suspense fallback={<ChartCardSkeleton />}>
            <RankDistributionChart id={id} />
          </Suspense>
        </div>

        <RankDistributionHistoryChart id={id} />

        <CategoryRankCard id={id} />

        <div className="grid gap-6 lg:grid-cols-2">
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
