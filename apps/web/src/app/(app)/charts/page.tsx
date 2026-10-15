import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { chartPageQueries } from "@/components/top-charts/chart-pages";
import { chartQueryFrom } from "@/components/top-charts/chart-params";
import { TopChartsSkeleton } from "@/components/top-charts/skeletons";
import { TopChartsView } from "@/components/top-charts/TopChartsView";
import { getQueryClient } from "@/lib/get-query-client";
import {
  accountPlanOptions,
  appsOptions,
  chartFollowsOptions,
} from "@/lib/queries";
import { loadChartSearch } from "@/lib/search-params";

export default async function ChartsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = loadChartSearch(await searchParams);
  const queryClient = getQueryClient();
  await Promise.all([
    ...chartPageQueries(search.view, chartQueryFrom(search)).map((options) =>
      queryClient.prefetchQuery(options),
    ),
    queryClient.prefetchQuery(appsOptions),
    queryClient.prefetchQuery(chartFollowsOptions),
    queryClient.prefetchQuery(accountPlanOptions),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="page-full @container/charts flex flex-col gap-6">
        <Suspense fallback={<TopChartsSkeleton view={search.view} />}>
          <TopChartsView />
        </Suspense>
      </div>
    </HydrationBoundary>
  );
}
