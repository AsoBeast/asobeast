import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { chartQueryFrom } from "@/components/top-charts/chart-params";
import { TopChartsSkeleton } from "@/components/top-charts/skeletons";
import { TopChartsView } from "@/components/top-charts/TopChartsView";
import { getQueryClient } from "@/lib/get-query-client";
import { chartPageOptions } from "@/lib/queries";
import { loadChartSearch } from "@/lib/search-params";

export default async function ChartsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = chartQueryFrom(loadChartSearch(await searchParams));
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(chartPageOptions(query));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="page-full @container/charts flex flex-col gap-6">
        <Suspense fallback={<TopChartsSkeleton />}>
          <TopChartsView />
        </Suspense>
      </div>
    </HydrationBoundary>
  );
}
